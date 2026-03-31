import React, { useState, useEffect, useCallback } from 'react';
import { adminApiService } from '@/services/adminApiService';
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
  credits?: number;
}

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailUser, setDetailUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [grantAmount, setGrantAmount] = useState('10');
  const [grantLoading, setGrantLoading] = useState(false);

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
      setUsers(response.items || []);
      setTotalPages(response.totalPages || 1);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
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
    try {
      const user = await adminApiService.get(`/api/admin/users/${row.userId}`);
      setDetailUser(user);
    } catch {
      setDetailUser(row);
    } finally {
      setDetailLoading(false);
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
    { key: 'userId', header: 'User ID', render: (r) => <span className={styles.mono}>{r.userId.slice(0, 12)}…</span> },
    { key: 'email', header: 'Email' },
    { key: 'name', header: 'Name' },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge variant={r.status === 'active' ? 'success' : r.status === 'banned' ? 'error' : 'neutral'}>{r.status}</Badge>,
    },
    { key: 'plan', header: 'Plan', render: (r) => r.plan || '—' },
    { key: 'createdAt', header: 'Created', render: (r) => new Date(r.createdAt).toLocaleDateString() },
  ];

  if (error === 'FORBIDDEN') return <AdminNoAccessPage />;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Users CRM</h1>
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
              <dd><Badge variant={detailUser.status === 'active' ? 'success' : detailUser.status === 'banned' ? 'error' : 'neutral'}>{detailUser.status}</Badge></dd>
              <dt>Plan</dt>
              <dd>{detailUser.plan || '—'}</dd>
              <dt>Created</dt>
              <dd>{new Date(detailUser.createdAt).toLocaleString()}</dd>
            </dl>
            <div className={styles.detailActions}>
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
            </div>
          </div>
        ) : (
          <div className={styles.detailEmpty}>No user selected</div>
        )}
      </aside>
      {detailOpen && <div className={styles.backdrop} onClick={() => setDetailOpen(false)} aria-hidden />}
    </div>
  );
};
