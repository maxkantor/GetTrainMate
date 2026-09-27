import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { adminApiService } from '@/services/adminApiService';
import { pickPagedItems, pickPagedMeta } from '@/utils/adminApiNormalize';
import { AdminNoAccessPage } from './AdminNoAccess';
import { DataTable, Column } from '@/components/ui/DataTable';
import styles from './AdminPlaceholderPage.module.css';

interface ActivityRow {
  rowKey: string;
  eventType: string;
  path?: string;
  cleanPath?: string;
  userId?: string;
  sessionId?: string;
  paramsJson?: string;
  source?: string;
  campaign?: string;
  mode?: string;
  language?: string;
  timestamp?: string;
}

function cleanPathDisplay(raw?: string): string {
  if (!raw) return '—';
  let s = raw.trim();
  try {
    if (/^https?:\/\//i.test(s)) {
      s = new URL(s).pathname || '/';
    }
  } catch {
    /* keep */
  }
  const q = s.indexOf('?');
  if (q >= 0) s = s.slice(0, q);
  const h = s.indexOf('#');
  if (h >= 0) s = s.slice(0, h);
  return s || '/';
}

function pickParam(parsed: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = parsed[k];
    if (v != null && String(v).trim()) return String(v);
  }
  return undefined;
}

const EVENT_FILTER_OPTIONS = [
  { value: '', label: 'All events' },
  { value: 'page_view', label: 'Page views' },
  { value: 'sign_up', label: 'Sign ups' },
  { value: 'login', label: 'Logins' },
  { value: 'user_engaged', label: 'Engaged (5s+)' },
  { value: 'find_match_clicked', label: 'Find match' },
  { value: 'request_sent', label: 'Match requests' },
  { value: 'event_page_view', label: 'World Cup / events' },
  { value: 'begin_checkout', label: 'Checkout started' },
  { value: 'purchase', label: 'Purchases' },
];

export const AdminActivityPage: React.FC = () => {
  const [items, setItems] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: '50',
      });
      if (eventFilter) qs.set('eventType', eventFilter);
      const res = await adminApiService.get(`/api/admin/activity?${qs.toString()}`);
      const raw = pickPagedItems<Record<string, unknown>>(res);
      const meta = pickPagedMeta(res);
      setTotalPages(meta.totalPages);
      setTotalCount(meta.totalCount);
      setItems(
        raw.map((r, i) => {
          const eventId = String(r.eventId ?? r.EventId ?? `ev-${i}`);
          const eventType = String(r.eventType ?? r.EventType ?? '');
          const path = (r.path ?? r.Path) != null ? String(r.path ?? r.Path) : undefined;
          const userId = (r.userId ?? r.UserId) != null ? String(r.userId ?? r.UserId) : undefined;
          const sessionId = (r.sessionId ?? r.SessionId) != null ? String(r.sessionId ?? r.SessionId) : undefined;
          const paramsJson = (r.paramsJson ?? r.ParamsJson) != null ? String(r.paramsJson ?? r.ParamsJson) : undefined;
          const ts = r.timestamp ?? r.Timestamp;
          let source: string | undefined;
          let campaign: string | undefined;
          let mode: string | undefined;
          let language: string | undefined;
          if (paramsJson) {
            try {
              const parsed = JSON.parse(paramsJson) as Record<string, unknown>;
              source = pickParam(parsed, ['utm_source', 'source', 'ref']);
              campaign = pickParam(parsed, ['utm_campaign', 'campaign', 'partner', 'partnerCode']);
              mode = pickParam(parsed, ['mode', 'utm_content']);
              language = pickParam(parsed, ['lang', 'language', 'hl']);
            } catch {
              /* ignore */
            }
          }
          return {
            rowKey: eventId,
            eventType,
            path,
            cleanPath: cleanPathDisplay(path),
            userId,
            sessionId,
            paramsJson,
            source,
            campaign,
            mode,
            language,
            timestamp: ts != null ? String(ts) : undefined,
          };
        })
      );
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? '';
      if (/forbidden|403/i.test(msg)) setError('FORBIDDEN');
      else setError(msg || 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [eventFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [eventFilter]);

  const columns: Column<ActivityRow>[] = useMemo(
    () => [
      {
        key: 'eventType',
        header: 'Event',
        render: (r) => (
          <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{r.eventType || '—'}</span>
        ),
      },
      {
        key: 'cleanPath',
        header: 'Path',
        render: (r) => (
          <span style={{ fontSize: '0.85rem' }} title={r.path || undefined}>
            {r.cleanPath || '—'}
          </span>
        ),
      },
      {
        key: 'userId',
        header: 'User / session',
        render: (r) =>
          r.userId ? (
            <Link to={`/admin/users?highlight=${encodeURIComponent(r.userId)}`} style={{ fontSize: '0.85rem' }}>
              {r.userId.slice(0, 12)}…
            </Link>
          ) : (
            <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>
              {r.sessionId ? `anon ${r.sessionId.slice(0, 8)}…` : 'anonymous'}
            </span>
          ),
      },
      {
        key: 'source',
        header: 'Source',
        render: (r) => <span style={{ fontSize: '0.8rem' }}>{r.source || '—'}</span>,
      },
      {
        key: 'campaign',
        header: 'Campaign',
        render: (r) => <span style={{ fontSize: '0.8rem' }}>{r.campaign || '—'}</span>,
      },
      {
        key: 'mode',
        header: 'Mode',
        render: (r) => <span style={{ fontSize: '0.8rem' }}>{r.mode || '—'}</span>,
      },
      {
        key: 'language',
        header: 'Lang',
        render: (r) => <span style={{ fontSize: '0.8rem' }}>{r.language || '—'}</span>,
      },
      {
        key: 'timestamp',
        header: 'When',
        render: (r) => (r.timestamp ? new Date(r.timestamp).toLocaleString() : '—'),
      },
      {
        key: 'paramsJson',
        header: 'Details',
        render: (r) => {
          if (!r.paramsJson && !r.path) return '—';
          const open = Boolean(expanded[r.rowKey]);
          return (
            <div style={{ fontSize: '0.8rem' }}>
              <button
                type="button"
                onClick={() => setExpanded((prev) => ({ ...prev, [r.rowKey]: !prev[r.rowKey] }))}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'inherit',
                  borderRadius: 6,
                  padding: '2px 8px',
                  cursor: 'pointer',
                }}
              >
                {open ? 'Hide details' : 'View details'}
              </button>
              {open && (
                <pre
                  style={{
                    marginTop: 6,
                    maxWidth: 360,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    opacity: 0.85,
                    fontSize: '0.75rem',
                  }}
                >
                  {r.path ? `url: ${r.path}\n` : ''}
                  {r.paramsJson || ''}
                </pre>
              )}
            </div>
          );
        },
      },
    ],
    [expanded],
  );

  if (error === 'FORBIDDEN') return <AdminNoAccessPage />;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>User activity</h1>
        <button type="button" className={styles.refresh} onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>
      <p className={styles.lead}>
        Live stream of page views and product events (mirrors GA4, stored server-side for admin monitoring).
        Anonymous visitors appear by session ID; logged-in users link to{' '}
        <Link to="/admin/users">Users CRM</Link>. Attribution query params are stored but shown under View
        details.
      </p>

      <div className={styles.toolbar}>
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(15,18,30,0.8)',
            color: '#fff',
          }}
          aria-label="Filter by event type"
        >
          {EVENT_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span style={{ alignSelf: 'center', fontSize: '0.85rem', opacity: 0.7 }}>
          {totalCount.toLocaleString()} events
        </span>
      </div>

      {error && error !== 'FORBIDDEN' && (
        <div className={styles.alert} role="alert">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={items}
        keyField="rowKey"
        emptyMessage="No activity recorded yet. Events appear after users visit the site (page views, signups, World Cup hub, etc.)."
        loading={loading}
      />

      {totalPages > 1 && (
        <div className={styles.actionRow}>
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
