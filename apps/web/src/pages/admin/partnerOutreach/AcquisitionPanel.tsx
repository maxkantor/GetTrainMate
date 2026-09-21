import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import type {
  AcquisitionDashboard,
  FunnelCounts,
  NavigateFilters,
  PanelSharedProps,
} from './types';
import {
  API,
  EmptyState,
  MetricCard,
  PanelSkeleton,
  discoverySummary,
  formatCents,
  formatPct,
  northStarValues,
  pollDiscoveryJob,
  startDiscoveryJob,
} from './components';
import { adminApiService } from '@/services/adminApiService';

interface Props extends PanelSharedProps {
  onNavigate: (nav: NavigateFilters) => void;
}

const CUSTOMER_FUNNEL: { key: string; label: string }[] = [
  { key: 'discovered', label: 'Discovered' },
  { key: 'contactable', label: 'Contactable' },
  { key: 'approved', label: 'Approved' },
  { key: 'sent', label: 'Sent' },
  { key: 'clicked', label: 'Clicked' },
  { key: 'signedUp', label: 'Signed up' },
  { key: 'activated', label: 'Activated' },
  { key: 'buyers', label: 'Buyers' },
  { key: 'revenue', label: 'Revenue' },
];

function funnelValue(funnel: FunnelCounts | undefined, key: string): number {
  if (!funnel) return 0;
  const direct = funnel[key];
  if (typeof direct === 'number') return direct;
  // Graceful legacy fallbacks
  if (key === 'contactable') {
    if (funnel.qualified != null) return funnel.qualified;
    if (funnel.contactNeeded != null) {
      return Math.max(0, (funnel.discovered ?? 0) - (funnel.contactNeeded ?? 0));
    }
    return 0;
  }
  if (key === 'signedUp') return funnel.signedUp ?? 0;
  if (key === 'activated') return funnel.activated ?? 0;
  if (key === 'buyers') return funnel.buyers ?? funnel.partners ?? 0;
  if (key === 'clicked') return funnel.clicked ?? 0;
  if (key === 'revenue') return funnel.revenue ?? 0;
  return 0;
}

function stepRate(curr: number, prev: number): number | null {
  if (prev <= 0) return null;
  return curr / prev;
}

/** Overview panel (file retained as AcquisitionPanel). */
export const AcquisitionPanel: React.FC<Props> = ({
  onError,
  onNotice,
  refreshKey,
  requestRefresh,
  onNavigate,
}) => {
  const [dashboard, setDashboard] = useState<AcquisitionDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [discoverStage, setDiscoverStage] = useState<string | null>(null);
  const [discoverPct, setDiscoverPct] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const data = await adminApiService.get(`${API}/acquisition/dashboard`);
      setDashboard(data as AcquisitionDashboard);
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Failed to load acquisition dashboard');
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const runDiscovery = async () => {
    setDiscovering(true);
    setDiscoverPct(0);
    setDiscoverStage('Starting discovery job…');
    onError(null);
    onNotice(null);
    const cancel = { cancelled: false };
    try {
      const started = await startDiscoveryJob({ prepareDrafts: true });
      setDiscoverStage(started.stage || started.status || 'running');
      setDiscoverPct(started.progressPct ?? 5);
      const final = await pollDiscoveryJob(
        started.jobId,
        (job) => {
          setDiscoverStage(job.stage || job.status);
          setDiscoverPct(job.progressPct ?? 0);
        },
        cancel,
      );
      onNotice(discoverySummary(final));
      requestRefresh();
      await load();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Discovery failed');
    } finally {
      cancel.cancelled = true;
      setDiscovering(false);
      setDiscoverStage(null);
      setTimeout(() => setDiscoverPct(0), 600);
    }
  };

  const ns = northStarValues(dashboard?.northStars);
  const funnel = dashboard?.funnel;
  const rates = dashboard?.conversionRates;
  const awaiting = funnel?.awaitingApproval ?? funnel?.drafts ?? 0;
  const approvedReady = funnel?.approved ?? 0;
  const pauseAll = Boolean(dashboard?.settings?.pauseAllOutreach);
  const testOnly = Boolean(
    (dashboard?.settings as { testRecipientsOnly?: boolean } | undefined)?.testRecipientsOnly,
  );

  const funnelSteps = useMemo(() => {
    const keysPresent = CUSTOMER_FUNNEL.filter((s) => {
      if (!funnel) return true;
      if (funnel[s.key] != null) return true;
      // Always show core path even when API still returns legacy shape
      return ['discovered', 'contactable', 'approved', 'sent', 'signedUp', 'activated', 'buyers', 'revenue'].includes(s.key)
        || funnelValue(funnel, s.key) > 0;
    });
    return keysPresent.map((s, i) => {
      const value = s.key === 'revenue'
        ? (funnel?.revenue ?? 0)
        : funnelValue(funnel, s.key);
      const prevKey = i > 0 ? keysPresent[i - 1].key : null;
      const prevVal = prevKey && prevKey !== 'revenue' ? funnelValue(funnel, prevKey) : 0;
      const rateFromApi =
        prevKey === 'discovered' && s.key === 'contactable'
          ? rates?.discoveredToContactable ?? rates?.discoveredToQualified
          : prevKey === 'contactable' && s.key === 'approved'
            ? rates?.contactableToApproved
            : prevKey === 'approved' && s.key === 'sent'
              ? rates?.approvedToSentRate ?? rates?.approvedToSent
              : prevKey === 'sent' && s.key === 'clicked'
                ? rates?.sentToClicked
                : prevKey === 'clicked' && s.key === 'signedUp'
                  ? rates?.clickedToSignedUp
                  : prevKey === 'signedUp' && s.key === 'activated'
                    ? rates?.signedUpToActivated
                    : prevKey === 'activated' && s.key === 'buyers'
                      ? rates?.activatedToBuyers
                      : undefined;
      const conv = s.key === 'revenue' ? null : (rateFromApi ?? stepRate(value, prevVal));
      return { ...s, value, conv };
    });
  }, [funnel, rates]);

  const funnelNav = (key: string) => {
    if (key === 'awaitingApproval' || key === 'drafts' || key === 'approved' || key === 'scheduled') {
      onNavigate({
        tab: 'approvals',
        approvalsStatus: key === 'approved' ? 'approved' : key === 'scheduled' ? 'scheduled' : 'draft',
      });
      return;
    }
    if (key === 'contactNeeded' || key === 'contactable') {
      onNavigate({
        tab: 'prospects',
        prospectFilters: key === 'contactable'
          ? { contactAvailable: 'available' }
          : { contactAvailable: 'needed', contactState: 'CONTACT_NEEDED' },
      });
      return;
    }
    if (key === 'signedUp' || key === 'activated' || key === 'buyers' || key === 'revenue') {
      onNavigate({ tab: 'customers' });
      return;
    }
    if (key === 'replied' || key === 'interested' || key === 'partners' || key === 'contacted' || key === 'qualified') {
      const lifeMap: Record<string, string> = {
        replied: 'REPLIED',
        interested: 'INTERESTED',
        partners: 'PARTNER',
        contacted: 'CONTACTED',
        qualified: 'QUALIFIED',
      };
      onNavigate({ tab: 'prospects', prospectFilters: { lifecycle: lifeMap[key] } });
      return;
    }
    onNavigate({ tab: 'prospects' });
  };

  const actionNav = (filter: string) => {
    if (filter.includes('status=draft') || filter.includes('status=approved') || filter.includes('status=scheduled')) {
      const status = filter.split('=')[1] || 'draft';
      onNavigate({ tab: 'approvals', approvalsStatus: status });
      return;
    }
    if (filter.includes('contactState=') || filter.includes('need_contact')) {
      onNavigate({
        tab: 'prospects',
        prospectFilters: { contactAvailable: 'needed', contactState: 'CONTACT_NEEDED' },
      });
      return;
    }
    if (filter.includes('crmLifecycle=')) {
      const life = filter.split('=')[1];
      if (life === 'REPLIED') {
        onNavigate({ tab: 'inbox' });
        return;
      }
      onNavigate({ tab: 'prospects', prospectFilters: { lifecycle: life } });
      return;
    }
    if (filter.includes('customers') || filter.includes('customer')) {
      onNavigate({ tab: 'customers' });
      return;
    }
    onNavigate({ tab: 'prospects' });
  };

  if (loading && !dashboard) return <PanelSkeleton rows={6} />;
  if (!dashboard) return <EmptyState title="Dashboard unavailable" detail="Could not load acquisition data." />;

  return (
    <Box>
      {pauseAll && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => onNavigate({ tab: 'settings' })}>
              Settings
            </Button>
          }
        >
          Emergency pause is on — no outreach emails will send until you resume in Settings.
        </Alert>
      )}
      {testOnly && !pauseAll && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Test recipients only is on — APPROVE &amp; SEND delivers only to configured test addresses.
        </Alert>
      )}
      {approvedReady > 0 && !pauseAll && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => onNavigate({ tab: 'approvals', approvalsStatus: 'approved' })}
            >
              View queue
            </Button>
          }
        >
          {approvedReady} approved for next send — the daily job will send when capacity and gates allow.
          No Lambda or LIVE toggle required.
        </Alert>
      )}
      {awaiting > 0 && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => onNavigate({ tab: 'approvals', approvalsStatus: 'draft' })}>
              Open Approvals
            </Button>
          }
        >
          {awaiting} draft{awaiting === 1 ? '' : 's'} awaiting approval.
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          North stars
        </Typography>
        <Button variant="contained" disabled={discovering} onClick={() => void runDiscovery()}>
          {discovering ? 'Discovering…' : 'Run discovery'}
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2.5 }}>
        <MetricCard label="New signups" value={ns.newSignups} note="Attributed accounts" loading={loading} />
        <MetricCard label="Activated users" value={ns.activatedUsers} note="Took a core action" loading={loading} />
        <MetricCard label="Paying customers" value={ns.payingCustomers} note="Credit / paid" loading={loading} />
        <MetricCard label="Credit purchases" value={ns.creditPurchases} note="Purchase events" loading={loading} />
        <MetricCard label="Revenue" value={formatCents(ns.revenueCents)} note="Direct + attributed" loading={loading} />
      </Box>

      {discovering && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2">{discoverStage}</Typography>
            <Typography variant="caption">{discoverPct}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={discoverPct} sx={{ height: 8, borderRadius: 1, mt: 0.5 }} />
        </Box>
      )}

      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, letterSpacing: 0.6 }}>
        CUSTOMER FUNNEL
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', mb: 1.5 }}>
        {funnelSteps.map((step) => (
          <MetricCard
            key={step.key}
            label={step.label}
            value={
              step.key === 'revenue'
                ? formatCents(typeof step.value === 'number' && step.value > 1000 ? step.value : (dashboard.northStars?.revenueCents ?? dashboard.northStars?.revenueAttributedCents ?? step.value))
                : step.value
            }
            note={step.conv != null ? `${formatPct(step.conv)} from prior` : undefined}
            attention={step.key === 'approved' && approvedReady > 0 && pauseAll}
            onClick={() => funnelNav(step.key)}
          />
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        {funnelSteps.slice(1).map((step, i) => {
          if (step.conv == null || step.key === 'revenue') return null;
          const prev = funnelSteps[i];
          return (
            <Chip
              key={`rate-${step.key}`}
              size="small"
              label={`${prev.label} → ${step.label} ${formatPct(step.conv)}`}
            />
          );
        })}
      </Box>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Today&apos;s actions
      </Typography>
      {(dashboard.todaysActions?.length ?? 0) === 0 ? (
        <EmptyState title="No actions queued" detail="Funnel is clear for now." />
      ) : (
        <List dense sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          {dashboard.todaysActions.map((a) => (
            <ListItemButton key={a.key} onClick={() => actionNav(a.filter || a.key)} disabled={!a.count}>
              <ListItemText primary={a.label} secondary={a.filter || a.key} />
              <Chip size="small" label={a.count} color={a.count > 0 ? 'warning' : 'default'} />
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  );
};
