import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Chip, Typography } from '@mui/material';
import type {
  AcquisitionDashboard,
  AcquisitionSourceRow,
  OutreachMetrics,
  PanelSharedProps,
  PartnerCampaign,
  PartnerProspect,
} from './types';
import {
  API,
  EmptyState,
  MetricCard,
  PanelSkeleton,
  asArray,
  campaignLabel,
  formatCents,
  formatPct,
  formatProspectType,
  northStarValues,
  unavailableIfZero,
} from './components';
import { adminApiService } from '@/services/adminApiService';

export const AnalyticsPanel: React.FC<PanelSharedProps> = ({ onError, refreshKey }) => {
  const [dashboard, setDashboard] = useState<AcquisitionDashboard | null>(null);
  const [metrics, setMetrics] = useState<OutreachMetrics | null>(null);
  const [prospects, setProspects] = useState<PartnerProspect[]>([]);
  const [campaigns, setCampaigns] = useState<PartnerCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const [d, m, p, c] = await Promise.all([
        adminApiService.get(`${API}/acquisition/dashboard`),
        adminApiService.get(`${API}/metrics`),
        adminApiService.get(`${API}/prospects`),
        adminApiService.get(`${API}/campaigns`),
      ]);
      setDashboard(d as AcquisitionDashboard);
      setMetrics(m as OutreachMetrics);
      setProspects(asArray<PartnerProspect>(p));
      setCampaigns(asArray<PartnerCampaign>(c));
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const byCampaign = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of prospects) {
      const id = p.campaignId || 'unassigned';
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, count]) => {
        const c = campaigns.find((x) => x.campaignId === id);
        return { id, label: c ? campaignLabel(c) : id, count };
      })
      .sort((a, b) => b.count - a.count);
  }, [prospects, campaigns]);

  const byMarket = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of prospects) {
      const key = [p.metro || p.city || 'unknown', p.country || ''].filter(Boolean).join(', ') || 'unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [prospects]);

  const topSources = useMemo((): AcquisitionSourceRow[] => {
    const fromDash =
      dashboard?.topSources || dashboard?.sources || dashboard?.acquisitionSources || [];
    if (fromDash.length > 0) return fromDash;

    const groups = new Map<string, AcquisitionSourceRow>();
    for (const p of prospects) {
      const key = p.prospectKind || p.organizationType || p.prospectType || p.discoverySource || 'unknown';
      const label = formatProspectType(key);
      const row = groups.get(key) || {
        key,
        label,
        source: key,
        emails: 0,
        sent: 0,
        signups: 0,
        activated: 0,
        revenueCents: 0,
        prospects: 0,
      };
      row.prospects = (row.prospects || 0) + 1;
      if (p.email) row.emails = (row.emails || 0) + 1;
      const emailState = (p.emailState || p.acquisitionStatus || '').toUpperCase();
      if (['SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'REPLIED'].includes(emailState) || (p.crmLifecycle || '').toUpperCase() === 'CONTACTED') {
        row.sent = (row.sent || 0) + 1;
      }
      row.signups = (row.signups || 0) + (p.referralSignups ?? 0);
      row.activated = (row.activated || 0) + (p.activatedUsers ?? 0);
      row.revenueCents =
        (row.revenueCents || 0) + (p.attributedRevenueCents ?? 0) + (p.directRevenueCents ?? 0);
      groups.set(key, row);
    }
    return [...groups.values()].sort(
      (a, b) => (b.revenueCents || 0) - (a.revenueCents || 0) || (b.signups || 0) - (a.signups || 0),
    );
  }, [dashboard, prospects]);

  if (loading && !dashboard) return <PanelSkeleton rows={6} />;
  if (!dashboard) return <EmptyState title="Analytics unavailable" />;

  const ns = northStarValues(dashboard.northStars);
  const funnel = dashboard.funnel;
  const rates = dashboard.conversionRates;
  const attributionEmpty =
    ns.payingCustomers === 0 && ns.revenueCents === 0 && ns.newSignups === 0 && ns.activatedUsers === 0;
  const emptyNote = 'No attributed customers yet — referral tracking starts after first approved sends.';

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
        North star
      </Typography>
      {attributionEmpty && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {emptyNote}
        </Typography>
      )}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
        <MetricCard label="New signups" value={ns.newSignups} note={attributionEmpty ? emptyNote : undefined} />
        <MetricCard label="Activated users" value={ns.activatedUsers} note={attributionEmpty ? emptyNote : undefined} />
        <MetricCard label="Paying customers" value={ns.payingCustomers} note={attributionEmpty ? emptyNote : 'Verified attribution'} />
        <MetricCard label="Credit purchases" value={ns.creditPurchases} note={attributionEmpty ? emptyNote : undefined} />
        <MetricCard label="Revenue" value={formatCents(ns.revenueCents)} note={attributionEmpty ? emptyNote : undefined} />
      </Box>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
        Top acquisition sources
      </Typography>
      {topSources.length === 0 ? (
        <EmptyState title="No source data yet" detail="Sources appear after discovery and outreach." />
      ) : (
        <Box sx={{ display: 'grid', gap: 1.25, mb: 3 }}>
          {topSources.slice(0, 12).map((row) => {
            const label = row.label || row.source || row.key || 'Unknown';
            const revenue = row.revenueCents ?? row.revenue ?? 0;
            return (
              <Box
                key={label}
                sx={{
                  display: 'flex',
                  gap: 1.5,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  p: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
                <Typography sx={{ fontWeight: 700, minWidth: 140 }}>{label}</Typography>
                <Chip size="small" label={`Emails ${row.emails ?? row.sent ?? 0}`} variant="outlined" />
                <Chip size="small" label={`Signups ${row.signups ?? 0}`} variant="outlined" />
                <Chip size="small" label={`Activated ${row.activated ?? 0}`} variant="outlined" />
                <Chip size="small" label={`Revenue ${formatCents(revenue)}`} variant="outlined" />
                {row.prospects != null && (
                  <Chip size="small" label={`Prospects ${row.prospects}`} variant="outlined" />
                )}
              </Box>
            );
          })}
        </Box>
      )}

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
        Funnel
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', mb: 3 }}>
        {(
          [
            ['discovered', 'Discovered'],
            ['contactable', 'Contactable'],
            ['qualified', 'Qualified'],
            ['approved', 'Approved'],
            ['sent', 'Sent'],
            ['clicked', 'Clicked'],
            ['signedUp', 'Signed up'],
            ['activated', 'Activated'],
            ['buyers', 'Buyers'],
            ['replied', 'Replied'],
            ['interested', 'Interested'],
            ['partners', 'Partners'],
          ] as const
        )
          .filter(([key]) => funnel?.[key] != null || ['discovered', 'approved', 'sent'].includes(key))
          .map(([key, label]) => (
            <MetricCard key={key} label={label} value={funnel?.[key] ?? 0} />
          ))}
      </Box>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Conversion rates
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        <Chip size="small" label={`Discovered → Contactable ${formatPct(rates?.discoveredToContactable ?? rates?.discoveredToQualified)}`} />
        <Chip size="small" label={`Approved → Sent ${formatPct(rates?.approvedToSentRate ?? rates?.approvedToSent)}`} />
        <Chip size="small" label={`Sent → Clicked ${formatPct(rates?.sentToClicked)}`} />
        <Chip size="small" label={`Signed up → Activated ${formatPct(rates?.signedUpToActivated)}`} />
        <Chip size="small" label={`Activated → Buyers ${formatPct(rates?.activatedToBuyers)}`} />
        <Chip size="small" label={`Contacted → Replied ${formatPct(rates?.contactedToReplied)}`} />
      </Box>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
        Outreach metrics
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', mb: 3 }}>
        <MetricCard label="Sent" value={metrics?.sent ?? 0} />
        <MetricCard label="Delivered" value={metrics?.delivered ?? 0} />
        <MetricCard label="Bounced" value={metrics?.bounced ?? 0} />
        <MetricCard label="Replies" value={metrics?.replies ?? 0} />
        <MetricCard label="Complaints" value={metrics?.complaints ?? 0} />
        <MetricCard label="Approved recipients" value={metrics?.approvedRecipients ?? 0} />
        <MetricCard label="Positive replies" value={unavailableIfZero(metrics?.positiveReplies)} />
        <MetricCard label="Landing sessions" value={unavailableIfZero(metrics?.partnerLandingSessions)} />
        <MetricCard label="Attributed signups (metric)" value={unavailableIfZero(metrics?.partnerAttributedSignups)} />
      </Box>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Prospects by campaign
      </Typography>
      {byCampaign.length === 0 ? (
        <EmptyState title="No prospect data" />
      ) : (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
          {byCampaign.map((row) => (
            <Chip key={row.id} label={`${row.label}: ${row.count}`} variant="outlined" />
          ))}
        </Box>
      )}

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Prospects by market
      </Typography>
      {byMarket.length === 0 ? (
        <EmptyState title="No market data" />
      ) : (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {byMarket.map((row) => (
            <Chip key={row.label} label={`${row.label}: ${row.count}`} variant="outlined" />
          ))}
        </Box>
      )}
    </Box>
  );
};
