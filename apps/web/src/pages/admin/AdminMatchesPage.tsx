import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminApiService } from '@/services/adminApiService';
import { AdminNoAccessPage } from './AdminNoAccess';
import styles from './AdminPlaceholderPage.module.css';

interface MetricsResponse {
  totalMatches?: number;
  totalUsers?: number;
  totalMessages?: number;
  range?: string;
}

export const AdminMatchesPage: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApiService.get('/api/admin/metrics?range=7d');
      setMetrics(res as MetricsResponse);
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? '';
      if (/forbidden|403/i.test(msg)) setError('FORBIDDEN');
      else setError(msg || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error === 'FORBIDDEN') return <AdminNoAccessPage />;

  const tm = metrics?.totalMatches ?? 0;
  const tu = metrics?.totalUsers ?? 0;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Matches overview</h1>
        <button type="button" className={styles.refresh} onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>
      <p className={styles.lead}>
        Aggregate match stats from the metrics service. Per-user mutual matches and chat activity are available in{' '}
        <Link to="/admin/users">Users CRM</Link> and <Link to="/admin/chats">Chat moderation</Link>.
      </p>
      {error && error !== 'FORBIDDEN' && (
        <div className={styles.alert} role="alert">
          {error}
        </div>
      )}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricVal}>{loading ? '…' : tm}</div>
          <div className={styles.metricLabel}>Total matches (reported)</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricVal}>{loading ? '…' : tu}</div>
          <div className={styles.metricLabel}>Users (reported)</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricVal}>{metrics?.range ?? '7d'}</div>
          <div className={styles.metricLabel}>Range</div>
        </div>
      </div>
      <p className={styles.lead}>
        Backend metrics may return zeros until fully wired — the dashboard still explains where to drill down (users,
        chats, Stripe).
      </p>
    </div>
  );
};
