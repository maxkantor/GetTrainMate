import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApiService } from '@/services/adminApiService';
import { AdminNoAccessPage } from './AdminNoAccess';
import styles from './AdminPlaceholderPage.module.css';

type Flags = Record<string, boolean>;
type EventConfig = {
  eventId: string;
  name?: string;
  label: string;
  sport: string;
  enabled: boolean;
  isFeatured: boolean;
  startDate: string;
  endDate: string;
  icon: string;
  description?: string;
  themeColor?: string;
  bannerImageUrl?: string;
  landingHeadline?: string;
  activities: string[];
  tags?: string[];
  teams?: string[];
  locations?: string[];
  boostEnabled?: boolean;
  boostPrice?: number | null;
  boostLabel?: string;
  stripePriceIdDev?: string;
  stripePriceIdProd?: string;
};

const FLAG_KEYS = ['sports_event_layer', 'event_boosts', 'event_watch_parties', 'event_profile_badges', 'event_credit_prompts'];
const DEFAULT_ACTIVITIES = ['train', 'play', 'watch', 'meet', 'vibe', 'date'];

const createEmptyEvent = (): EventConfig => ({
  eventId: '',
  name: '',
  label: '',
  sport: '',
  enabled: false,
  isFeatured: false,
  startDate: '',
  endDate: '',
  icon: '🏆',
  description: '',
  themeColor: '#1e88e5',
  bannerImageUrl: '',
  landingHeadline: '',
  activities: [...DEFAULT_ACTIVITIES],
  tags: [],
  teams: [],
  locations: [],
  boostEnabled: false,
  boostPrice: null,
  boostLabel: '',
  stripePriceIdDev: '',
  stripePriceIdProd: '',
});

export const AdminEventsPage: React.FC = () => {
  const [flags, setFlags] = useState<Flags>({});
  const [events, setEvents] = useState<EventConfig[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventConfig>(createEmptyEvent());

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
  const sortedEvents = useMemo(() => [...events].sort((a, b) => (a.label || a.eventId).localeCompare(b.label || b.eventId)), [events]);
  const formTitle = editingId ? `Edit event: ${editingId}` : 'Create New Event';

  const setFormField = <K extends keyof EventConfig>(key: K, value: EventConfig[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setCsvField = (key: 'tags' | 'teams' | 'locations', raw: string) => {
    setFormField(
      key,
      raw
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
    );
  };

  const setActivitiesFromCsv = (raw: string) => {
    const list = raw
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    setFormField('activities', list.length > 0 ? list : [...DEFAULT_ACTIVITIES]);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(createEmptyEvent());
    setFormOpen(true);
  };

  const openEdit = (ev: EventConfig) => {
    setEditingId(ev.eventId);
    setForm({
      ...createEmptyEvent(),
      ...ev,
      activities: ev.activities?.length ? ev.activities : [...DEFAULT_ACTIVITIES],
      tags: ev.tags ?? [],
      teams: ev.teams ?? [],
      locations: ev.locations ?? [],
    });
    setFormOpen(true);
  };

  const upsertEvent = async () => {
    const eventId = form.eventId.trim();
    if (!eventId) {
      setError('Event ID is required.');
      return;
    }
    if (!form.label?.trim()) {
      setError('Label is required.');
      return;
    }
    if (!form.sport?.trim()) {
      setError('Sport is required.');
      return;
    }
    const startMs = Date.parse(form.startDate);
    const endMs = Date.parse(form.endDate);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      setError('Start and end date must be valid date/time values.');
      return;
    }
    if (startMs >= endMs) {
      setError('Start date must be before end date.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: EventConfig = {
        ...form,
        eventId,
        name: form.name?.trim() || form.label.trim(),
        label: form.label.trim(),
        sport: form.sport.trim(),
        icon: (form.icon || '🏆').trim(),
        bannerImageUrl: form.bannerImageUrl?.trim() || '',
        landingHeadline: form.landingHeadline?.trim() || '',
        description: form.description?.trim() || '',
        activities: form.activities?.length ? form.activities : [...DEFAULT_ACTIVITIES],
      };
      await adminApiService.put(`/api/admin/sports-events/${encodeURIComponent(eventId)}`, payload);
      setFormOpen(false);
      await load();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  if (error === 'FORBIDDEN') return <AdminNoAccessPage />;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Sports Event Layer</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className={styles.refresh} onClick={openCreate}>
            New Event
          </button>
          <button type="button" className={styles.refresh} onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
        </div>
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
      {sortedEvents.map((ev) => (
        <div key={ev.eventId} style={{ border: '1px solid #333', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <strong>{ev.icon} {ev.label}</strong> <span style={{ opacity: 0.8 }}>({ev.sport})</span>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
            {ev.eventId} • {ev.startDate ? new Date(ev.startDate).toLocaleDateString() : '—'} to {ev.endDate ? new Date(ev.endDate).toLocaleDateString() : '—'}
          </div>
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
            <button type="button" className={styles.refresh} onClick={() => openEdit(ev)}>edit</button>
          </div>
        </div>
      ))}
      {formOpen ? (
        <div style={{ marginTop: 16, border: '1px solid #3c3c55', borderRadius: 10, padding: 14, background: 'rgba(15,18,40,0.6)' }}>
          <h3 style={{ marginTop: 0 }}>{formTitle}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              Event ID
              <input value={form.eventId} disabled={!!editingId} onChange={(e) => setFormField('eventId', e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              Label
              <input value={form.label} onChange={(e) => setFormField('label', e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              Name
              <input value={form.name ?? ''} onChange={(e) => setFormField('name', e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              Sport
              <input value={form.sport} onChange={(e) => setFormField('sport', e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              Icon
              <input value={form.icon} onChange={(e) => setFormField('icon', e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              Theme Color
              <input value={form.themeColor ?? ''} onChange={(e) => setFormField('themeColor', e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              Start Date
              <input type="datetime-local" value={form.startDate ? form.startDate.substring(0, 16) : ''} onChange={(e) => setFormField('startDate', e.target.value ? new Date(e.target.value).toISOString() : '')} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              End Date
              <input type="datetime-local" value={form.endDate ? form.endDate.substring(0, 16) : ''} onChange={(e) => setFormField('endDate', e.target.value ? new Date(e.target.value).toISOString() : '')} />
            </label>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
            Landing Headline
            <input value={form.landingHeadline ?? ''} onChange={(e) => setFormField('landingHeadline', e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
            Banner Image URL
            <input value={form.bannerImageUrl ?? ''} onChange={(e) => setFormField('bannerImageUrl', e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
            Description
            <textarea rows={3} value={form.description ?? ''} onChange={(e) => setFormField('description', e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
            Activities (comma separated)
            <input value={(form.activities ?? []).join(', ')} onChange={(e) => setActivitiesFromCsv(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
            Tags (comma separated)
            <input value={(form.tags ?? []).join(', ')} onChange={(e) => setCsvField('tags', e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
            Teams (comma separated)
            <input value={(form.teams ?? []).join(', ')} onChange={(e) => setCsvField('teams', e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
            Locations (comma separated)
            <input value={(form.locations ?? []).join(', ')} onChange={(e) => setCsvField('locations', e.target.value)} />
          </label>
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            <label><input type="checkbox" checked={form.enabled} onChange={(e) => setFormField('enabled', e.target.checked)} /> enabled</label>
            <label><input type="checkbox" checked={form.isFeatured} onChange={(e) => setFormField('isFeatured', e.target.checked)} /> featured</label>
            <label><input type="checkbox" checked={form.boostEnabled === true} onChange={(e) => setFormField('boostEnabled', e.target.checked)} /> boost enabled</label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              Boost Price
              <input value={form.boostPrice ?? ''} onChange={(e) => setFormField('boostPrice', e.target.value ? Number(e.target.value) : null)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              Boost Label
              <input value={form.boostLabel ?? ''} onChange={(e) => setFormField('boostLabel', e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              Stripe Price ID (Dev)
              <input value={form.stripePriceIdDev ?? ''} onChange={(e) => setFormField('stripePriceIdDev', e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              Stripe Price ID (Prod)
              <input value={form.stripePriceIdProd ?? ''} onChange={(e) => setFormField('stripePriceIdProd', e.target.value)} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button type="button" className={styles.refresh} disabled={saving} onClick={() => void upsertEvent()}>
              {saving ? 'Saving...' : 'Save Event'}
            </button>
            <button type="button" className={styles.refresh} onClick={() => setFormOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
