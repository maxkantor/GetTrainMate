import React, { useState, useEffect, useCallback } from 'react';
import { adminApiService } from '@/services/adminApiService';
import { AdminNoAccessPage } from './AdminNoAccess';
import { DataTable, Column } from '@/components/ui/DataTable';
import styles from './AdminPlaceholderPage.module.css';

interface SubRow {
  rowKey: string;
  subscriptionId: string;
  userId?: string;
  status: string;
  planType: string;
  createdAt: string;
  expiresAt?: string;
}

export const AdminStripePage: React.FC = () => {
  const [items, setItems] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApiService.get('/api/admin/stripe/subscriptions?page=1&pageSize=50');
      const raw = (res.items || []) as Omit<SubRow, 'rowKey'>[];
      setItems(
        raw.map((r, i) => ({
          ...r,
          rowKey: r.subscriptionId || `sub-${i}`,
        }))
      );
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? '';
      if (/forbidden|403/i.test(msg)) setError('FORBIDDEN');
      else setError(msg || 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await adminApiService.post('/api/admin/stripe/sync');
      setSyncMsg(res?.message ?? 'Sync completed');
      await load();
    } catch (err: unknown) {
      setSyncMsg((err as Error)?.message ?? 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const columns: Column<SubRow>[] = [
    { key: 'subscriptionId', header: 'Subscription' },
    { key: 'userId', header: 'User' },
    { key: 'status', header: 'Status' },
    { key: 'planType', header: 'Plan' },
    {
      key: 'createdAt',
      header: 'Created',
      render: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'),
    },
    {
      key: 'expiresAt',
      header: 'Renews / ends',
      render: (r) => (r.expiresAt ? new Date(r.expiresAt).toLocaleString() : '—'),
    },
  ];

  if (error === 'FORBIDDEN') return <AdminNoAccessPage />;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Stripe & payments</h1>
        <div className={styles.toolbar}>
          <button type="button" className={styles.primaryBtn} onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync from Stripe'}
          </button>
          <button type="button" className={styles.refresh} onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>
      <p className={styles.lead}>
        Subscription rows synced to DynamoDB. Credits purchases are reflected in user balances (see Users CRM). Use
        Sync to pull the latest from Stripe.
      </p>
      {syncMsg && <div className={styles.alert}>{syncMsg}</div>}
      {error && error !== 'FORBIDDEN' && (
        <div className={styles.alert} role="alert">
          {error}
        </div>
      )}
      <DataTable
        columns={columns}
        data={items}
        keyField="rowKey"
        emptyMessage="No subscriptions in the database yet — run Sync or complete a test checkout."
        loading={loading}
      />
    </div>
  );
};
