import React, { useState, useEffect, useCallback } from 'react';
import { adminApiService } from '@/services/adminApiService';
import { pickPagedItems } from '@/utils/adminApiNormalize';
import { AdminNoAccessPage } from './AdminNoAccess';
import { DataTable, Column } from '@/components/ui/DataTable';
import styles from './AdminPlaceholderPage.module.css';

interface TicketRow {
  rowKey: string;
  ticketId?: string;
  subject?: string;
  status?: string;
  createdAt?: string;
  userId?: string;
}

export const AdminTicketsPage: React.FC = () => {
  const [items, setItems] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApiService.get('/api/admin/tickets?page=1&pageSize=50');
      const raw = pickPagedItems<Omit<TicketRow, 'rowKey'>>(res);
      setItems(
        raw.map((r, i) => ({
          ...r,
          rowKey: r.ticketId || `tk-${i}`,
        }))
      );
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? '';
      if (/forbidden|403/i.test(msg)) setError('FORBIDDEN');
      else setError(msg || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const columns: Column<TicketRow>[] = [
    { key: 'ticketId', header: 'ID' },
    { key: 'subject', header: 'Subject' },
    { key: 'status', header: 'Status' },
    { key: 'userId', header: 'User' },
    {
      key: 'createdAt',
      header: 'Created',
      render: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'),
    },
  ];

  if (error === 'FORBIDDEN') return <AdminNoAccessPage />;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Support tickets</h1>
        <button type="button" className={styles.refresh} onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>
      <p className={styles.lead}>
        For email-style support with replies, also use <strong>Contacts CRM</strong>. Tickets track structured issues.
      </p>
      {error && error !== 'FORBIDDEN' && (
        <div className={styles.alert} role="alert">
          {error}
        </div>
      )}
      <DataTable
        columns={columns}
        data={items}
        keyField="rowKey"
        emptyMessage="No tickets yet."
        loading={loading}
      />
    </div>
  );
};
