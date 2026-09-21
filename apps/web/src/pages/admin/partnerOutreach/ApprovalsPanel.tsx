import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { OutreachSettings, PanelSharedProps, PartnerProspect, PartnerQueueItem } from './types';
import {
  API,
  EmptyState,
  PanelSkeleton,
  StatusChip,
  asArray,
  formatProspectType,
  marketLabel,
  previewText,
  prospectScore,
} from './components';
import { adminApiService } from '@/services/adminApiService';

type ApprovalTab = 'needs' | 'sent' | 'blocked';

interface Props extends PanelSharedProps {
  initialStatus?: string;
}

export const ApprovalsPanel: React.FC<Props> = ({
  onError,
  onNotice,
  refreshKey,
  requestRefresh,
}) => {
  const [queue, setQueue] = useState<PartnerQueueItem[]>([]);
  const [prospects, setProspects] = useState<PartnerProspect[]>([]);
  const [settings, setSettings] = useState<OutreachSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<ApprovalTab>('needs');
  const [editItem, setEditItem] = useState<PartnerQueueItem | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [confirmOne, setConfirmOne] = useState<PartnerQueueItem | null>(null);
  const [rejectItem, setRejectItem] = useState<PartnerQueueItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [capacity, setCapacity] = useState({ dailyLimit: 10, sentToday: 0, remaining: 10 });

  const [overrideItem, setOverrideItem] = useState<{
    item: PartnerQueueItem;
    score?: number;
    min?: number;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const [q, p, s, dash] = await Promise.all([
        adminApiService.get(`${API}/queue`),
        adminApiService.get(`${API}/prospects`),
        adminApiService.get(`${API}/settings`),
        adminApiService.get(`${API}/acquisition/dashboard`).catch(() => null),
      ]);
      setQueue(asArray<PartnerQueueItem>(q));
      setProspects(asArray<PartnerProspect>(p));
      setSettings(s as OutreachSettings);
      const d = dash as {
        funnel?: { sent?: number };
        settings?: { dailyLimit?: number; sentToday?: number };
      } | null;
      const limit = Number((s as OutreachSettings)?.dailyLimit ?? d?.settings?.dailyLimit ?? 10) || 10;
      const sentToday = Number(d?.settings?.sentToday ?? 0) || 0;
      // Prefer counting sent today from queue if dashboard lacks it
      const today = new Date().toISOString().slice(0, 10);
      const sentFromQueue = asArray<PartnerQueueItem>(q).filter((item) => {
        const at = item.sentAt;
        return at && String(at).startsWith(today) && (item.status === 'sent' || item.status === 'delivered');
      }).length;
      const sent = Math.max(sentToday, sentFromQueue);
      setCapacity({ dailyLimit: limit, sentToday: sent, remaining: Math.max(0, limit - sent) });
      setSelectedIds(new Set());
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Failed to load approval queue');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const prospectMap = useMemo(() => {
    const m = new Map<string, PartnerProspect>();
    for (const p of prospects) m.set(p.prospectId, p);
    return m;
  }, [prospects]);

  const paused = Boolean(settings?.pauseAllOutreach);
  const needsApproval = useMemo(
    () =>
      queue.filter(
        (q) =>
          q.status === 'draft' &&
          (q.followUpNumber == null || q.followUpNumber === 0),
      ),
    [queue],
  );
  const recentlySent = useMemo(
    () =>
      queue
        .filter((q) => q.status === 'sent' || q.status === 'delivered' || q.status === 'replied')
        .slice(0, 40),
    [queue],
  );
  const deferred = useMemo(
    () =>
      queue.filter((q) =>
        ['approved_for_next_send', 'approved'].includes(q.status || ''),
      ),
    [queue],
  );
  const blocked = useMemo(
    () =>
      queue.filter((q) =>
        ['failed', 'bounced', 'opted_out', 'rejected', 'suppressed'].includes(q.status || ''),
      ),
    [queue],
  );

  const items =
    tab === 'needs'
      ? needsApproval
      : tab === 'sent'
        ? recentlySent
        : [...deferred, ...blocked];

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(items.map((i) => i.queueId)));
  };

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    onError(null);
    try {
      const result = await fn();
      onNotice(label);
      requestRefresh();
      await load();
      return result;
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Action failed');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const approveAndSendOne = async (q: PartnerQueueItem, confirmOverride = false) => {
    const result = (await run('Approve & Send completed', () =>
      adminApiService.post(`${API}/queue/${encodeURIComponent(q.queueId)}/approve-and-send`, {
        confirm: true,
        confirmOverride,
      }),
    )) as {
      sent?: boolean;
      deferred?: boolean;
      error?: string;
      sendError?: string;
      needsOverride?: boolean;
      acquisitionScore?: number;
      minAcquisitionScore?: number;
    } | null;
    setConfirmOne(null);
    if (result?.needsOverride) {
      setOverrideItem({
        item: q,
        score: result.acquisitionScore,
        min: result.minAcquisitionScore,
      });
      return;
    }
    if (result?.deferred) {
      onNotice('Approved for next send — daily capacity full. Scheduler will send when eligible.');
    } else if (result?.sent === false && (result.error || result.sendError)) {
      onError(result.error || result.sendError || 'Send blocked');
    }
  };

  const approveAndSendSelected = async () => {
    const ids = [...selectedIds];
    setConfirmBulk(false);
    const result = (await run(`Processed ${ids.length} message(s)`, () =>
      adminApiService.post(`${API}/queue/bulk-approve-and-send`, {
        queueIds: ids,
        confirm: true,
      }),
    )) as { sent?: number; deferred?: number; blocked?: unknown[] } | null;
    if (result) {
      onNotice(
        `Sent ${result.sent ?? 0}` +
          (result.deferred ? `, deferred ${result.deferred} for next run` : '') +
          (result.blocked?.length ? `, blocked ${result.blocked.length}` : ''),
      );
    }
  };

  const saveEdit = async () => {
    if (!editItem) return;
    await run('Saved — approval invalidated; Approve & Send again', () =>
      adminApiService.put(`${API}/queue/${encodeURIComponent(editItem.queueId)}`, {
        subject: editSubject,
        bodyText: editBody,
      }),
    );
    setEditItem(null);
  };

  if (loading && queue.length === 0) return <PanelSkeleton rows={5} />;

  const selectedCount = selectedIds.size;
  const canSendNow = Math.min(selectedCount, capacity.remaining);
  const deferredCount = Math.max(0, selectedCount - capacity.remaining);

  return (
    <Box>
      {paused && (
        <Alert severity="error" sx={{ mb: 2 }}>
          EMERGENCY PAUSE is on — no outreach will send. Resume in Settings only when ready.
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 2 }}>
        Daily capacity: {capacity.sentToday} sent today · limit {capacity.dailyLimit} ·{' '}
        {capacity.remaining} remaining. Approve &amp; Send authorizes SES immediately when capacity
        allows; overflow becomes Approved for next send.
      </Alert>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }} alignItems="center">
        <Button
          size="small"
          variant={tab === 'needs' ? 'contained' : 'outlined'}
          onClick={() => setTab('needs')}
        >
          Needs approval ({needsApproval.length})
        </Button>
        <Button
          size="small"
          variant={tab === 'sent' ? 'contained' : 'outlined'}
          onClick={() => setTab('sent')}
        >
          Recently sent ({recentlySent.length})
        </Button>
        <Button
          size="small"
          variant={tab === 'blocked' ? 'contained' : 'outlined'}
          onClick={() => setTab('blocked')}
        >
          Deferred / blocked ({deferred.length + blocked.length})
        </Button>
        <Box sx={{ flex: 1 }} />
        {tab === 'needs' && (
          <>
            <Button size="small" onClick={toggleAll} disabled={items.length === 0}>
              {selectedIds.size === items.length && items.length > 0 ? 'Clear' : 'Select all'}
            </Button>
            <Button
              variant="contained"
              color="success"
              disabled={selectedCount === 0 || busy || paused}
              onClick={() => setConfirmBulk(true)}
              sx={{ fontWeight: 900, minHeight: 48, px: 2.5 }}
            >
              APPROVE &amp; SEND {selectedCount || ''}
            </Button>
          </>
        )}
        <Button
          size="small"
          variant="outlined"
          disabled={busy}
          onClick={() =>
            void run('Rescored low-score prospects', () =>
              adminApiService.post(`${API}/prospects/rescore-low`, { max: 50 }),
            )
          }
        >
          Rescore low scores
        </Button>
      </Stack>

      {items.length === 0 ? (
        <EmptyState
          title={tab === 'needs' ? 'Nothing needs approval' : 'Nothing here'}
          detail={
            tab === 'needs'
              ? 'Drafts appear here after discovery prepares messages.'
              : 'No records in this view.'
          }
        />
      ) : (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {items.map((q) => {
            const prospect = q.prospectId ? prospectMap.get(q.prospectId) : undefined;
            const market = prospect ? marketLabel(prospect) : '';
            const why =
              prospect?.whySelected ||
              prospect?.scoreExplanation ||
              (prospectScore(prospect) > 0 ? `Score ${prospectScore(prospect)}` : 'Score pending');
            return (
              <Box
                key={q.queueId}
                sx={{
                  p: 2,
                  border: '1px solid',
                  borderColor: selectedIds.has(q.queueId) ? 'success.main' : 'divider',
                  borderRadius: 2,
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  {tab === 'needs' && (
                    <Checkbox
                      checked={selectedIds.has(q.queueId)}
                      onChange={() => toggle(q.queueId)}
                    />
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography sx={{ fontWeight: 800 }}>{q.organizationName}</Typography>
                      <StatusChip label={q.status} />
                      {prospect && <StatusChip label={formatProspectType(prospect)} />}
                      {market && market !== '—' && <StatusChip label={market} />}
                      {prospect && (
                        <StatusChip
                          label={`Score ${prospectScore(prospect)}`}
                          color={prospectScore(prospect) < 40 ? 'warning' : 'info'}
                        />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {q.recipient}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                      Why: {why}
                    </Typography>
                    <Typography sx={{ fontWeight: 700, mt: 1 }}>{q.subject}</Typography>
                    <Typography
                      variant="body2"
                      sx={{ mt: 0.75, whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto' }}
                    >
                      {previewText(q.bodyText, 600)}
                    </Typography>
                    {q.partnerUrl && (
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        CTA:{' '}
                        <a href={q.partnerUrl} target="_blank" rel="noopener noreferrer">
                          {q.partnerUrl}
                        </a>
                      </Typography>
                    )}
                    {tab === 'needs' && (
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                        <Button
                          size="large"
                          variant="outlined"
                          onClick={() => {
                            setEditItem(q);
                            setEditSubject(q.subject || '');
                            setEditBody(q.bodyText || '');
                          }}
                        >
                          EDIT
                        </Button>
                        <Button
                          size="large"
                          color="inherit"
                          onClick={() => {
                            setRejectItem(q);
                            setRejectReason('');
                          }}
                        >
                          REJECT
                        </Button>
                        <Button
                          size="large"
                          variant="contained"
                          color="success"
                          disabled={busy || paused}
                          onClick={() => setConfirmOne(q)}
                          sx={{ fontWeight: 900, minHeight: 48 }}
                        >
                          APPROVE &amp; SEND
                        </Button>
                      </Stack>
                    )}
                  </Box>
                </Stack>
              </Box>
            );
          })}
        </Box>
      )}

      <Dialog open={!!editItem} onClose={() => setEditItem(null)} maxWidth="md" fullWidth>
        <DialogTitle>Edit message</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            To: {editItem?.recipient}
          </Typography>
          <TextField
            fullWidth
            label="Subject"
            value={editSubject}
            onChange={(e) => setEditSubject(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            multiline
            minRows={10}
            label="Body"
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
          />
          {editItem?.partnerUrl && (
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              CTA: {editItem.partnerUrl}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditItem(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => void saveEdit()} disabled={busy}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirmOne} onClose={() => setConfirmOne(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Approve &amp; send this email?</DialogTitle>
        <DialogContent>
          <Typography>
            You are authorizing GetTrainMate to send this initial outreach via SES.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            {confirmOne?.organizationName} → {confirmOne?.recipient}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Remaining capacity today: {capacity.remaining} / {capacity.dailyLimit}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOne(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            disabled={busy || paused}
            onClick={() => confirmOne && void approveAndSendOne(confirmOne)}
            sx={{ fontWeight: 900 }}
          >
            APPROVE &amp; SEND
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmBulk} onClose={() => setConfirmBulk(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send {selectedCount} approved email{selectedCount === 1 ? '' : 's'}?</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>
            You are authorizing GetTrainMate to send these initial outreach emails.
          </Typography>
          <Typography variant="body2">{selectedCount} selected</Typography>
          <Typography variant="body2">Daily limit: {capacity.dailyLimit}</Typography>
          <Typography variant="body2">Sent today: {capacity.sentToday}</Typography>
          <Typography variant="body2">Remaining capacity: {capacity.remaining}</Typography>
          {deferredCount > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {canSendNow} can send now. {deferredCount} will be Approved for next send (no
              re-approval needed).
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmBulk(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            disabled={busy || paused || selectedCount === 0}
            onClick={() => void approveAndSendSelected()}
            sx={{ fontWeight: 900 }}
          >
            {deferredCount > 0
              ? `SEND ${canSendNow} NOW (+${deferredCount} later)`
              : `APPROVE & SEND ${selectedCount}`}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!overrideItem} onClose={() => setOverrideItem(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Score below minimum — override?</DialogTitle>
        <DialogContent>
          <Typography>
            Acquisition score {overrideItem?.score ?? 0} is below the campaign minimum (
            {overrideItem?.min ?? '?'}). Sending requires an explicit override.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            {overrideItem?.item.organizationName} → {overrideItem?.item.recipient}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOverrideItem(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            disabled={busy || paused}
            onClick={() => {
              const q = overrideItem?.item;
              setOverrideItem(null);
              if (q) void approveAndSendOne(q, true);
            }}
            sx={{ fontWeight: 900 }}
          >
            OVERRIDE &amp; SEND
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!rejectItem} onClose={() => setRejectItem(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Reject message</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Reason (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectItem(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={busy}
            onClick={() => {
              if (!rejectItem) return;
              void run('Rejected', () =>
                adminApiService.post(`${API}/queue/${encodeURIComponent(rejectItem.queueId)}/reject`, {
                  confirm: true,
                  reason: rejectReason,
                }),
              ).then(() => setRejectItem(null));
            }}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
