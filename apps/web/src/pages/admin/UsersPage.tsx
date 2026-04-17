import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography as MuiTypography,
} from '@mui/material';
import { adminApiService } from '@/services/adminApiService';
import { pickPagedItems, pickPagedMeta, normalizeAdminUserRow, normalizeAdminUserDetail } from '@/utils/adminApiNormalize';
import { AdminNoAccessPage } from './AdminNoAccess';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import styles from './UsersPage.module.css';

interface User {
  userId: string;
  email: string;
  name: string;
  status: string;
  plan?: string;
  createdAt: string;
  city?: string;
  state?: string;
  credits?: number;
  lifetimeEarned?: number;
  unlimitedDiscovery?: boolean;
}

/** GET /api/admin/credits/users/{id}/transactions (camelCase JSON). */
interface CreditAuditRow {
  id: string;
  type: string;
  creditsDelta: number;
  reason: string;
  refId?: string | null;
  createdAt: string;
  balanceBefore?: number | null;
  balanceAfter?: number | null;
}

function normalizeCreditTx(raw: Record<string, unknown>): CreditAuditRow {
  const n = (k: string) => raw[k];
  return {
    id: String(n('id') ?? ''),
    type: String(n('type') ?? ''),
    creditsDelta: Number(n('creditsDelta') ?? 0),
    reason: String(n('reason') ?? ''),
    refId: (n('refId') as string | null | undefined) ?? null,
    createdAt: String(n('createdAt') ?? ''),
    balanceBefore: n('balanceBefore') != null ? Number(n('balanceBefore')) : null,
    balanceAfter: n('balanceAfter') != null ? Number(n('balanceAfter')) : null,
  };
}

/** Mirrors API DiscoverLifecycleDto (camelCase JSON). */
interface DiscoverLifecycleFlags {
  canReviewSkippedProfiles: boolean;
  canReviewLikedProfiles: boolean;
  canReplayDiscoverQueue: boolean;
  canRewindLastSkip: boolean;
  canRecycleSkippedProfiles: boolean;
}

function userStatusBadgeVariant(status: string): 'success' | 'error' | 'warning' | 'neutral' {
  const s = (status || '').toLowerCase();
  if (s === 'active') return 'success';
  if (s === 'banned') return 'error';
  if (s === 'deleted') return 'warning';
  return 'neutral';
}

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailUser, setDetailUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [grantAmount, setGrantAmount] = useState('10');
  const [grantLoading, setGrantLoading] = useState(false);
  const [discoverLifecycle, setDiscoverLifecycle] = useState<DiscoverLifecycleFlags | null>(null);
  const [discoverLifecycleLoading, setDiscoverLifecycleLoading] = useState(false);
  const [confirmReset, setConfirmReset] = useState<
    null | 'skipped' | 'sent' | 'discover' | 'discoverMatches'
  >(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);
  const [creditTx, setCreditTx] = useState<CreditAuditRow[]>([]);
  const [creditTxLoading, setCreditTxLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '50',
      });
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (planFilter) params.append('plan', planFilter);

      const response = await adminApiService.get(`/api/admin/users?${params}`);
      const rows = pickPagedItems<Record<string, unknown>>(response).map((r) => normalizeAdminUserRow(r));
      setUsers(rows);
      const meta = pickPagedMeta(response);
      setTotalPages(meta.totalPages);
      setTotalCount(meta.totalCount);
    } catch (err: unknown) {
      const status = (err as Error & { status?: number })?.status;
      const msg = (err as Error)?.message ?? '';
      if (status === 403 || /forbidden/i.test(msg)) {
        setError('FORBIDDEN');
        return;
      }
      setError(msg || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, planFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleRowClick = async (row: User) => {
    setSelectedUser(row);
    setDetailOpen(true);
    setDetailLoading(true);
    setResetSuccess(null);
    setDiscoverLifecycle(null);
    setCreditTx([]);
    setCreditTxLoading(true);
    try {
      const user = await adminApiService.get(`/api/admin/users/${row.userId}`);
      setDetailUser({ ...row, ...normalizeAdminUserDetail(user) });
    } catch {
      setDetailUser(row);
    } finally {
      setDetailLoading(false);
    }
    try {
      const rows = await adminApiService.get(
        `/api/admin/credits/users/${encodeURIComponent(row.userId)}/transactions?limit=40`
      );
      const list = Array.isArray(rows) ? rows : [];
      setCreditTx(list.map((r) => normalizeCreditTx(r as Record<string, unknown>)));
    } catch {
      setCreditTx([]);
    } finally {
      setCreditTxLoading(false);
    }
    setDiscoverLifecycleLoading(true);
    try {
      const lc = await adminApiService.get(
        `/api/admin/discover/users/${encodeURIComponent(row.userId)}/discover-lifecycle`
      );
      setDiscoverLifecycle(lc as DiscoverLifecycleFlags);
    } catch {
      setDiscoverLifecycle(null);
    } finally {
      setDiscoverLifecycleLoading(false);
    }
  };

  const detailIsDeleted = (detailUser?.status ?? '').toLowerCase() === 'deleted';

  const patchDiscoverLifecycle = async (patch: Partial<DiscoverLifecycleFlags>) => {
    if (!detailUser || detailIsDeleted) return;
    setDiscoverLifecycleLoading(true);
    setError(null);
    try {
      const updated = await adminApiService.put(
        `/api/admin/discover/users/${encodeURIComponent(detailUser.userId)}/discover-lifecycle`,
        patch
      );
      setDiscoverLifecycle(updated as DiscoverLifecycleFlags);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to update discover lifecycle');
    } finally {
      setDiscoverLifecycleLoading(false);
    }
  };

  const handleBan = async (userId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm('Are you sure you want to ban this user?')) return;
    setActionLoading(userId);
    try {
      await adminApiService.post(`/api/admin/users/${userId}/ban`, { reason: 'Admin action' });
      await loadUsers();
      if (detailUser?.userId === userId) setDetailUser((u) => (u ? { ...u, status: 'banned' } : u));
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to ban user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnban = async (userId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm('Are you sure you want to unban this user?')) return;
    setActionLoading(userId);
    try {
      await adminApiService.post(`/api/admin/users/${userId}/unban`, { reason: 'Admin action' });
      await loadUsers();
      if (detailUser?.userId === userId) setDetailUser((u) => (u ? { ...u, status: 'active' } : u));
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to unban user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string, displayName: string) => {
    if (
      !window.confirm(
        `Close account for ${displayName || userId}? They are signed out and cannot use the app; this row stays in CRM with status deleted (Cognito removed when possible).`
      )
    ) {
      return;
    }
    setDeleteUserLoading(true);
    setError(null);
    try {
      await adminApiService.delete(`/api/admin/users/${encodeURIComponent(userId)}`);
      await loadUsers();
      try {
        const user = await adminApiService.get(`/api/admin/users/${encodeURIComponent(userId)}`);
        const merged = normalizeAdminUserDetail(user as Record<string, unknown>);
        setDetailUser((prev) =>
          prev?.userId === userId ? { ...prev, ...merged, status: merged.status || 'deleted' } : prev
        );
      } catch {
        setDetailUser((prev) => (prev?.userId === userId ? { ...prev, status: 'deleted' } : prev));
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to delete user');
    } finally {
      setDeleteUserLoading(false);
    }
  };

  const handleGrantCredits = async (userId: string) => {
    const n = parseInt(grantAmount, 10);
    if (!Number.isFinite(n) || n < 1) {
      setError('Enter a positive credit amount');
      return;
    }
    setGrantLoading(true);
    setError(null);
    try {
      await adminApiService.post('/api/admin/credits/grant', {
        userId,
        amount: n,
        reason: 'ADMIN_UI',
      });
      await loadUsers();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to grant credits');
    } finally {
      setGrantLoading(false);
    }
  };

  const errStatus = (err: unknown) => (err as Error & { status?: number })?.status;

  const formatDiscoverResetSummary = (data: unknown): string => {
    if (!data || typeof data !== 'object') return 'Reset completed. Ask the user to refresh the Discover page.';
    const d = data as Record<string, unknown>;
    const n = (k: string) => (typeof d[k] === 'number' ? (d[k] as number) : 0);
    const parts: string[] = [];
    const add = (key: string, label: string) => {
      const v = n(key);
      if (v > 0) parts.push(`${v} ${label}`);
    };
    add('skippedInteractionsRemoved', 'skipped interactions');
    add('outgoingSentOrMatchedRemoved', 'sent/matched interactions');
    add('allOutgoingInteractionsRemoved', 'outgoing interactions');
    add('reverseInteractionsRemoved', 'incoming interactions');
    add('discoverPassesRemoved', 'discover passes');
    add('pendingNonMutualMatchesRemoved', 'pending (non-mutual) matches');
    add('matchesRemoved', 'matches');
    add('chatThreadsRemoved', 'chat threads');
    const summary = parts.length > 0 ? `Removed: ${parts.join(', ')}.` : 'Done.';
    return `${summary} Ask the user to refresh Discover (or reopen the app).`;
  };

  const runReset = async (path: string, body?: Record<string, unknown>) => {
    if (!detailUser || detailIsDeleted) return;
    setResetBusy(true);
    setError(null);
    setResetSuccess(null);
    try {
      const data = await adminApiService.post(
        `/api/admin/discover/users/${encodeURIComponent(detailUser.userId)}/${path}`,
        body
      );
      setResetSuccess(formatDiscoverResetSummary(data));
      setConfirmReset(null);
      await loadUsers();
    } catch (err: unknown) {
      if (errStatus(err) === 403) setError('FORBIDDEN');
      else setError((err as Error)?.message || 'Reset failed');
    } finally {
      setResetBusy(false);
    }
  };

  const handleExport = () => {
    const headers = ['User ID', 'Email', 'Name', 'Status', 'Plan', 'Created'];
    const rows = users.map((u) => [
      u.userId,
      u.email,
      u.name,
      u.status,
      u.plan || '',
      new Date(u.createdAt).toLocaleDateString(),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<User>[] = [
    {
      key: 'userId',
      header: 'User ID',
      render: (r) => (
        <span className={styles.mono}>{(r.userId || '').length > 12 ? `${(r.userId || '').slice(0, 12)}…` : r.userId || '—'}</span>
      ),
    },
    { key: 'email', header: 'Email' },
    { key: 'name', header: 'Name' },
    {
      key: 'location',
      header: 'City / State',
      render: (r) => [r.city, r.state].filter(Boolean).join(', ') || '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge variant={userStatusBadgeVariant(r.status)}>{r.status}</Badge>,
    },
    { key: 'plan', header: 'Plan', render: (r) => r.plan || '—' },
    { key: 'credits', header: 'Credits', render: (r) => (r.credits != null ? String(r.credits) : '—') },
    { key: 'createdAt', header: 'Created', render: (r) => new Date(r.createdAt).toLocaleDateString() },
  ];

  if (error === 'FORBIDDEN') return <AdminNoAccessPage />;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Users CRM</h1>
          <p className={styles.subtitle}>
            {loading ? '…' : `${totalCount} user${totalCount === 1 ? '' : 's'} in this view`}
          </p>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={handleExport} disabled={users.length === 0}>
            Export CSV
          </Button>
        </div>
      </div>

      {error && (
        <div className={styles.alert} role="alert">
          {error}
          <button type="button" className={styles.dismiss} onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}
      {resetSuccess && (
        <div className={styles.alertSuccess} role="status">
          {resetSuccess}
          <button type="button" className={styles.dismiss} onClick={() => setResetSuccess(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      <div className={styles.filters}>
        <input
          type="search"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.search}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={styles.select}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
          <option value="inactive">Inactive</option>
          <option value="deleted">Deleted</option>
        </select>
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className={styles.select}>
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={users}
        keyField="userId"
        onRowClick={handleRowClick}
        emptyMessage="No users found"
        loading={loading}
      />

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className={styles.pageInfo}>
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      )}

      {/* Detail panel */}
      <aside className={`${styles.detailPanel} ${detailOpen ? styles.open : ''}`}>
        <div className={styles.detailHeader}>
          <h2>User details</h2>
          <button type="button" className={styles.closeBtn} onClick={() => setDetailOpen(false)} aria-label="Close">×</button>
        </div>
        {detailLoading ? (
          <div className={styles.detailLoading}>Loading…</div>
        ) : detailUser ? (
          <div className={styles.detailContent}>
            <dl className={styles.detailList}>
              <dt>User ID</dt>
              <dd className={styles.mono}>{detailUser.userId}</dd>
              <dt>Email</dt>
              <dd>{detailUser.email}</dd>
              <dt>Name</dt>
              <dd>{detailUser.name}</dd>
              <dt>Status</dt>
              <dd><Badge variant={userStatusBadgeVariant(detailUser.status)}>{detailUser.status}</Badge></dd>
              <dt>Plan</dt>
              <dd>{detailUser.plan || '—'}</dd>
              <dt>City / State</dt>
              <dd>{[detailUser.city, detailUser.state].filter(Boolean).join(', ') || '—'}</dd>
              <dt>Credits</dt>
              <dd>
                {detailUser.credits ?? '—'}
                {detailUser.lifetimeEarned != null ? ` (lifetime ${detailUser.lifetimeEarned})` : ''}
                {detailUser.unlimitedDiscovery ? ' · Unlimited discovery' : ''}
              </dd>
              <dt>Recent credit transactions</dt>
              <dd style={{ margin: 0, maxWidth: '100%' }}>
                {creditTxLoading ? (
                  <span className={styles.detailLoading}>Loading…</span>
                ) : creditTx.length === 0 ? (
                  <span className={styles.lifecycleHint}>No rows (or not available).</span>
                ) : (
                  <div className={styles.creditTxWrap}>
                    <table className={styles.creditTxTable}>
                      <thead>
                        <tr>
                          <th>When</th>
                          <th>Δ</th>
                          <th>After</th>
                          <th>Reason</th>
                          <th>Ref</th>
                        </tr>
                      </thead>
                      <tbody>
                        {creditTx.map((tx) => (
                          <tr key={tx.id || `${tx.createdAt}-${tx.reason}`}>
                            <td>{tx.createdAt ? new Date(tx.createdAt).toLocaleString() : '—'}</td>
                            <td>{tx.creditsDelta}</td>
                            <td>{tx.balanceAfter ?? '—'}</td>
                            <td>{tx.reason || tx.type || '—'}</td>
                            <td className={styles.mono}>{tx.refId || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </dd>
              <dt>Created</dt>
              <dd>{new Date(detailUser.createdAt).toLocaleString()}</dd>
            </dl>
            <div className={styles.lifecycleSection}>
              <h3 className={styles.lifecycleTitle}>Discover lifecycle</h3>
              <p className={styles.lifecycleHint}>
                Per-user overrides. Liked and matched profiles never appear as new in Discover; recycled skips show
                &quot;Seen before&quot; when enabled.
                {detailIsDeleted ? ' Closed accounts: view only.' : ''}
              </p>
              {discoverLifecycleLoading && !discoverLifecycle ? (
                <p className={styles.detailLoading}>Loading flags…</p>
              ) : discoverLifecycle ? (
                <ul className={styles.lifecycleList}>
                  {(
                    [
                      ['canReviewSkippedProfiles', 'Skipped tab / list API'] as const,
                      ['canReviewLikedProfiles', 'Sent requests tab / list API'] as const,
                      ['canReplayDiscoverQueue', 'Replay discover queue (show skips again, labeled Seen before)'] as const,
                      ['canRewindLastSkip', 'Allow rewind last skip'] as const,
                      ['canRecycleSkippedProfiles', 'Recycle skipped profiles in Discover (Seen before)'] as const,
                    ] as const
                  ).map(([key, label]) => (
                    <li key={key} className={styles.lifecycleRow}>
                      <label className={styles.lifecycleLabel}>
                        <input
                          type="checkbox"
                          checked={discoverLifecycle[key]}
                          disabled={discoverLifecycleLoading || detailIsDeleted}
                          onChange={(e) => void patchDiscoverLifecycle({ [key]: e.target.checked })}
                        />
                        <span>{label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.lifecycleHint}>Could not load lifecycle flags (check admin auth).</p>
              )}
            </div>

            <div className={styles.resetSection}>
              <h3 className={styles.lifecycleTitle}>Discover & relationship reset</h3>
              <p className={styles.lifecycleHint}>
                Clears stored interaction state for this user. Does not remove profile or credits unless you use the
                advanced option (matches/chats).
                {detailIsDeleted ? ' Not available for closed accounts.' : ''}
              </p>
              <div className={styles.resetActions}>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!detailUser || resetBusy || detailIsDeleted}
                  onClick={() => setConfirmReset('skipped')}
                >
                  Reset skipped
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!detailUser || resetBusy || detailIsDeleted}
                  onClick={() => setConfirmReset('sent')}
                >
                  Reset sent / liked
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!detailUser || resetBusy || detailIsDeleted}
                  onClick={() => setConfirmReset('discover')}
                >
                  Reset discover state
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!detailUser || resetBusy || detailIsDeleted}
                  onClick={() => setConfirmReset('discoverMatches')}
                >
                  Reset discover + matches/chats
                </Button>
              </div>
            </div>

            <div className={styles.detailActions}>
              {detailIsDeleted ? (
                <p className={styles.lifecycleHint} style={{ margin: 0 }}>
                  Account closed — row kept for CRM. Ban, credits, delete, and discover resets are disabled.
                </p>
              ) : (
                <>
                  <div className={styles.grantRow}>
                    <label className={styles.grantLabel} htmlFor="grant-credits">
                      Grant credits
                    </label>
                    <input
                      id="grant-credits"
                      type="number"
                      min={1}
                      className={styles.grantInput}
                      value={grantAmount}
                      onChange={(e) => setGrantAmount(e.target.value)}
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleGrantCredits(detailUser.userId)}
                      disabled={grantLoading}
                    >
                      {grantLoading ? 'Granting…' : 'Apply'}
                    </Button>
                  </div>
                  {detailUser.status === 'banned' ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleUnban(detailUser.userId)}
                      disabled={actionLoading === detailUser.userId}
                    >
                      Unban user
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleBan(detailUser.userId)}
                      disabled={actionLoading === detailUser.userId}
                    >
                      Deactivate (ban)
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => void handleDeleteUser(detailUser.userId, detailUser.name)}
                    loading={deleteUserLoading}
                  >
                    Delete user
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.detailEmpty}>No user selected</div>
        )}
      </aside>
      {detailOpen && <div className={styles.backdrop} onClick={() => setDetailOpen(false)} aria-hidden />}

      <Dialog open={confirmReset !== null} onClose={() => !resetBusy && setConfirmReset(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm reset</DialogTitle>
        <DialogContent>
          {confirmReset === 'skipped' && (
            <MuiTypography variant="body2">
              Remove all <strong>skipped</strong> interaction records for this user? Their Skipped list will be empty.
            </MuiTypography>
          )}
          {confirmReset === 'sent' && (
            <MuiTypography variant="body2">
              Remove <strong>sent</strong> and <strong>matched</strong> outgoing interaction rows? Sent Requests and
              Matches (from interactions) will clear for this user. Match rows in the database are unchanged.
            </MuiTypography>
          )}
          {confirmReset === 'discover' && (
            <MuiTypography variant="body2">
              Full <strong>discover state</strong> reset: all interaction rows for this user (both directions),
              discover passes, and replay/recycle flags reset. Does <strong>not</strong> delete matches or chats.
            </MuiTypography>
          )}
          {confirmReset === 'discoverMatches' && (
            <MuiTypography variant="body2" color="error">
              <strong>Destructive:</strong> Same as reset discover state, plus deletes <strong>matches</strong>,{' '}
              <strong>chat threads</strong>, and <strong>messages</strong> involving this user. Use only for support /
              abuse recovery.
            </MuiTypography>
          )}
        </DialogContent>
        <DialogActions>
          <button type="button" className={styles.dialogBtn} onClick={() => setConfirmReset(null)} disabled={resetBusy}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.dialogBtnPrimary}
            disabled={resetBusy}
            onClick={() => {
              if (confirmReset === 'skipped') void runReset('reset-skipped');
              else if (confirmReset === 'sent') void runReset('reset-sent');
              else if (confirmReset === 'discover') void runReset('reset-discover-state', { removeMatchesAndChats: false });
              else if (confirmReset === 'discoverMatches')
                void runReset('reset-discover-state', { removeMatchesAndChats: true });
            }}
          >
            {resetBusy ? 'Working…' : 'Confirm'}
          </button>
        </DialogActions>
      </Dialog>
    </div>
  );
};
