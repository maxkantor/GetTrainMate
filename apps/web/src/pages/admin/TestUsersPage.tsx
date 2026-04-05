import React, { useCallback, useEffect, useState } from 'react';
import { adminApiService } from '@/services/adminApiService';
import { pickPagedItems, pickPagedMeta, normalizeAdminUserRow } from '@/utils/adminApiNormalize';
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
}

/**
 * Lists seeded / test accounts (dummy-user-* and @test.com) from the API.
 * Production-safe: no passwords; credentials live only in your dev notes or Cognito.
 */
export const TestUsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '50',
        testUsersOnly: 'true',
      });
      const response = await adminApiService.get(`/api/admin/users?${params}`);
      const rows = pickPagedItems<Record<string, unknown>>(response).map((r) => normalizeAdminUserRow(r));
      setUsers(rows);
      setTotalPages(pickPagedMeta(response).totalPages);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to load test users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const columns: Column<User>[] = [
    {
      key: 'userId',
      header: 'User ID',
      render: (r) => (
        <span className={styles.mono}>
          {(r.userId || '').length > 18 ? `${(r.userId || '').slice(0, 18)}…` : r.userId || '—'}
        </span>
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
      render: (r) => (
        <Badge variant={r.status === 'active' ? 'success' : r.status === 'banned' ? 'error' : 'neutral'}>
          {r.status}
        </Badge>
      ),
    },
    { key: 'plan', header: 'Plan', render: (r) => r.plan || '—' },
    { key: 'createdAt', header: 'Created', render: (r) => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Test Users</h1>
      </div>
      <p style={{ marginBottom: 'var(--space-4)', color: 'var(--color-neutral-500)', fontSize: 'var(--font-sm)' }}>
        Dummy and seeded accounts excluded from Users CRM. Add more via seed-dummy (dev) or signup in staging.
      </p>

      {error && (
        <div className={styles.alert} role="alert">
          {error}
          <button type="button" className={styles.dismiss} onClick={() => setError(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={users}
        keyField="userId"
        emptyMessage="No test users found."
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
    </div>
  );
};
