import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Chip, Typography } from '@mui/material';
import type {
  AcquisitionDashboard,
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

  if (loading && !dashboard) return <PanelSkeleton rows={6} />;
  if (!dashboard) return <EmptyState title="Analytics unavailable" />;

  const ns = dashboard.northStars;
  const funnel = dashboard.funnel;
  const rates = dashboard.conversionRates;
  const customers = ns?.customersAcquired ?? 0;
  const revenue = ns?.revenueAttributedCents ?? 0;
  const activeUsers = ns?.activeUsersAcquired ?? 0;
  const referralSignups = ns?.referralSignups ?? 0;
  const attributionEmpty = customers === 0 && revenue === 0 && referralSignups === 0 && activeUsers === 0;
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
        <MetricCard
          label="Customers acquired"
          value={customers}
          note={attributionEmpty ? emptyNote : 'Verified partner attribution'}
        />
        <MetricCard
          label="Active users acquired"
          value={activeUsers}
          note={attributionEmpty ? emptyNote : undefined}
        />
        <MetricCard
          label="Revenue attributed"
          value={formatCents(revenue)}
          note={attributionEmpty ? emptyNote : undefined}
        />
        <MetricCard
          label="Referral signups"
          value={referralSignups}
          note={attributionEmpty ? emptyNote : undefined}
        />
      </Box>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
        Funnel
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', mb: 3 }}>
        {(
          [
            ['discovered', 'Discovered'],
            ['qualified', 'Qualified'],
            ['contactNeeded', 'Contact needed'],
            ['awaitingApproval', 'Awaiting approval'],
            ['approved', 'Approved'],
            ['sent', 'Sent'],
            ['contacted', 'Contacted'],
            ['replied', 'Replied'],
            ['interested', 'Interested'],
            ['partners', 'Partners'],
          ] as const
        ).map(([key, label]) => (
          <MetricCard key={key} label={label} value={funnel?.[key] ?? 0} />
        ))}
      </Box>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Conversion rates
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        <Chip size="small" label={`Discovered → Qualified ${formatPct(rates?.discoveredToQualified)}`} />
        <Chip size="small" label={`Qualified → Contacted ${formatPct(rates?.qualifiedToContacted)}`} />
        <Chip size="small" label={`Contacted → Replied ${formatPct(rates?.contactedToReplied)}`} />
        <Chip size="small" label={`Replied → Interested ${formatPct(rates?.repliedToInterested)}`} />
        <Chip size="small" label={`Interested → Partner ${formatPct(rates?.interestedToPartner)}`} />
        <Chip size="small" label={`Draft → Approved ${formatPct(rates?.draftToApproved)}`} />
        <Chip size="small" label={`Approved → Sent ${formatPct(rates?.approvedToSent)}`} />
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
