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
  showAnytime?: boolean;
  startDate: string;
  endDate: string;
  icon: string;
  description?: string;
  themeColor?: string;
  bannerImageUrl?: string;
  landingHeadline?: string;
  ctaLabel?: string;
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
  showAnytime: false,
  startDate: '',
  endDate: '',
  icon: '🏆',
  description: '',
  themeColor: '#1e88e5',
  bannerImageUrl: '',
  landingHeadline: '',
  ctaLabel: '',
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
  const [flagsDraft, setFlagsDraft] = useState<Flags>({});
  const [events, setEvents] = useState<EventConfig[]>([]);
  const [eventDrafts, setEventDrafts] = useState<Record<string, { enabled: boolean; isFeatured: boolean; showAnytime: boolean }>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingFlags, setSavingFlags] = useState(false);
  const [savingEventId, setSavingEventId] = useState<string | null>(null);
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
      setFlagsDraft(flagsRes ?? {});
      setEvents(eventsRes ?? []);
      const drafts: Record<string, { enabled: boolean; isFeatured: boolean; showAnytime: boolean }> = {};
      (eventsRes ?? []).forEach((ev: EventConfig) => {
        drafts[ev.eventId] = {
          enabled: ev.enabled === true,
          isFeatured: ev.isFeatured === true,
          showAnytime: ev.showAnytime === true,
        };
      });
      setEventDrafts(drafts);
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
  const flagsDirty = useMemo(() => FLAG_KEYS.some((k) => (flags[k] === true) !== (flagsDraft[k] === true)), [flags, flagsDraft]);
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

  const saveFlags = async () => {
    setSavingFlags(true);
    setError(null);
    try {
      const changed = FLAG_KEYS.filter((k) => (flags[k] === true) !== (flagsDraft[k] === true));
      await Promise.all(
        changed.map((flagKey) =>
          adminApiService.put(`/api/admin/sports-events/flags/${flagKey}`, {
            enabled: flagsDraft[flagKey] === true,
            environment: 'prod',
            description: `Admin toggle for ${flagKey}`,
          })
        )
      );
      setFlags((prev) => ({ ...prev, ...flagsDraft }));
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to save feature flags');
    } finally {
      setSavingFlags(false);
    }
  };

  const isEventDraftDirty = (ev: EventConfig) => {
    const draft = eventDrafts[ev.eventId];
    if (!draft) return false;
    return draft.enabled !== (ev.enabled === true)
      || draft.isFeatured !== (ev.isFeatured === true)
      || draft.showAnytime !== (ev.showAnytime === true);
  };

  const saveEventCardToggles = async (ev: EventConfig) => {
    const draft = eventDrafts[ev.eventId];
    if (!draft) return;
    setSavingEventId(ev.eventId);
    setError(null);
    try {
      const next: EventConfig = { ...ev, ...draft };
      await adminApiService.put(`/api/admin/sports-events/${ev.eventId}`, next);
      setEvents((prev) => prev.map((x) => (x.eventId === ev.eventId ? next : x)));
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to save event toggles');
    } finally {
      setSavingEventId(null);
    }
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
        ctaLabel: form.ctaLabel?.trim() || '',
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

      <div className={styles.panel}>
        <h3 className={styles.subTitle}>Feature Flags</h3>
        {FLAG_KEYS.map((flagKey) => (
          <label key={flagKey} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={flagsDraft[flagKey] === true}
              onChange={(e) => setFlagsDraft((prev) => ({ ...prev, [flagKey]: e.target.checked }))}
            />
            {flagKey}
          </label>
        ))}
        <button type="button" className={styles.refresh} disabled={!flagsDirty || savingFlags} onClick={() => void saveFlags()}>
          {savingFlags ? 'Saving...' : 'Save Flags'}
        </button>
      </div>

      <div className={styles.panel}>
      <h3 className={styles.subTitle}>Event Management</h3>
      <p>Featured events: {featuredCount}</p>
      {sortedEvents.map((ev) => (
        <div key={ev.eventId} className={styles.eventRow}>
          <strong>{ev.icon} {ev.label}</strong> <span style={{ opacity: 0.8 }}>({ev.sport})</span>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
            {ev.eventId} • {ev.startDate ? new Date(ev.startDate).toLocaleDateString() : '—'} to {ev.endDate ? new Date(ev.endDate).toLocaleDateString() : '—'}
          </div>
          <div className={styles.actionRow}>
            <label><input type="checkbox" checked={eventDrafts[ev.eventId]?.enabled ?? ev.enabled} onChange={(e) => {
              const enabled = e.target.checked;
              setEventDrafts((prev) => ({
                ...prev,
                [ev.eventId]: {
                  enabled,
                  isFeatured: prev[ev.eventId]?.isFeatured ?? ev.isFeatured,
                  showAnytime: prev[ev.eventId]?.showAnytime ?? (ev.showAnytime === true),
                },
              }));
            }} /> enabled</label>
            <label><input type="checkbox" checked={eventDrafts[ev.eventId]?.isFeatured ?? ev.isFeatured} onChange={(e) => {
              const isFeatured = e.target.checked;
              setEventDrafts((prev) => ({
                ...prev,
                [ev.eventId]: {
                  enabled: prev[ev.eventId]?.enabled ?? ev.enabled,
                  isFeatured,
                  showAnytime: prev[ev.eventId]?.showAnytime ?? (ev.showAnytime === true),
                },
              }));
            }} /> featured</label>
            <label><input type="checkbox" checked={eventDrafts[ev.eventId]?.showAnytime ?? (ev.showAnytime === true)} onChange={(e) => {
              const showAnytime = e.target.checked;
              setEventDrafts((prev) => ({
                ...prev,
                [ev.eventId]: {
                  enabled: prev[ev.eventId]?.enabled ?? ev.enabled,
                  isFeatured: prev[ev.eventId]?.isFeatured ?? ev.isFeatured,
                  showAnytime,
                },
              }));
            }} /> show now (ignore dates)</label>
            <button
              type="button"
              className={styles.inlineBtn}
              disabled={!isEventDraftDirty(ev) || savingEventId === ev.eventId}
              onClick={() => void saveEventCardToggles(ev)}
            >
              {savingEventId === ev.eventId ? 'Saving...' : 'Save'}
            </button>
            <button type="button" className={styles.inlineBtn} onClick={() => openEdit(ev)}>Edit Event</button>
          </div>
        </div>
      ))}
      </div>
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
            CTA Label (optional)
            <input value={form.ctaLabel ?? ''} onChange={(e) => setFormField('ctaLabel', e.target.value)} />
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
            <label><input type="checkbox" checked={form.showAnytime === true} onChange={(e) => setFormField('showAnytime', e.target.checked)} /> show now (ignore dates)</label>
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
