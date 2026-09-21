import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import type { PanelSharedProps, PartnerCampaign } from './types';
import {
  API,
  EmptyState,
  PanelSkeleton,
  StatusChip,
  asArray,
  campaignLabel,
  discoverySummary,
  mapCampaignStatus,
  pollDiscoveryJob,
  startDiscoveryJob,
} from './components';
import { adminApiService } from '@/services/adminApiService';

export const CampaignsPanel: React.FC<PanelSharedProps> = ({
  onError,
  onNotice,
  refreshKey,
  requestRefresh,
}) => {
  const [campaigns, setCampaigns] = useState<PartnerCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [discoverId, setDiscoverId] = useState<string | null>(null);
  const [discoverStage, setDiscoverStage] = useState<string | null>(null);
  const [discoverPct, setDiscoverPct] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const c = await adminApiService.get(`${API}/campaigns`);
      setCampaigns(asArray<PartnerCampaign>(c));
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const setStatus = async (campaignId: string, status: string) => {
    setBusyId(campaignId);
    onError(null);
    try {
      await adminApiService.post(`${API}/campaigns/${encodeURIComponent(campaignId)}/status`, { status });
      onNotice(`Campaign set to ${status}`);
      requestRefresh();
      await load();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Could not update campaign status');
    } finally {
      setBusyId(null);
    }
  };

  const runDiscovery = async (campaignId: string) => {
    setDiscoverId(campaignId);
    setDiscoverPct(0);
    setDiscoverStage('Starting…');
    onError(null);
    onNotice(null);
    const cancel = { cancelled: false };
    try {
      const started = await startDiscoveryJob({ prepareDrafts: true, onlyCampaignId: campaignId });
      const final = await pollDiscoveryJob(
        started.jobId,
        (job) => {
          setDiscoverStage(job.stage || job.status);
          setDiscoverPct(job.progressPct ?? 0);
        },
        cancel,
      );
      onNotice(`${campaignLabel({ campaignId, displayName: campaigns.find((c) => c.campaignId === campaignId)?.displayName })} — ${discoverySummary(final)}`);
      requestRefresh();
      await load();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Campaign discovery failed');
    } finally {
      cancel.cancelled = true;
      setDiscoverId(null);
      setDiscoverStage(null);
      setTimeout(() => setDiscoverPct(0), 500);
    }
  };

  if (loading && campaigns.length === 0) return <PanelSkeleton rows={4} />;
  if (campaigns.length === 0) {
    return <EmptyState title="No campaigns" detail="Campaigns are seeded by the API market catalog." />;
  }

  const statusColor = (s: string): 'default' | 'success' | 'warning' | 'info' | 'error' => {
    if (s === 'active') return 'success';
    if (s === 'paused') return 'warning';
    if (s === 'completed') return 'info';
    return 'default';
  };

  return (
    <Box>
      {discoverId && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2">{discoverStage}</Typography>
            <Typography variant="caption">{discoverPct}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={discoverPct} sx={{ height: 8, borderRadius: 1, mt: 0.5 }} />
        </Box>
      )}

      <Box sx={{ display: 'grid', gap: 1.5 }}>
        {campaigns.map((c) => {
          const status = mapCampaignStatus(c.status);
          const busy = busyId === c.campaignId;
          const discovering = discoverId === c.campaignId;
          return (
            <Box
              key={c.campaignId}
              sx={{
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1.5,
                alignItems: 'center',
              }}
            >
              <Box sx={{ minWidth: 220, flex: '1 1 220px' }}>
                <Typography sx={{ fontWeight: 700 }}>{campaignLabel(c)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {c.country}/{c.market} · {c.primaryMode || 'TRAIN'} · {c.campaignId}
                </Typography>
              </Box>
              <StatusChip label={status.toUpperCase()} color={statusColor(status)} />
              {c.dailyDiscoveryLimit != null && (
                <Chip size="small" variant="outlined" label={`Discover ≤${c.dailyDiscoveryLimit}/day`} />
              )}
              {c.dailyOutreachLimit != null && (
                <Chip size="small" variant="outlined" label={`Outreach ≤${c.dailyOutreachLimit}/day`} />
              )}
              <Box sx={{ flex: 1 }} />
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  size="small"
                  disabled={!!discoverId}
                  onClick={() => void runDiscovery(c.campaignId)}
                >
                  {discovering ? 'Discovering…' : 'Discover'}
                </Button>
                {status !== 'active' && status !== 'completed' && (
                  <Button
                    size="small"
                    variant="contained"
                    disabled={busy}
                    onClick={() => void setStatus(c.campaignId, 'active')}
                  >
                    Start
                  </Button>
                )}
                {status === 'active' && (
                  <Button
                    size="small"
                    disabled={busy}
                    onClick={() => void setStatus(c.campaignId, 'paused')}
                  >
                    Pause
                  </Button>
                )}
                {status === 'paused' && (
                  <Button
                    size="small"
                    disabled={busy}
                    onClick={() => void setStatus(c.campaignId, 'active')}
                  >
                    Resume
                  </Button>
                )}
                {status !== 'completed' && status !== 'draft' && (
                  <Button
                    size="small"
                    disabled={busy}
                    onClick={() => void setStatus(c.campaignId, 'completed')}
                  >
                    Complete
                  </Button>
                )}
                {status === 'draft' && (
                  <Chip size="small" label="DRAFT" />
                )}
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
