import React, { useCallback, useEffect, useState } from 'react';
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
  pollDiscoveryJob,
  startDiscoveryJob,
} from './components';
import { adminApiService } from '@/services/adminApiService';

interface Props extends PanelSharedProps {
  onNavigate: (nav: NavigateFilters) => void;
}

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

  const mode = (dashboard?.settings?.outreachMode || 'off').toLowerCase();
  const ns = dashboard?.northStars;
  const funnel = dashboard?.funnel;
  const rates = dashboard?.conversionRates;
  const awaiting = funnel?.awaitingApproval ?? 0;

  const funnelNav = (key: keyof NonNullable<typeof funnel>) => {
    if (key === 'awaitingApproval' || key === 'drafts' || key === 'approved' || key === 'scheduled') {
      onNavigate({
        tab: 'approvals',
        approvalsStatus: key === 'approved' ? 'approved' : key === 'scheduled' ? 'scheduled' : 'draft',
      });
      return;
    }
    if (key === 'contactNeeded') {
      onNavigate({
        tab: 'prospects',
        prospectFilters: { contactAvailable: 'needed', contactState: 'CONTACT_NEEDED' },
      });
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
    if (filter.includes('contactState=')) {
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
    onNavigate({ tab: 'prospects' });
  };

  if (loading && !dashboard) return <PanelSkeleton rows={6} />;
  if (!dashboard) return <EmptyState title="Dashboard unavailable" detail="Could not load acquisition data." />;

  return (
    <Box>
      {mode === 'off' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Outreach mode is <b>OFF</b>. Discovery and drafts can still run; sending is blocked.
        </Alert>
      )}
      {mode === 'test' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Outreach mode is <b>TEST</b>. Approved sends go to configured test recipients only.
        </Alert>
      )}
      {mode === 'live' && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Outreach mode is <b>LIVE</b>. Approved recipients can be dispatched subject to safety gates.
        </Alert>
      )}
      {dashboard.settings?.pauseAllOutreach && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Pause All Outreach is enabled. No partner emails will send until it is cleared in Settings.
        </Alert>
      )}
      {awaiting > 0 && (
        <Alert
          severity="warning"
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
        <MetricCard
          label="Customers acquired"
          value={ns?.customersAcquired ?? 0}
          note="Attributed paid customers"
          loading={loading}
        />
        <MetricCard
          label="Active users acquired"
          value={ns?.activeUsersAcquired ?? 0}
          note="Activated referral users"
          loading={loading}
        />
        <MetricCard
          label="Revenue attributed"
          value={formatCents(ns?.revenueAttributedCents)}
          note="Verified partner attribution"
          loading={loading}
        />
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
        FUNNEL
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', mb: 2.5 }}>
        {(
          [
            ['discovered', 'Discovered'],
            ['qualified', 'Qualified'],
            ['contactNeeded', 'Contact needed'],
            ['drafts', 'Drafts'],
            ['awaitingApproval', 'Awaiting approval'],
            ['approved', 'Approved'],
            ['sent', 'Sent'],
            ['contacted', 'Contacted'],
            ['replied', 'Replied'],
            ['interested', 'Interested'],
            ['partners', 'Partners'],
          ] as const
        ).map(([key, label]) => (
          <MetricCard
            key={key}
            label={label}
            value={funnel?.[key] ?? 0}
            attention={key === 'awaitingApproval' && (funnel?.[key] ?? 0) > 0}
            onClick={() => funnelNav(key)}
          />
        ))}
      </Box>

      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, letterSpacing: 0.6 }}>
        CONVERSION RATES
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

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Today&apos;s actions
      </Typography>
      {(dashboard.todaysActions?.length ?? 0) === 0 ? (
        <EmptyState title="No actions queued" detail="Funnel is clear for now." />
      ) : (
        <List dense sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          {dashboard.todaysActions.map((a) => (
            <ListItemButton key={a.key} onClick={() => actionNav(a.filter)} disabled={!a.count}>
              <ListItemText primary={a.label} secondary={a.filter} />
              <Chip size="small" label={a.count} color={a.count > 0 ? 'warning' : 'default'} />
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  );
};
