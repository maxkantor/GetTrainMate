import React from 'react';
import {
  Box,
  Chip,
  Skeleton,
  Typography,
} from '@mui/material';
import type { DiscoveryJob, PartnerProspect, PartnerQueueItem } from './types';
import { adminApiService } from '@/services/adminApiService';

export const API = '/api/admin/partner-outreach';

export function asArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as T[];
  }
  return [];
}

export function formatCents(cents: number | undefined | null): string {
  if (cents == null || Number.isNaN(Number(cents))) return 'Unavailable';
  const n = Number(cents);
  if (n === 0) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n / 100);
}

export function formatPct(rate: number | undefined | null): string {
  if (rate == null || Number.isNaN(Number(rate))) return '—';
  return `${(Number(rate) * 100).toFixed(1)}%`;
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export function campaignLabel(c: { displayName?: string; name?: string; campaignId: string }): string {
  return c.displayName || c.name || c.campaignId;
}

export function mapCampaignStatus(status?: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'candidate') return 'draft';
  return s || 'draft';
}

export function prospectScore(p: PartnerProspect): number {
  return p.acquisitionScore ?? p.fitScore ?? 0;
}

export function marketLabel(p: PartnerProspect): string {
  const parts = [p.metro || p.city, p.country].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

export function hasEmail(p: PartnerProspect): boolean {
  return Boolean(p.email && p.email.includes('@'));
}

export function parseTimeline(json?: string | null): Array<{ at?: string; type?: string; note?: string; label?: string }> {
  if (!json?.trim()) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function previewText(text?: string, max = 140): string {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '—';
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export function MetricCard({
  label,
  value,
  note,
  attention = false,
  onClick,
  loading = false,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  attention?: boolean;
  onClick?: () => void;
  loading?: boolean;
}) {
  return (
    <Box
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      sx={{
        p: 1.75,
        border: '1px solid',
        borderColor: attention ? 'warning.main' : 'rgba(255,255,255,0.08)',
        borderRadius: 2,
        minWidth: 150,
        flex: '1 1 150px',
        bgcolor: 'rgba(255,255,255,0.02)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s, background 0.15s',
        '&:hover': onClick
          ? { borderColor: 'primary.main', bgcolor: 'rgba(99,102,241,0.08)' }
          : undefined,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.4 }}>
        {label}
      </Typography>
      {loading ? (
        <Skeleton width={64} height={36} sx={{ mt: 0.5 }} />
      ) : (
        <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2, mt: 0.25 }}>
          {value}
        </Typography>
      )}
      {note && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
          {note}
        </Typography>
      )}
    </Box>
  );
}

export function StatusChip({ label, color = 'default' }: { label: string; color?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary' }) {
  return <Chip size="small" label={label} color={color} variant="outlined" sx={{ textTransform: 'uppercase', fontSize: 11 }} />;
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <Box sx={{ py: 4, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
      <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
      {detail && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {detail}
        </Typography>
      )}
    </Box>
  );
}

export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={56} />
      ))}
    </Box>
  );
}

const TERMINAL = new Set(['complete', 'partial', 'failed']);

export async function startDiscoveryJob(body: Record<string, unknown> = {}): Promise<DiscoveryJob> {
  const job = await adminApiService.post(`${API}/discovery/jobs`, {
    prepareDrafts: true,
    ...body,
  });
  return job as DiscoveryJob;
}

/** Poll GET discovery/jobs/{id} every 2s until terminal status. Each GET advances a chunk. */
export async function pollDiscoveryJob(
  jobId: string,
  onUpdate: (job: DiscoveryJob) => void,
  signal?: { cancelled: boolean },
): Promise<DiscoveryJob> {
  let last: DiscoveryJob = { jobId, status: 'starting', progressPct: 0 };
  while (!signal?.cancelled) {
    last = (await adminApiService.get(`${API}/discovery/jobs/${encodeURIComponent(jobId)}`)) as DiscoveryJob;
    onUpdate(last);
    if (TERMINAL.has((last.status || '').toLowerCase())) return last;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return last;
}

export function discoverySummary(job: DiscoveryJob): string {
  const parts = [
    `${job.prospectsFound ?? 0} prospects`,
    `${job.contactsFound ?? 0} contacts`,
    `${job.draftsCreated ?? 0} drafts`,
  ];
  const status = (job.status || '').toLowerCase();
  if (status === 'failed') return job.error || 'Discovery failed';
  if (status === 'partial') return `Partial: ${parts.join(', ')}${job.error ? ` — ${job.error}` : ''}`;
  return `Complete: ${parts.join(', ')}`;
}

export function queueForProspect(queue: PartnerQueueItem[], prospectId: string): PartnerQueueItem[] {
  return queue.filter((q) => q.prospectId === prospectId);
}

export function unavailableIfZero(value: number | string | undefined | null, label = 'Unavailable'): string | number {
  if (typeof value === 'string') {
    if (!value.trim() || /unavailable/i.test(value)) return label;
    return value;
  }
  if (value == null) return label;
  if (typeof value === 'number' && value === 0) return label;
  return value;
}
