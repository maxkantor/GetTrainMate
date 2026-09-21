import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { PanelSharedProps, PartnerMessage, PartnerProspect, PartnerThread } from './types';
import {
  API,
  EmptyState,
  PanelSkeleton,
  StatusChip,
  asArray,
  formatDate,
  previewText,
} from './components';
import { adminApiService } from '@/services/adminApiService';

type InboxCategory = 'all' | 'needs_response' | 'waiting' | 'other';

function categorize(
  thread: PartnerThread,
  messages: PartnerMessage[] | undefined,
): InboxCategory {
  if (!messages || messages.length === 0) return 'other';
  const last = [...messages].sort(
    (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
  ).at(-1);
  if (!last) return 'other';
  const dir = (last.direction || '').toLowerCase();
  if (dir === 'inbound' || dir === 'in') return 'needs_response';
  if (dir === 'outbound' || dir === 'out') return 'waiting';
  return 'other';
}

export const InboxPanel: React.FC<PanelSharedProps> = ({
  onError,
  onNotice,
  refreshKey,
  requestRefresh,
}) => {
  const [threads, setThreads] = useState<PartnerThread[]>([]);
  const [prospects, setProspects] = useState<PartnerProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<InboxCategory>('all');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<PartnerMessage[]>([]);
  const [threadMeta, setThreadMeta] = useState<PartnerThread | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [confirmReply, setConfirmReply] = useState(false);
  const [messageCache, setMessageCache] = useState<Record<string, PartnerMessage[]>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, p] = await Promise.all([
        adminApiService.get(`${API}/threads`),
        adminApiService.get(`${API}/prospects`),
      ]);
      setThreads(asArray<PartnerThread>(t));
      setProspects(asArray<PartnerProspect>(p));
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Failed to load inbox');
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

  const openThread = async (threadId: string) => {
    setActiveId(threadId);
    setReplyText('');
    setLoadingThread(true);
    onError(null);
    try {
      const data = await adminApiService.get(`${API}/threads/${encodeURIComponent(threadId)}`);
      const msgs = asArray<PartnerMessage>(data?.messages);
      const thread = (data?.thread as PartnerThread) || threads.find((t) => t.threadId === threadId) || null;
      setMessages(msgs);
      setThreadMeta(thread);
      setMessageCache((prev) => ({ ...prev, [threadId]: msgs }));
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Failed to load thread');
      setMessages([]);
    } finally {
      setLoadingThread(false);
    }
  };

  const filtered = useMemo(() => {
    if (category === 'all') return threads;
    return threads.filter((t) => {
      const msgs = messageCache[t.threadId];
      // Without loaded messages, use heuristics from messageCount / lastMessage only for "all"
      if (!msgs) {
        if (category === 'needs_response') return (t.messageCount ?? 0) > 0;
        return category === 'other';
      }
      return categorize(t, msgs) === category;
    });
  }, [threads, category, messageCache]);

  const activeProspectId = threadMeta?.prospectId || threads.find((t) => t.threadId === activeId)?.prospectId;
  const activeProspect = activeProspectId ? prospectMap.get(activeProspectId) : undefined;

  const sendReply = async () => {
    if (!activeId || !replyText.trim()) return;
    setBusy(true);
    onError(null);
    try {
      await adminApiService.post(`${API}/threads/${encodeURIComponent(activeId)}/reply`, {
        bodyText: replyText.trim(),
        confirmSend: true,
      });
      onNotice('Reply sent');
      setConfirmReply(false);
      setReplyText('');
      requestRefresh();
      await openThread(activeId);
      await load();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Reply failed');
    } finally {
      setBusy(false);
    }
  };

  const prospectAction = async (action: 'interested' | 'convert-partner') => {
    if (!activeProspectId) return;
    setBusy(true);
    onError(null);
    try {
      await adminApiService.post(
        `${API}/prospects/${encodeURIComponent(activeProspectId)}/${action}`,
        {},
      );
      onNotice(action === 'interested' ? 'Marked interested' : 'Converted to partner');
      requestRefresh();
      await load();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading && threads.length === 0) return <PanelSkeleton rows={5} />;

  return (
    <Box>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {(
          [
            ['all', 'All'],
            ['needs_response', 'Needs response'],
            ['waiting', 'Waiting on them'],
            ['other', 'Other'],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            size="small"
            variant={category === key ? 'contained' : 'outlined'}
            onClick={() => setCategory(key)}
          >
            {label}
          </Button>
        ))}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '320px 1fr' },
          gap: 2,
          minHeight: 420,
        }}
      >
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'auto', maxHeight: '70vh' }}>
          {filtered.length === 0 ? (
            <Box sx={{ p: 2 }}>
              <EmptyState title="No threads" detail="Partner replies will appear here." />
            </Box>
          ) : (
            filtered.map((t) => {
              const p = t.prospectId ? prospectMap.get(t.prospectId) : undefined;
              const cat = categorize(t, messageCache[t.threadId]);
              return (
                <Box
                  key={t.threadId}
                  onClick={() => void openThread(t.threadId)}
                  sx={{
                    p: 1.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    cursor: 'pointer',
                    bgcolor: activeId === t.threadId ? 'rgba(99,102,241,0.12)' : 'transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                  }}
                >
                  <Typography sx={{ fontWeight: 600 }} noWrap>
                    {p?.organizationName || t.subject || 'Thread'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" noWrap>
                    {previewText(t.subject, 60)}
                  </Typography>
                  <Stack direction="row" spacing={0.75} sx={{ mt: 0.5 }} alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(t.lastMessageAt)}
                    </Typography>
                    {messageCache[t.threadId] && <StatusChip label={cat.replace('_', ' ')} />}
                  </Stack>
                </Box>
              );
            })
          )}
        </Box>

        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, minHeight: 420 }}>
          {!activeId ? (
            <EmptyState title="Select a thread" detail="Open a conversation to read and reply." />
          ) : loadingThread ? (
            <PanelSkeleton rows={4} />
          ) : (
            <>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {activeProspect?.organizationName || threadMeta?.subject || 'Conversation'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {threadMeta?.subject}
                  </Typography>
                </Box>
                {activeProspectId && (
                  <Stack direction="row" spacing={1}>
                    <Button size="small" disabled={busy} onClick={() => void prospectAction('interested')}>
                      Mark interested
                    </Button>
                    <Button size="small" disabled={busy} onClick={() => void prospectAction('convert-partner')}>
                      Convert partner
                    </Button>
                  </Stack>
                )}
              </Stack>
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: 'grid', gap: 1.25, maxHeight: '45vh', overflow: 'auto', mb: 2 }}>
                {messages.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No messages in this thread.
                  </Typography>
                ) : (
                  messages.map((m) => {
                    const inbound = (m.direction || '').toLowerCase().startsWith('in');
                    return (
                      <Box
                        key={m.messageId}
                        sx={{
                          p: 1.25,
                          borderRadius: 1.5,
                          bgcolor: inbound ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)',
                          border: '1px solid',
                          borderColor: 'divider',
                          ml: inbound ? 0 : 4,
                          mr: inbound ? 4 : 0,
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {inbound ? 'Inbound' : 'Outbound'} · {formatDate(m.createdAt)} · {m.from || '—'}
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>
                          {m.bodyText || '(empty)'}
                        </Typography>
                      </Box>
                    );
                  })
                )}
              </Box>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Reply"
                placeholder="Write a reply — nothing is sent until you confirm."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
              <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
                <Button
                  variant="contained"
                  disabled={!replyText.trim() || busy}
                  onClick={() => setConfirmReply(true)}
                >
                  Send reply
                </Button>
              </Stack>
            </>
          )}
        </Box>
      </Box>

      <Dialog open={confirmReply} onClose={() => setConfirmReply(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm send reply?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">This will send your reply to the partner thread. Nothing is fabricated or auto-filled.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmReply(false)}>Cancel</Button>
          <Button variant="contained" disabled={busy} onClick={() => void sendReply()}>
            Confirm send
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
