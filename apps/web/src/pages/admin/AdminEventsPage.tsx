import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApiService } from '@/services/adminApiService';
import { AdminNoAccessPage } from './AdminNoAccess';
import styles from './AdminPlaceholderPage.module.css';

type Flags = Record<string, boolean>;
type EventConfig = {
  eventId: string;
  label: string;
  sport: string;
  enabled: boolean;
  isFeatured: boolean;
  startDate: string;
  endDate: string;
  icon: string;
  activities: string[];
};

const FLAG_KEYS = ['sports_event_layer', 'event_boosts', 'event_watch_parties', 'event_profile_badges', 'event_credit_prompts'];

export const AdminEventsPage: React.FC = () => {
  const [flags, setFlags] = useState<Flags>({});
  const [events, setEvents] = useState<EventConfig[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [flagsRes, eventsRes] = await Promise.all([
        adminApiService.get('/api/admin/sports-events/flags'),
        adminApiService.get('/api/admin/sports-events'),
      ]);
      setFlags(flagsRes ?? {});
      setEvents(eventsRes ?? []);
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? '';
      if (/forbidden|403/i.test(msg)) setError('FORBIDDEN');
      else setError(msg || 'Failed to load sports events settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const featuredCount = useMemo(() => events.filter((x) => x.isFeatured).length, [events]);
  if (error === 'FORBIDDEN') return <AdminNoAccessPage />;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Sports Event Layer</h1>
        <button type="button" className={styles.refresh} onClick={() => void load()} disabled={loading}>
          Refresh
        </button>
      </div>
      <p className={styles.lead}>Warning: This will make the event layer visible to users if the feature flag is enabled.</p>
      {error ? <div className={styles.alert}>{error}</div> : null}

      <h3>Feature Flags</h3>
      {FLAG_KEYS.map((flagKey) => (
        <label key={flagKey} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={flags[flagKey] === true}
            onChange={async (e) => {
              const enabled = e.target.checked;
              setFlags((prev) => ({ ...prev, [flagKey]: enabled }));
              await adminApiService.put(`/api/admin/sports-events/flags/${flagKey}`, {
                enabled,
                environment: 'prod',
                description: `Admin toggle for ${flagKey}`,
              });
            }}
          />
          {flagKey}
        </label>
      ))}

      <h3 style={{ marginTop: 20 }}>Event Management</h3>
      <p>Featured events: {featuredCount}</p>
      {events.map((ev) => (
        <div key={ev.eventId} style={{ border: '1px solid #333', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <strong>{ev.icon} {ev.label}</strong> <span style={{ opacity: 0.8 }}>({ev.sport})</span>
          <div style={{ marginTop: 8, display: 'flex', gap: 16 }}>
            <label><input type="checkbox" checked={ev.enabled} onChange={async (e) => {
              const enabled = e.target.checked;
              const next = { ...ev, enabled };
              setEvents((prev) => prev.map((x) => x.eventId === ev.eventId ? next : x));
              await adminApiService.put(`/api/admin/sports-events/${ev.eventId}`, next);
            }} /> enabled</label>
            <label><input type="checkbox" checked={ev.isFeatured} onChange={async (e) => {
              const isFeatured = e.target.checked;
              const next = { ...ev, isFeatured };
              setEvents((prev) => prev.map((x) => x.eventId === ev.eventId ? next : x));
              await adminApiService.put(`/api/admin/sports-events/${ev.eventId}`, next);
            }} /> featured</label>
          </div>
        </div>
      ))}
    </div>
  );
};
