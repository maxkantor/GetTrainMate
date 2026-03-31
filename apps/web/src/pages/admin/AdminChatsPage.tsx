import React, { useState, useEffect, useCallback } from 'react';
import { adminApiService } from '@/services/adminApiService';
import { AdminNoAccessPage } from './AdminNoAccess';
import { DataTable, Column } from '@/components/ui/DataTable';
import styles from './AdminPlaceholderPage.module.css';

interface ChatRow {
  rowKey: string;
  threadId?: string;
  chatId?: string;
  userA?: string;
  userB?: string;
  lastMessageAt?: string;
}

export const AdminChatsPage: React.FC = () => {
  const [items, setItems] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApiService.get('/api/admin/chats?page=1&pageSize=50');
      const raw = (res.items || []) as Omit<ChatRow, 'rowKey'>[];
      setItems(
        raw.map((r, i) => ({
          ...r,
          rowKey: r.threadId || r.chatId || `chat-${i}`,
        }))
      );
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? '';
      if (/forbidden|403/i.test(msg)) setError('FORBIDDEN');
      else setError(msg || 'Failed to load chats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const columns: Column<ChatRow>[] = [
    { key: 'threadId', header: 'Thread', render: (r) => r.threadId ?? r.chatId ?? '—' },
    { key: 'userA', header: 'User A' },
    { key: 'userB', header: 'User B' },
    {
      key: 'lastMessageAt',
      header: 'Last activity',
      render: (r) => (r.lastMessageAt ? new Date(r.lastMessageAt).toLocaleString() : '—'),
    },
  ];

  if (error === 'FORBIDDEN') return <AdminNoAccessPage />;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Chat moderation</h1>
        <button type="button" className={styles.refresh} onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>
      <p className={styles.lead}>
        Threads and messages for moderation. When the API returns rows, they appear here — no blank screen.
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
        emptyMessage="No chat threads yet — matches will create threads here."
        loading={loading}
      />
    </div>
  );
};
