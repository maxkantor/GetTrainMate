import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  InputAdornment,
  Skeleton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { adminApiService } from '@/services/adminApiService';
import { pickPagedItems, pickPagedMeta } from '@/utils/adminApiNormalize';
import { AdminNoAccessPage } from './AdminNoAccess';
import styles from './AdminChatsPage.module.css';

interface ChatThreadRow {
  rowKey: string;
  threadId: string;
  matchId?: string;
  userId1: string;
  userId2: string;
  userDisplayName1: string;
  userDisplayName2: string;
  lastMessagePreview: string;
  lastMessageAt?: string;
  unlockedByUserA: boolean;
  unlockedByUserB: boolean;
}

interface ChatMessageRow {
  messageId: string;
  threadId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  isRead?: boolean;
}

interface ParticipantRow {
  userId: string;
  displayName: string;
}

interface ThreadDetailState {
  threadId: string;
  matchId?: string;
  unlockedByUserA: boolean;
  unlockedByUserB: boolean;
  participants: ParticipantRow[];
  messages: ChatMessageRow[];
}

function str(o: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = o[k];
    if (v != null && v !== '') return String(v);
  }
  return '';
}

function normalizeChatThreadRow(raw: unknown, index: number): ChatThreadRow {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const threadId = str(o, 'threadId', 'ThreadId');
  return {
    rowKey: threadId || `chat-${index}`,
    threadId,
    matchId: str(o, 'matchId', 'MatchId') || undefined,
    userId1: str(o, 'userId1', 'UserId1'),
    userId2: str(o, 'userId2', 'UserId2'),
    userDisplayName1: str(o, 'userDisplayName1', 'UserDisplayName1') || str(o, 'userId1', 'UserId1') || '—',
    userDisplayName2: str(o, 'userDisplayName2', 'UserDisplayName2') || str(o, 'userId2', 'UserId2') || '—',
    lastMessagePreview: str(o, 'lastMessagePreview', 'LastMessagePreview'),
    lastMessageAt: str(o, 'lastMessageAt', 'LastMessageAt') || undefined,
    unlockedByUserA: Boolean(o.unlockedByUserA ?? o.UnlockedByUserA),
    unlockedByUserB: Boolean(o.unlockedByUserB ?? o.UnlockedByUserB),
  };
}

function normalizeThreadDetail(raw: unknown): ThreadDetailState | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const threadId = str(o, 'threadId', 'ThreadId');
  if (!threadId) return null;
  const partsRaw = (o.participants ?? o.Participants) as unknown;
  const parts: ParticipantRow[] = Array.isArray(partsRaw)
    ? partsRaw.map((p) => {
        const x = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
        return {
          userId: str(x, 'userId', 'UserId'),
          displayName: str(x, 'displayName', 'DisplayName') || str(x, 'userId', 'UserId'),
        };
      })
    : [];
  const msgRaw = (o.messages ?? o.Messages) as unknown;
  const messages: ChatMessageRow[] = Array.isArray(msgRaw)
    ? msgRaw.map((m) => {
        const x = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>;
        const created = x.createdAt ?? x.CreatedAt;
        return {
          messageId: str(x, 'messageId', 'MessageId'),
          threadId: str(x, 'threadId', 'ThreadId'),
          senderId: str(x, 'senderId', 'SenderId'),
          senderName: str(x, 'senderName', 'SenderName'),
          content: str(x, 'content', 'Content'),
          createdAt:
            created instanceof Date
              ? created.toISOString()
              : typeof created === 'string'
                ? created
                : '',
          isRead: Boolean(x.isRead ?? x.IsRead),
        };
      })
    : [];
  return {
    threadId,
    matchId: str(o, 'matchId', 'MatchId') || undefined,
    unlockedByUserA: Boolean(o.unlockedByUserA ?? o.UnlockedByUserA),
    unlockedByUserB: Boolean(o.unlockedByUserB ?? o.UnlockedByUserB),
    participants: parts,
    messages,
  };
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
  if (p.length === 1 && p[0].length >= 2) return p[0].slice(0, 2).toUpperCase();
  if (p.length === 1 && p[0].length === 1) return p[0].toUpperCase();
  return '?';
}

function formatShortTime(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const AdminChatsPage: React.FC = () => {
  const [items, setItems] = useState<ChatThreadRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageMeta, setPageMeta] = useState({ page: 1, pageSize: 20, totalPages: 1, totalCount: 0 });
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetailState | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ messageId: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 380);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const q = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';
      const res = await adminApiService.get(
        `/api/admin/chats?page=${page}&pageSize=20${q}`
      );
      const raw = pickPagedItems<unknown>(res);
      setItems(raw.map((r, i) => normalizeChatThreadRow(r, i)));
      setPageMeta(pickPagedMeta(res));
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? '';
      if (/forbidden|403/i.test(msg)) setError('FORBIDDEN');
      else setError(msg || 'Failed to load chats');
    } finally {
      setListLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openThread = useCallback(async (threadId: string) => {
    setActiveThreadId(threadId);
    setDrawerOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      const raw = await adminApiService.get(`/api/admin/chats/${encodeURIComponent(threadId)}`);
      setDetail(normalizeThreadDetail(raw));
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to load thread');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setActiveThreadId(null);
    setDetail(null);
    setDeleteTarget(null);
  }, []);

  const copyText = useCallback((text: string) => {
    void navigator.clipboard?.writeText(text);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!activeThreadId || !deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await adminApiService.delete(
        `/api/admin/chats/${encodeURIComponent(activeThreadId)}/messages/${encodeURIComponent(deleteTarget.messageId)}`,
        {}
      );
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.filter((m) => m.messageId !== deleteTarget.messageId),
            }
          : prev
      );
      setDeleteTarget(null);
      void loadList();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to delete message');
    } finally {
      setDeleting(false);
    }
  }, [activeThreadId, deleteTarget, loadList]);

  const participantLabel = useCallback(
    (userId: string) => {
      const p = detail?.participants.find((x) => x.userId === userId);
      return p?.displayName || userId;
    },
    [detail?.participants]
  );

  const unlockChips = useMemo(() => {
    return (row: ChatThreadRow) => {
      const short = (name: string) => {
        const p = name.trim().split(/\s+/)[0];
        return p.length > 10 ? `${p.slice(0, 9)}…` : p;
      };
      const chips: React.ReactNode[] = [];
      if (row.userId1)
        chips.push(
          <Tooltip key="a" title={`${row.userDisplayName1} — ${row.userId1}`}>
            <Chip
              size="small"
              label={`${short(row.userDisplayName1)} · ${row.unlockedByUserA ? 'open' : 'locked'}`}
              color={row.unlockedByUserA ? 'success' : 'default'}
              variant="outlined"
              sx={{ fontSize: '0.65rem', maxWidth: 140 }}
            />
          </Tooltip>
        );
      if (row.userId2)
        chips.push(
          <Tooltip key="b" title={`${row.userDisplayName2} — ${row.userId2}`}>
            <Chip
              size="small"
              label={`${short(row.userDisplayName2)} · ${row.unlockedByUserB ? 'open' : 'locked'}`}
              color={row.unlockedByUserB ? 'success' : 'default'}
              variant="outlined"
              sx={{ fontSize: '0.65rem', maxWidth: 140 }}
            />
          </Tooltip>
        );
      return chips;
    };
  }, []);

  if (error === 'FORBIDDEN') return <AdminNoAccessPage />;

  return (
    <div className={styles.root}>
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.headerRow}>
            <div>
              <h1 className={styles.title}>Chat moderation</h1>
              <p className={styles.subtitle}>
                Review conversations with real names and last-message context. Open a thread to read the full history and
                remove individual messages when required — deletions are audited and cannot be undone.
              </p>
            </div>
            <ForumOutlinedIcon sx={{ fontSize: 48, color: 'rgba(129, 140, 248, 0.55)', opacity: 0.9 }} />
          </div>
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search thread id, user id, match id, or message text…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'rgba(255,255,255,0.35)' }} />
                    </InputAdornment>
                  ),
                }}
              />
            </div>
            <Button variant="contained" onClick={() => loadList()} disabled={listLoading} sx={{ fontWeight: 700 }}>
              Refresh
            </Button>
          </div>
          <div className={styles.meta}>
            {pageMeta.totalCount} thread{pageMeta.totalCount === 1 ? '' : 's'}
            {debouncedSearch ? ` matching “${debouncedSearch}”` : ''} · page {pageMeta.page} of {pageMeta.totalPages}
          </div>
        </div>
      </div>

      {error && error !== 'FORBIDDEN' && (
        <div className={styles.alert} role="alert">
          {error}
        </div>
      )}

      {listLoading && items.length === 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {[1, 2, 3].map((k) => (
            <Skeleton key={k} variant="rounded" height={104} sx={{ borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.06)' }} />
          ))}
        </Box>
      ) : items.length === 0 ? (
        <div className={styles.emptyState}>
          No threads match your filters. Matches create chat threads here once users message each other.
        </div>
      ) : (
        <div className={styles.threadList}>
          {items.map((row) => (
            <button
              key={row.rowKey}
              type="button"
              className={styles.threadCard}
              onClick={() => openThread(row.threadId)}
            >
              <div className={styles.pairAvatars}>
                <Avatar
                  sx={{
                    width: 44,
                    height: 44,
                    fontSize: '0.85rem',
                    bgcolor: 'rgba(99, 102, 241, 0.45)',
                    border: '2px solid rgba(8,10,18,0.9)',
                  }}
                >
                  {initials(row.userDisplayName1)}
                </Avatar>
                <Avatar
                  sx={{
                    width: 44,
                    height: 44,
                    fontSize: '0.85rem',
                    bgcolor: 'rgba(139, 92, 246, 0.45)',
                    border: '2px solid rgba(8,10,18,0.9)',
                  }}
                >
                  {initials(row.userDisplayName2)}
                </Avatar>
              </div>
              <div className={styles.threadMain}>
                <div className={styles.threadNames}>
                  {row.userDisplayName1} <span style={{ opacity: 0.45 }}>&</span> {row.userDisplayName2}
                </div>
                <div className={styles.threadPreview}>
                  {row.lastMessagePreview || 'No message preview stored for this thread.'}
                </div>
              </div>
              <div className={styles.threadSide}>
                <span className={styles.timeLabel}>{formatShortTime(row.lastMessageAt)}</span>
                <div className={styles.chipRow}>{unlockChips(row)}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className={styles.pagination}>
        <button
          type="button"
          className={styles.pageBtn}
          disabled={page <= 1 || listLoading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </button>
        <button
          type="button"
          className={styles.pageBtn}
          disabled={page >= pageMeta.totalPages || listLoading}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeDrawer}
        PaperProps={{
          className: styles.drawerPaper,
          sx: { width: { xs: '100%', sm: 440, md: 480 } },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className={styles.drawerHeader}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
              <div>
                <Typography className={styles.drawerTitle}>Thread</Typography>
                <Typography className={styles.drawerSub}>{activeThreadId}</Typography>
                {detail?.matchId ? (
                  <Typography className={styles.drawerSub} sx={{ mt: 0.5 }}>
                    Match: {detail.matchId}
                  </Typography>
                ) : null}
              </div>
              <IconButton onClick={closeDrawer} size="small" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                <CloseIcon />
              </IconButton>
            </Box>
            {activeThreadId ? (
              <Button
                size="small"
                startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />}
                onClick={() => copyText(activeThreadId)}
                sx={{ mt: 1, color: 'rgba(129, 140, 248, 0.95)' }}
              >
                Copy thread id
              </Button>
            ) : null}
            {detail?.participants?.length ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.5 }}>
                {detail.participants.map((p) => (
                  <Tooltip key={p.userId} title={p.userId}>
                    <Chip label={p.displayName} size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />
                  </Tooltip>
                ))}
              </Box>
            ) : null}
          </div>

          <div className={styles.messagesArea}>
            {detailLoading ? (
              <div className={styles.loadingBox}>
                <CircularProgress size={36} sx={{ color: 'rgba(129, 140, 248, 0.8)' }} />
              </div>
            ) : !detail?.messages.length ? (
              <Typography sx={{ color: 'rgba(255,255,255,0.45)', textAlign: 'center', py: 4 }}>
                No messages in this thread.
              </Typography>
            ) : (
              detail.messages.map((m) => {
                const pIdx = detail.participants.findIndex((p) => p.userId === m.senderId);
                const accent =
                  pIdx === 0
                    ? 'rgba(99, 102, 241, 0.95)'
                    : pIdx === 1
                      ? 'rgba(167, 139, 250, 0.95)'
                      : 'rgba(148, 163, 184, 0.8)';
                return (
                  <div key={m.messageId} className={styles.msgRow}>
                    <div
                      className={`${styles.msgBubble} ${styles.msgBubbleOther}`}
                      style={{ borderLeft: `3px solid ${accent}` }}
                    >
                      {m.content}
                    </div>
                    <div className={styles.msgMeta}>
                      {participantLabel(m.senderId)}
                      {m.createdAt
                        ? ` · ${new Date(m.createdAt).toLocaleString()}`
                        : ''}
                    </div>
                    <div className={styles.msgActions}>
                      <button
                        type="button"
                        className={styles.deleteLink}
                        onClick={() => setDeleteTarget({ messageId: m.messageId })}
                      >
                        Remove message
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Box>
      </Drawer>

      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}>
        <DialogTitle sx={{ fontWeight: 800 }}>Remove message?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
            This permanently deletes the message from the database for compliance or abuse handling. The action is written to
            the audit log.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={() => void confirmDelete()} disabled={deleting}>
            {deleting ? 'Removing…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};
