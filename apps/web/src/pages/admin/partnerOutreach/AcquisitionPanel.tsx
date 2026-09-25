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
  { key: 'qualified', label: 'Qualified' },
  { key: 'autoEligible', label: 'Auto eligible' },
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
  if (key === 'autoEligible') return funnel.autoEligible ?? funnel.drafts ?? funnel.approved ?? 0;
  if (key === 'qualified') return funnel.qualified ?? funnel.contactable ?? 0;
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
  const [discoverProcessed, setDiscoverProcessed] = useState(0);
  const [discoverTotal, setDiscoverTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
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
    setDiscoverProcessed(0);
    setDiscoverTotal(0);
    setDiscoverStage('Discovering more prospects...');
    onError(null);
    onNotice(null);
    const cancel = { cancelled: false };
    try {
      const started = await startDiscoveryJob({ prepareDrafts: true });
      setDiscoverStage(started.stage || started.status || 'Discovering more prospects...');
      setDiscoverProcessed(Number(started.processed ?? 0));
      setDiscoverTotal(Number(started.total ?? 0));
      const final = await pollDiscoveryJob(
        started.jobId,
        (job) => {
          setDiscoverStage(job.stage || job.status || 'Discovering more prospects...');
          setDiscoverProcessed(Number(job.processed ?? 0));
          setDiscoverTotal(Number(job.total ?? 0));
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
      setDiscoverProcessed(0);
      setDiscoverTotal(0);
    }
  };

  const ns = northStarValues(dashboard?.northStars);
  const funnel = dashboard?.funnel;
  const rates = dashboard?.conversionRates;
  const awaiting = funnel?.awaitingApproval ?? 0;
  const autoEligible = funnel?.autoEligible ?? funnel?.drafts ?? 0;
  const pauseAll = Boolean(dashboard?.settings?.pauseAllOutreach);
  const testOnly = Boolean(
    (dashboard?.settings as { testRecipientsOnly?: boolean } | undefined)?.testRecipientsOnly,
  );

  const funnelSteps = useMemo(() => {
    const keysPresent = CUSTOMER_FUNNEL.filter((s) => {
      if (!funnel) return true;
      if (funnel[s.key] != null) return true;
      // Always show core path even when API still returns legacy shape
      return ['discovered', 'contactable', 'qualified', 'autoEligible', 'sent', 'signedUp', 'activated', 'buyers', 'revenue'].includes(s.key)
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
          : prevKey === 'contactable' && s.key === 'qualified'
            ? rates?.contactableToQualified
            : prevKey === 'qualified' && s.key === 'autoEligible'
              ? rates?.qualifiedToAutoEligible
              : prevKey === 'autoEligible' && s.key === 'sent'
                ? rates?.autoEligibleToSent ?? rates?.approvedToSentRate ?? rates?.approvedToSent
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
    if (key === 'awaitingApproval' || key === 'drafts' || key === 'approved' || key === 'scheduled' || key === 'autoEligible') {
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
    if (
      filter.includes('contactState=') ||
      filter.includes('need_contact') ||
      filter.includes('CONTACT_NEEDED') ||
      filter.includes('acquisitionStatus=CONTACT')
    ) {
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
      {autoEligible > 0 && !pauseAll && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => onNavigate({ tab: 'approvals', approvalsStatus: 'draft' })}
            >
              View queue
            </Button>
          }
        >
          {autoEligible} auto-eligible — scheduled acquisition sends these through SES. Manual SEND
          remains an override only.
        </Alert>
      )}
      {awaiting > 0 && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => onNavigate({ tab: 'approvals', approvalsStatus: 'draft' })}
            >
              Human review
            </Button>
          }
        >
          {awaiting} prospect{awaiting === 1 ? '' : 's'} need human review.
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
            <Typography variant="body2">
              {discoverStage || 'Discovering more prospects...'}
            </Typography>
            {discoverTotal > 0 && discoverProcessed > 0 && (
              <Typography variant="caption">
                {Math.round((discoverProcessed / discoverTotal) * 100)}%
              </Typography>
            )}
          </Box>
          <LinearProgress
            variant={discoverTotal > 0 && discoverProcessed > 0 ? 'determinate' : 'indeterminate'}
            value={
              discoverTotal > 0 && discoverProcessed > 0
                ? Math.round((discoverProcessed / discoverTotal) * 100)
                : undefined
            }
            sx={{ height: 8, borderRadius: 1, mt: 0.5 }}
          />
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
            attention={step.key === 'autoEligible' && autoEligible > 0 && pauseAll}
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
