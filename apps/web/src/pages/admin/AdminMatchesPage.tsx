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

interface DiscoverControls {
  ignoreSkippedProfilesInDiscoverForAdmin: boolean;
}

interface DiscoverProfileRow {
  userId: string;
  name: string;
  status: 'active' | 'skipped' | 'matched' | 'hidden';
  lastSkippedAt?: string;
  lastSkippedByUserId?: string;
  /** Resolved from profiles table; falls back to lastSkippedByUserId in UI when absent. */
  lastSkippedByName?: string;
}

export const AdminMatchesPage: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [controls, setControls] = useState<DiscoverControls>({
    ignoreSkippedProfilesInDiscoverForAdmin: false,
  });
  const [profiles, setProfiles] = useState<DiscoverProfileRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'skipped' | 'matched' | 'hidden'>('all');
  const [savingControls, setSavingControls] = useState(false);
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsRes, controlsRes, profilesRes] = await Promise.all([
        adminApiService.get('/api/admin/metrics?range=7d'),
        adminApiService.get('/api/admin/discover/controls'),
        adminApiService.get(`/api/admin/discover/profiles?filter=${encodeURIComponent(filter)}&limit=250`),
      ]);
      setMetrics(metricsRes as MetricsResponse);
      setControls((controlsRes as DiscoverControls) ?? { ignoreSkippedProfilesInDiscoverForAdmin: false });
      const pr = profilesRes as unknown;
      const list = Array.isArray(pr) ? pr : (pr as { items?: DiscoverProfileRow[] })?.items;
      setProfiles(Array.isArray(list) ? list : []);
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? '';
      if (/forbidden|403/i.test(msg)) setError('FORBIDDEN');
      else setError(msg || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  if (error === 'FORBIDDEN') return <AdminNoAccessPage />;

  const tm = metrics?.totalMatches ?? 0;
  const tu = metrics?.totalUsers ?? 0;

  const updateControls = async (nextValue: boolean) => {
    setSavingControls(true);
    setError(null);
    try {
      const res = await adminApiService.put('/api/admin/discover/controls', {
        ignoreSkippedProfilesInDiscoverForAdmin: nextValue,
      });
      setControls((res as DiscoverControls) ?? { ignoreSkippedProfilesInDiscoverForAdmin: nextValue });
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to update discover controls');
    } finally {
      setSavingControls(false);
    }
  };

  const actOnProfile = async (profileUserId: string, action: 'restore' | 'skip' | 'hide' | 'reset') => {
    setSavingProfileId(profileUserId);
    setError(null);
    try {
      await adminApiService.post(`/api/admin/discover/profiles/${encodeURIComponent(profileUserId)}/${action}`);
      await load();
    } catch (err: unknown) {
      setError((err as Error)?.message || `Failed to ${action} profile`);
    } finally {
      setSavingProfileId(null);
    }
  };

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
      <div className={styles.metricCard} style={{ marginBottom: 16 }}>
        <div className={styles.metricLabel} style={{ marginBottom: 10 }}>Discover Controls</div>
        <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={controls.ignoreSkippedProfilesInDiscoverForAdmin}
            onChange={(e) => void updateControls(e.target.checked)}
            disabled={savingControls}
          />
          Ignore skipped profiles in Discover (Admin only)
        </label>
      </div>
      <div className={styles.header} style={{ marginTop: 8 }}>
        <h2 className={styles.title} style={{ fontSize: '1.1rem' }}>Discover profile status</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          style={{ borderRadius: 8, padding: '6px 10px', background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' }}
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="skipped">Skipped</option>
          <option value="matched">Matched</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>
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
      <div className={styles.metricCard}>
        <div className={styles.metricLabel} style={{ marginBottom: 12 }}>Profile Discover Status</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 6px' }}>Profile</th>
                <th style={{ textAlign: 'left', padding: '8px 6px' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '8px 6px' }}>Last skipped</th>
                <th style={{ textAlign: 'left', padding: '8px 6px' }}>Skipped by</th>
                <th style={{ textAlign: 'left', padding: '8px 6px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((row) => (
                <tr key={row.userId}>
                  <td style={{ padding: '8px 6px' }}>{row.name}</td>
                  <td style={{ padding: '8px 6px', textTransform: 'capitalize' }}>{row.status}</td>
                  <td style={{ padding: '8px 6px' }}>{row.lastSkippedAt ? new Date(row.lastSkippedAt).toLocaleString() : '—'}</td>
                  <td
                    style={{ padding: '8px 6px' }}
                    title={row.lastSkippedByUserId ? `User id: ${row.lastSkippedByUserId}` : undefined}
                  >
                    {row.lastSkippedByName?.trim() || row.lastSkippedByUserId || '—'}
                  </td>
                  <td style={{ padding: '8px 6px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button type="button" className={styles.refresh} disabled={savingProfileId === row.userId} onClick={() => void actOnProfile(row.userId, 'restore')}>
                        Restore
                      </button>
                      <button type="button" className={styles.refresh} disabled={savingProfileId === row.userId} onClick={() => void actOnProfile(row.userId, 'skip')}>
                        Skip
                      </button>
                      <button type="button" className={styles.refresh} disabled={savingProfileId === row.userId} onClick={() => void actOnProfile(row.userId, 'hide')}>
                        Hide
                      </button>
                      <button type="button" className={styles.refresh} disabled={savingProfileId === row.userId} onClick={() => void actOnProfile(row.userId, 'reset')}>
                        Reset state
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
