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
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { OutreachSettings, PanelSharedProps, PartnerQueueItem } from './types';
import {
  API,
  EmptyState,
  PanelSkeleton,
  asArray,
  previewText,
} from './components';
import { adminApiService } from '@/services/adminApiService';

type ApprovalTab = 'needs' | 'sent' | 'blocked';

type RunResult = {
  severity: 'success' | 'error' | 'warning' | 'info';
  title: string;
  detail?: string;
};

function easternTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function isSentToday(item: PartnerQueueItem, todayEt: string): boolean {
  if (!item.sentAt && !item.sesMessageId) return false;
  if (!item.sentAt) return Boolean(item.sesMessageId);
  const at = new Date(item.sentAt);
  if (Number.isNaN(at.getTime())) return Boolean(item.sesMessageId);
  const et = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
  return et === todayEt;
}

export const ApprovalsPanel: React.FC<PanelSharedProps & { initialStatus?: string }> = ({
  onError,
  onNotice,
  refreshKey,
  requestRefresh,
}) => {
  const [queue, setQueue] = useState<PartnerQueueItem[]>([]);
  const [settings, setSettings] = useState<OutreachSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<ApprovalTab>('needs');
  const [editItem, setEditItem] = useState<PartnerQueueItem | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [rejectItem, setRejectItem] = useState<PartnerQueueItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [lastRun, setLastRun] = useState<RunResult | null>(null);
  const [capacity, setCapacity] = useState({ dailyLimit: 10, sentToday: 0, remaining: 10 });
  const [overrideItem, setOverrideItem] = useState<{
    item: PartnerQueueItem;
    score?: number;
    min?: number;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [q, s, dash] = await Promise.all([
        adminApiService.get(`${API}/queue`),
        adminApiService.get(`${API}/settings`),
        adminApiService.get(`${API}/acquisition/dashboard`).catch(() => null),
      ]);
      const queueItems = asArray<PartnerQueueItem>(q);
      setQueue(queueItems);
      setSettings(s as OutreachSettings);
      const d = dash as { settings?: { dailyLimit?: number; sentToday?: number } } | null;
      const limit = Number((s as OutreachSettings)?.dailyLimit ?? d?.settings?.dailyLimit ?? 10) || 10;
      const sentTodayDash = Number(d?.settings?.sentToday ?? 0) || 0;
      const todayEt = easternTodayIso();
      const sentFromQueue = queueItems.filter((item) => isSentToday(item, todayEt)).length;
      const sent = Math.max(sentTodayDash, sentFromQueue);
      setCapacity({ dailyLimit: limit, sentToday: sent, remaining: Math.max(0, limit - sent) });

      const needsIds = queueItems
        .filter((item) => {
          if ((item.followUpNumber ?? 0) > 0) return false;
          if (item.sentAt || item.sesMessageId) return false;
          if (['sent', 'delivered', 'replied', 'queued'].includes(String(item.status || ''))) return false;
          return item.status === 'draft' || item.status === 'approved';
        })
        .map((item) => item.queueId);
      setSelectedIds(new Set(needsIds));
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Failed to load approval queue');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const paused = Boolean(settings?.pauseAllOutreach);

  const needsApproval = useMemo(
    () =>
      queue.filter((q) => {
        if ((q.followUpNumber ?? 0) > 0) return false;
        if (q.sentAt || q.sesMessageId) return false;
        if (['sent', 'delivered', 'replied', 'queued'].includes(String(q.status || ''))) return false;
        return q.status === 'draft' || q.status === 'approved';
      }),
    [queue],
  );

  const recentlySent = useMemo(
    () =>
      queue
        .filter(
          (q) =>
            Boolean(q.sentAt) ||
            Boolean(q.sesMessageId) ||
            q.status === 'sent' ||
            q.status === 'delivered' ||
            q.status === 'replied',
        )
        .sort((a, b) => String(b.sentAt || '').localeCompare(String(a.sentAt || '')))
        .slice(0, 50),
    [queue],
  );

  const deferred = useMemo(
    () =>
      queue.filter(
        (q) =>
          !q.sentAt &&
          (q.status === 'approved_for_next_send' ||
            (q.status === 'scheduled' && (q.followUpNumber ?? 0) > 0)),
      ),
    [queue],
  );

  const blockedRows = useMemo(
    () =>
      queue.filter((q) =>
        ['failed', 'bounced', 'opted_out', 'rejected', 'suppressed'].includes(q.status || ''),
      ),
    [queue],
  );

  const items =
    tab === 'needs' ? needsApproval : tab === 'sent' ? recentlySent : [...deferred, ...blockedRows];

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

  const sendOne = async (q: PartnerQueueItem, confirmOverride = false) => {
    const result = (await adminApiService.post(
      `${API}/queue/${encodeURIComponent(q.queueId)}/approve-and-send`,
      { confirm: true, confirmOverride },
    )) as {
      sent?: boolean;
      alreadySent?: boolean;
      deferred?: boolean;
      error?: string;
      sendError?: string;
      needsOverride?: boolean;
      acquisitionScore?: number;
      minAcquisitionScore?: number;
    };

    if (result?.needsOverride) {
      setOverrideItem({
        item: q,
        score: result.acquisitionScore,
        min: result.minAcquisitionScore,
      });
      return { kind: 'override' as const };
    }
    if (result?.alreadySent) return { kind: 'already' as const };
    if (result?.deferred) return { kind: 'deferred' as const };
    if (result?.sent === true) return { kind: 'sent' as const };
    return {
      kind: 'blocked' as const,
      reason: result?.error || result?.sendError || 'send_blocked',
    };
  };

  const approveAndSendOne = async (q: PartnerQueueItem, confirmOverride = false) => {
    setBusy(true);
    setLastRun(null);
    onError(null);
    onNotice(null);
    try {
      const outcome = await sendOne(q, confirmOverride);
      if (outcome.kind === 'override') return;
      if (outcome.kind === 'sent' || outcome.kind === 'already') {
        setLastRun({
          severity: 'success',
          title: outcome.kind === 'already' ? 'Already sent' : 'Sent',
          detail: `${q.organizationName} → ${q.recipient}`,
        });
        setTab('sent');
      } else if (outcome.kind === 'deferred') {
        setLastRun({
          severity: 'warning',
          title: 'Queued for next send window',
          detail: 'Daily capacity full.',
        });
      } else {
        setLastRun({
          severity: 'error',
          title: 'Send blocked',
          detail: outcome.reason,
        });
      }
      requestRefresh();
      await load();
    } catch (e: unknown) {
      setLastRun({
        severity: 'error',
        title: 'Send failed',
        detail: e instanceof Error ? e.message : 'Action failed',
      });
    } finally {
      setBusy(false);
    }
  };

  const approveAndSendSelected = async () => {
    const ids = [...selectedIds];
    setConfirmBulk(false);
    setBusy(true);
    setLastRun(null);
    onError(null);
    onNotice(null);
    setProgress({ done: 0, total: ids.length });

    let sent = 0;
    let alreadySent = 0;
    let deferredCount = 0;
    let blocked = 0;
    const reasonCounts = new Map<string, number>();

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const row = queue.find((q) => q.queueId === id);
      setProgress({ done: i, total: ids.length });
      try {
        if (!row) {
          blocked += 1;
          reasonCounts.set('missing_row', (reasonCounts.get('missing_row') || 0) + 1);
          continue;
        }
        const outcome = await sendOne(row);
        if (outcome.kind === 'override') {
          blocked += 1;
          reasonCounts.set('needs_override', (reasonCounts.get('needs_override') || 0) + 1);
          setOverrideItem({
            item: row,
            score: undefined,
            min: undefined,
          });
        } else if (outcome.kind === 'sent') sent += 1;
        else if (outcome.kind === 'already') alreadySent += 1;
        else if (outcome.kind === 'deferred') deferredCount += 1;
        else {
          blocked += 1;
          reasonCounts.set(outcome.reason, (reasonCounts.get(outcome.reason) || 0) + 1);
        }
      } catch (e: unknown) {
        blocked += 1;
        const msg = e instanceof Error ? e.message : 'send failed';
        reasonCounts.set(msg, (reasonCounts.get(msg) || 0) + 1);
      }
      setProgress({ done: i + 1, total: ids.length });
    }

    const topReasons = [...reasonCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([r, n]) => `${r} (${n})`)
      .join(' · ');

    const ok = sent + alreadySent;
    setLastRun({
      severity: blocked > 0 && ok === 0 ? 'error' : blocked > 0 ? 'warning' : 'success',
      title:
        ok > 0
          ? `Sent ${sent}${alreadySent ? ` · already ${alreadySent}` : ''}`
          : `Nothing sent (${blocked} blocked)`,
      detail: [
        deferredCount ? `${deferredCount} deferred` : '',
        blocked ? `${blocked} blocked` : '',
        topReasons,
      ]
        .filter(Boolean)
        .join(' · '),
    });

    if (ok > 0) setTab('sent');
    setProgress(null);
    requestRefresh();
    await load();
    setBusy(false);
  };

  const saveEdit = async () => {
    if (!editItem) return;
    setBusy(true);
    try {
      await adminApiService.put(`${API}/queue/${encodeURIComponent(editItem.queueId)}`, {
        subject: editSubject,
        bodyText: editBody,
      });
      setEditItem(null);
      setLastRun({ severity: 'info', title: 'Draft saved — send again to authorize' });
      await load();
    } catch (e: unknown) {
      setLastRun({
        severity: 'error',
        title: 'Save failed',
        detail: e instanceof Error ? e.message : 'Save failed',
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading && queue.length === 0) return <PanelSkeleton rows={5} />;

  const selectedCount = selectedIds.size;

  return (
    <Box>
      {paused && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Emergency pause is on — nothing will send until Settings turns it off.
        </Alert>
      )}

      {lastRun && (
        <Alert
          severity={lastRun.severity}
          sx={{ mb: 2 }}
          onClose={() => setLastRun(null)}
        >
          <Typography sx={{ fontWeight: 800 }}>{lastRun.title}</Typography>
          {lastRun.detail && (
            <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-word' }}>
              {lastRun.detail}
            </Typography>
          )}
        </Alert>
      )}

      <Box
        sx={{
          mb: 2,
          p: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          position: 'sticky',
          top: 0,
          zIndex: 2,
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ md: 'center' }}
          justifyContent="space-between"
        >
          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: 18 }}>Send queue / Human review</Typography>
            <Typography variant="body2" color="text.secondary">
              {capacity.sentToday} sent today · {capacity.remaining} remaining (limit{' '}
              {capacity.dailyLimit}). Automatic sending does not wait for this button.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              size="small"
              variant={tab === 'needs' ? 'contained' : 'outlined'}
              onClick={() => setTab('needs')}
            >
              Ready — Auto ({needsApproval.length})
            </Button>
            <Button
              size="small"
              variant={tab === 'sent' ? 'contained' : 'outlined'}
              onClick={() => setTab('sent')}
            >
              Sent ({recentlySent.length})
            </Button>
            <Button
              size="small"
              variant={tab === 'blocked' ? 'contained' : 'outlined'}
              onClick={() => setTab('blocked')}
            >
              Held ({deferred.length + blockedRows.length})
            </Button>
            {tab === 'needs' && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                  Selected {selectedCount} · Eligible {items.length} · Blocked{' '}
                  {deferred.length + blockedRows.length}
                </Typography>
                <Button size="small" onClick={toggleAll} disabled={items.length === 0 || busy}>
                  {selectedIds.size === items.length && items.length > 0 ? 'Clear' : 'Select all'}
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  disabled={selectedCount === 0 || busy || paused}
                  onClick={() => setConfirmBulk(true)}
                  sx={{ fontWeight: 900, minHeight: 44, px: 2.5 }}
                >
                  SEND {selectedCount || ''}
                </Button>
              </>
            )}
          </Stack>
        </Stack>
        {progress && (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              {progress.total > 0
                ? `Sending approved outreach… ${progress.done}/${progress.total}`
                : 'Sending approved outreach...'}
            </Typography>
            <LinearProgress
              variant={progress.total > 0 && progress.done > 0 ? 'determinate' : 'indeterminate'}
              value={progress.total > 0 ? (100 * progress.done) / progress.total : undefined}
              sx={{ mt: 0.5, height: 8, borderRadius: 1 }}
            />
          </Box>
        )}
      </Box>

      {items.length === 0 ? (
        <EmptyState
          title={tab === 'needs' ? 'Inbox clear' : tab === 'sent' ? 'Nothing sent yet' : 'Nothing held'}
          detail={
            tab === 'needs'
              ? 'Auto-eligible prospects appear here for monitoring. Scheduled acquisition sends them — SEND is a manual override.'
              : tab === 'sent'
                ? 'Successful SES accepts land here and cannot be resent.'
                : 'Deferred capacity and rejected rows show here.'
          }
        />
      ) : (
        <Box sx={{ display: 'grid', gap: 1 }}>
          {items.map((q) => {
            const alreadySent = Boolean(q.sentAt) || Boolean(q.sesMessageId) || q.status === 'sent';
            return (
              <Box
                key={q.queueId}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: tab === 'needs' ? 'auto 1fr auto' : '1fr auto',
                  gap: 1.5,
                  alignItems: 'center',
                  p: 1.5,
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: selectedIds.has(q.queueId) ? 'success.main' : 'divider',
                  bgcolor: alreadySent ? 'action.hover' : 'background.paper',
                }}
              >
                {tab === 'needs' && (
                  <Checkbox
                    checked={selectedIds.has(q.queueId)}
                    onChange={() => toggle(q.queueId)}
                    disabled={busy}
                  />
                )}
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800 }} noWrap>
                    {q.organizationName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {q.recipient}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.25 }} noWrap>
                    {q.subject}
                  </Typography>
                  {alreadySent ? (
                    <Typography variant="caption" color="success.main" sx={{ fontWeight: 700 }}>
                      Sent {q.sentAt ? new Date(q.sentAt).toLocaleString() : '—'}
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {previewText(q.bodyText, 120)}
                    </Typography>
                  )}
                </Box>
                {tab === 'needs' && (
                  <Stack direction="row" spacing={0.75}>
                    <Button
                      size="small"
                      onClick={() => {
                        setEditItem(q);
                        setEditSubject(q.subject || '');
                        setEditBody(q.bodyText || '');
                      }}
                      disabled={busy}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      color="inherit"
                      onClick={() => {
                        setRejectItem(q);
                        setRejectReason('');
                      }}
                      disabled={busy}
                    >
                      Reject
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      disabled={busy || paused}
                      onClick={() => void approveAndSendOne(q)}
                      sx={{ fontWeight: 800 }}
                    >
                      Send
                    </Button>
                  </Stack>
                )}
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditItem(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => void saveEdit()} disabled={busy}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmBulk} onClose={() => !busy && setConfirmBulk(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Send {selectedCount} email{selectedCount === 1 ? '' : 's'}?</DialogTitle>
        <DialogContent>
          <Typography>
            This authorizes SES delivery for the selected drafts. Already-sent addresses are skipped.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1.5 }}>
            Capacity left today: {capacity.remaining}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmBulk(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            disabled={busy || paused || selectedCount === 0}
            onClick={() => void approveAndSendSelected()}
            sx={{ fontWeight: 900 }}
          >
            SEND NOW
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!overrideItem} onClose={() => setOverrideItem(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Low score — override?</DialogTitle>
        <DialogContent>
          <Typography>
            Score {overrideItem?.score ?? '?'} is below minimum ({overrideItem?.min ?? '?'}).
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
          >
            Override &amp; send
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!rejectItem} onClose={() => setRejectItem(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Reject</DialogTitle>
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
              setBusy(true);
              void adminApiService
                .post(`${API}/queue/${encodeURIComponent(rejectItem.queueId)}/reject`, {
                  confirm: true,
                  reason: rejectReason,
                })
                .then(async () => {
                  setRejectItem(null);
                  setLastRun({ severity: 'info', title: 'Rejected' });
                  await load();
                })
                .catch((e: unknown) => {
                  setLastRun({
                    severity: 'error',
                    title: 'Reject failed',
                    detail: e instanceof Error ? e.message : 'Reject failed',
                  });
                })
                .finally(() => setBusy(false));
            }}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
