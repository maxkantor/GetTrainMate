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
  /** ISO timestamp from API */
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
      const raw = pickPagedItems<Record<string, unknown>>(res);
      setItems(
        raw.map((r, i) => {
          const o = r;
          const logId = String(o.logId ?? o.LogId ?? '');
          const action = String(o.action ?? o.Action ?? '');
          const targetType = String(o.targetType ?? o.TargetType ?? '');
          const targetId = (o.targetId ?? o.TargetId) != null ? String(o.targetId ?? o.TargetId) : undefined;
          const adminEmail = (o.adminEmail ?? o.AdminEmail) != null ? String(o.adminEmail ?? o.AdminEmail) : undefined;
          const ts = o.timestamp ?? o.Timestamp ?? o.createdAt ?? o.CreatedAt;
          const timestamp = ts != null ? String(ts) : undefined;
          return {
            rowKey: logId || `audit-${i}`,
            logId: logId || undefined,
            action: action || undefined,
            targetType: targetType || undefined,
            targetId,
            adminEmail,
            timestamp,
          };
        })
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
        const t = r.timestamp || r.createdAt;
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
