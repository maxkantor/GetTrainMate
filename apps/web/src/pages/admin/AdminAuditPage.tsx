import React, { useState, useEffect, useCallback } from 'react';
import { adminApiService } from '@/services/adminApiService';
import { pickPagedItems } from '@/utils/adminApiNormalize';
import { AdminNoAccessPage } from './AdminNoAccess';
import { DataTable, Column } from '@/components/ui/DataTable';
import styles from './AdminPlaceholderPage.module.css';

interface AuditRow {
  rowKey: string;
  id?: string;
  logId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  createdAt?: string;
  timestamp?: string;
  adminEmail?: string;
}

export const AdminAuditPage: React.FC = () => {
  const [items, setItems] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApiService.get('/api/admin/audit?page=1&pageSize=50');
      const raw = pickPagedItems<Omit<AuditRow, 'rowKey'>>(res);
      setItems(
        raw.map((r, i) => ({
          ...r,
          rowKey: r.id || r.logId || `audit-${i}`,
        }))
      );
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? '';
      if (/forbidden|403/i.test(msg)) setError('FORBIDDEN');
      else setError(msg || 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const columns: Column<AuditRow>[] = [
    { key: 'action', header: 'Action' },
    { key: 'targetType', header: 'Target' },
    { key: 'targetId', header: 'Target ID' },
    { key: 'adminEmail', header: 'Admin' },
    {
      key: 'createdAt',
      header: 'When',
      render: (r) => {
        const t = r.createdAt || r.timestamp;
        return t ? new Date(t).toLocaleString() : '—';
      },
    },
  ];

  if (error === 'FORBIDDEN') return <AdminNoAccessPage />;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Audit log</h1>
        <button type="button" className={styles.refresh} onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>
      <p className={styles.lead}>Immutable record of admin actions (bans, Stripe sync, etc.).</p>
      {error && error !== 'FORBIDDEN' && (
        <div className={styles.alert} role="alert">
          {error}
        </div>
      )}
      <DataTable
        columns={columns}
        data={items}
        keyField="rowKey"
        emptyMessage="No audit events recorded yet."
        loading={loading}
      />
    </div>
  );
};
