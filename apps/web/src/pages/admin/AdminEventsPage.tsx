import React, { useState, useEffect, useCallback } from 'react';
import { adminApiService } from '@/services/adminApiService';
import { AdminNoAccessPage } from './AdminNoAccess';
import { DataTable, Column } from '@/components/ui/DataTable';
import styles from './AdminPlaceholderPage.module.css';

interface EventRow {
  rowKey: string;
  eventId?: string;
  title?: string;
  startsAt?: string;
  city?: string;
  status?: string;
}

export const AdminEventsPage: React.FC = () => {
  const [items, setItems] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApiService.get('/api/admin/events?page=1&pageSize=50');
      const raw = (res.items || []) as Omit<EventRow, 'rowKey'>[];
      setItems(
        raw.map((r, i) => ({
          ...r,
          rowKey: r.eventId || `ev-${i}`,
        }))
      );
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? '';
      if (/forbidden|403/i.test(msg)) setError('FORBIDDEN');
      else setError(msg || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const columns: Column<EventRow>[] = [
    { key: 'title', header: 'Title', render: (r) => r.title ?? r.eventId ?? '—' },
    { key: 'city', header: 'Location' },
    {
      key: 'startsAt',
      header: 'Starts',
      render: (r) => (r.startsAt ? new Date(r.startsAt).toLocaleString() : '—'),
    },
    { key: 'status', header: 'Status' },
  ];

  if (error === 'FORBIDDEN') return <AdminNoAccessPage />;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Events CRM</h1>
        <button type="button" className={styles.refresh} onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>
      <p className={styles.lead}>Train-together events created in the system. Empty until events are added via API or admin tools.</p>
      {error && error !== 'FORBIDDEN' && (
        <div className={styles.alert} role="alert">
          {error}
        </div>
      )}
      <DataTable
        columns={columns}
        data={items}
        keyField="rowKey"
        emptyMessage="No events yet."
        loading={loading}
      />
    </div>
  );
};
