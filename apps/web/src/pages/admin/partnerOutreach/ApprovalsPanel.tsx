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

interface Props extends PanelSharedProps {
  initialStatus?: string;
}

export const ApprovalsPanel: React.FC<Props> = ({
  onError,
  onNotice,
  refreshKey,
  requestRefresh,
  initialStatus = 'draft',
}) => {
  const [queue, setQueue] = useState<PartnerQueueItem[]>([]);
  const [prospects, setProspects] = useState<PartnerProspect[]>([]);
  const [settings, setSettings] = useState<OutreachSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewItem, setViewItem] = useState<PartnerQueueItem | null>(null);
  const [editItem, setEditItem] = useState<PartnerQueueItem | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [confirmSend, setConfirmSend] = useState<PartnerQueueItem | null>(null);
  const [rejectItem, setRejectItem] = useState<PartnerQueueItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus || 'draft');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialStatus) setStatusFilter(initialStatus);
  }, [initialStatus]);

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const [q, p, s] = await Promise.all([
        adminApiService.get(`${API}/queue`),
        adminApiService.get(`${API}/prospects`),
        adminApiService.get(`${API}/settings`),
      ]);
      setQueue(asArray<PartnerQueueItem>(q));
      setProspects(asArray<PartnerProspect>(p));
      setSettings(s as OutreachSettings);
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

  const mode = (settings?.outreachMode || 'off').toLowerCase();
  const sendEnabled = settings?.sendEnabled !== false;
  const canEmphasizeSend = mode === 'live' && sendEnabled;

  const allDrafts = useMemo(() => queue.filter((q) => q.status === 'draft'), [queue]);

  const items = useMemo(() => {
    if (statusFilter === 'all-drafts') return allDrafts;
    if (statusFilter === 'draft') {
      return queue.filter((q) => q.status === 'draft' && (q.followUpNumber == null || q.followUpNumber === 0));
    }
    return queue.filter((q) => q.status === statusFilter);
  }, [queue, statusFilter, allDrafts]);

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
      await fn();
      onNotice(label);
      requestRefresh();
      await load();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editItem) return;
    await run('Draft updated — re-approve required', () =>
      adminApiService.put(`${API}/queue/${encodeURIComponent(editItem.queueId)}`, {
        subject: editSubject,
        bodyText: editBody,
      }),
    );
    setEditItem(null);
  };

  if (loading && queue.length === 0) return <PanelSkeleton rows={5} />;

  return (
    <Box>
      {!canEmphasizeSend && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {mode === 'off'
            ? 'Outreach is OFF — approve queues for later send.'
            : mode === 'test'
              ? 'Outreach is TEST — Approve & Send only targets configured test recipients when the send gate is on.'
              : 'Sending is gated — approve queues; Approve & Send is available when LIVE and send is enabled.'}
        </Alert>
      )}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }} alignItems="center">
        <Button
          size="small"
          variant={statusFilter === 'draft' ? 'contained' : 'outlined'}
          onClick={() => setStatusFilter('draft')}
        >
          Initial drafts ({queue.filter((q) => q.status === 'draft' && (q.followUpNumber == null || q.followUpNumber === 0)).length})
        </Button>
        <Button
          size="small"
          variant={statusFilter === 'all-drafts' ? 'contained' : 'outlined'}
          onClick={() => setStatusFilter('all-drafts')}
        >
          All drafts ({allDrafts.length})
        </Button>
        <Button
          size="small"
          variant={statusFilter === 'approved' ? 'contained' : 'outlined'}
          onClick={() => setStatusFilter('approved')}
        >
          Approved
        </Button>
        <Button
          size="small"
          variant={statusFilter === 'scheduled' ? 'contained' : 'outlined'}
          onClick={() => setStatusFilter('scheduled')}
        >
          Scheduled
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={toggleAll} disabled={items.length === 0}>
          {selectedIds.size === items.length && items.length > 0 ? 'Clear selection' : 'Select all'}
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={selectedIds.size === 0 || busy}
          onClick={() =>
            void run(`Approved ${selectedIds.size} recipient(s)`, () =>
              adminApiService.post(`${API}/queue/bulk-approve`, {
                queueIds: [...selectedIds],
                confirm: true,
              }),
            )
          }
        >
          Approve selected ({selectedIds.size})
        </Button>
      </Stack>

      {statusFilter === 'all-drafts' ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Showing all draft queue items including follow-ups.
        </Alert>
      ) : null}

      {items.length === 0 ? (
        <EmptyState title="Nothing to approve" detail="Drafts will appear here after discovery prepares messages." />
      ) : (
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            {items.map((q) => {
              const prospect = q.prospectId ? prospectMap.get(q.prospectId) : undefined;
              const market = prospect ? marketLabel(prospect) : '';
              const source = prospect?.discoverySource || prospect?.sourceUrl;
              return (
                <Box
                  key={q.queueId}
                  sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor: selectedIds.has(q.queueId) ? 'primary.main' : 'divider',
                    borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Checkbox
                      checked={selectedIds.has(q.queueId)}
                      onChange={() => toggle(q.queueId)}
                      disabled={q.status !== 'draft'}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography sx={{ fontWeight: 700 }}>{q.organizationName}</Typography>
                        <StatusChip label={q.status} color={q.status === 'draft' ? 'warning' : 'default'} />
                        {prospect && <StatusChip label={formatProspectType(prospect)} />}
                        {market && market !== '—' && <StatusChip label={market} />}
                        {prospect && <StatusChip label={`Score ${prospectScore(prospect)}`} color="info" />}
                        {source && <StatusChip label={`Source ${source}`} />}
                        {(q.followUpNumber ?? 0) > 0 && <StatusChip label={`Follow-up ${q.followUpNumber}`} />}
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {q.recipient}
                      </Typography>
                      <Typography sx={{ fontWeight: 600, mt: 0.75 }}>{q.subject}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {previewText(q.bodyText, 220)}
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                        <Button size="small" onClick={() => setViewItem(q)}>
                          View
                        </Button>
                        {q.status === 'draft' && (
                          <>
                            <Button
                              size="small"
                              onClick={() => {
                                setEditItem(q);
                                setEditSubject(q.subject);
                                setEditBody(q.bodyText);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              disabled={busy}
                              onClick={() => {
                                if (canEmphasizeSend) setConfirmSend(q);
                                else {
                                  void run('Approved', () =>
                                    adminApiService.post(`${API}/queue/${encodeURIComponent(q.queueId)}/approve`, {
                                      confirm: true,
                                    }),
                                  );
                                }
                              }}
                            >
                              {canEmphasizeSend ? 'Approve & Send' : 'Approve'}
                            </Button>
                            {canEmphasizeSend && (
                              <Button
                                size="small"
                                variant="outlined"
                                disabled={busy}
                                onClick={() =>
                                  void run('Approved', () =>
                                    adminApiService.post(`${API}/queue/${encodeURIComponent(q.queueId)}/approve`, {
                                      confirm: true,
                                    }),
                                  )
                                }
                              >
                                Approve only
                              </Button>
                            )}
                            {!canEmphasizeSend && mode === 'off' && (
                              <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                                Outreach is OFF — approve queues for later send
                              </Typography>
                            )}
                            <Button size="small" color="error" onClick={() => { setRejectItem(q); setRejectReason(''); }}>
                              Reject
                            </Button>
                          </>
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Box>
      )}

      <Dialog open={!!viewItem} onClose={() => setViewItem(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Message preview</DialogTitle>
        <DialogContent>
          {viewItem && (
            <>
              <Typography sx={{ fontWeight: 700 }}>{viewItem.organizationName}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {viewItem.recipient}
              </Typography>
              <Typography sx={{ fontWeight: 600 }}>{viewItem.subject}</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>
                {viewItem.bodyText}
              </Typography>
              {viewItem.partnerUrl && (
                <Typography variant="caption" display="block" sx={{ mt: 1.5 }}>
                  {viewItem.partnerUrl}
                </Typography>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewItem(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editItem} onClose={() => setEditItem(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit draft</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Saving invalidates prior approval. You must approve again before send.
          </Alert>
          <TextField
            fullWidth
            label="Subject"
            value={editSubject}
            onChange={(e) => setEditSubject(e.target.value)}
            sx={{ mb: 2, mt: 0.5 }}
          />
          <TextField
            fullWidth
            multiline
            minRows={8}
            label="Body"
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditItem(null)}>Cancel</Button>
          <Button variant="contained" disabled={busy} onClick={() => void saveEdit()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirmSend} onClose={() => setConfirmSend(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Approve & send?</DialogTitle>
        <DialogContent>
          <Typography>
            This will approve and attempt to send to <b>{confirmSend?.recipient}</b>. Confirm only if the message and recipient are correct.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmSend(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            disabled={busy}
            onClick={() => {
              if (!confirmSend) return;
              const id = confirmSend.queueId;
              setConfirmSend(null);
              void run('Approved and send attempted', () =>
                adminApiService.post(`${API}/queue/${encodeURIComponent(id)}/approve-and-send`, { confirm: true }),
              );
            }}
          >
            Confirm Approve & Send
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!rejectItem} onClose={() => setRejectItem(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Reject draft</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Reason (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            sx={{ mt: 0.5 }}
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
              const id = rejectItem.queueId;
              setRejectItem(null);
              void run('Rejected', () =>
                adminApiService.post(`${API}/queue/${encodeURIComponent(id)}/reject`, {
                  confirm: true,
                  reason: rejectReason || undefined,
                }),
              );
            }}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
