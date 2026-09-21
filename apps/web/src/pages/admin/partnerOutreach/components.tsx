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

const PROSPECT_TYPE_LABELS: Record<string, string> = {
  GYM: 'Gym',
  STUDIO: 'Studio',
  SPORTS_CLUB: 'Sports club',
  RUN_CLUB: 'Running club',
  REC_LEAGUE: 'Rec league',
  COACH: 'Coach',
  TRAINER: 'Trainer',
  CREATOR: 'Creator',
  COMMUNITY: 'Community',
  EVENT_ORGANIZER: 'Event organizer',
  OTHER: 'Other',
  ORGANIZATION: 'Organization',
  INDIVIDUAL: 'Individual',
  organization: 'Organization',
  individual: 'Individual',
  gym: 'Gym',
  studio: 'Studio',
  run_club: 'Running club',
  pickleball: 'Sports club',
  personal_trainer: 'Trainer',
  cycling: 'Sports club',
  crossfit_hyrox: 'Studio',
  creator: 'Creator',
  influencer: 'Creator',
  community: 'Community',
  sports_club: 'Sports club',
  rec_league: 'Rec league',
  coach: 'Coach',
  trainer: 'Trainer',
  event_organizer: 'Event organizer',
};

export function formatProspectType(p: PartnerProspect | string | undefined | null): string {
  if (p == null) return '—';
  if (typeof p === 'string') {
    const key = p.trim();
    if (!key) return '—';
    return PROSPECT_TYPE_LABELS[key] || PROSPECT_TYPE_LABELS[key.toUpperCase()] || titleCaseToken(key);
  }
  const raw = p.prospectKind || p.organizationType || p.prospectType || '';
  return formatProspectType(raw);
}

function titleCaseToken(raw: string): string {
  return raw
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Human contactability label — never surface raw snake_case as primary. */
export function formatContactability(p: PartnerProspect | string | undefined | null): string {
  if (p != null && typeof p !== 'string') {
    if (hasEmail(p) || (p.emailVerificationStatus || '').toLowerCase() === 'verified_public') {
      const state = (p.contactabilityState || p.contactState || '').toUpperCase();
      if (state === 'RESEARCHING') return 'Researching';
      return 'Verified email';
    }
    return formatContactability(p.contactabilityState || p.contactState || p.status || p.emailVerificationStatus);
  }
  const raw = (typeof p === 'string' ? p : '').trim();
  if (!raw) return 'Contact needed';
  const s = raw.toLowerCase().replace(/\s+/g, '_');
  if (s === 'verified_public' || s === 'contact_found' || s === 'email' || s === 'available') return 'Verified email';
  if (s === 'researching') return 'Researching';
  if (s === 'no_verified_public_email' || s === 'no_public_contact' || s === 'contacts_unavailable') return 'No public email';
  if (s === 'retry_later') return 'Retry later';
  if (s === 'manual_review') return 'Manual review';
  if (s === 'contact_needed' || s === 'needed' || s === 'unknown' || s === 'invalid') return 'Contact needed';
  if (s.includes('verified')) return 'Verified email';
  if (s.includes('research')) return 'Researching';
  if (s.includes('no_') && s.includes('email')) return 'No public email';
  return titleCaseToken(raw);
}

export function formatLifecycle(value?: string | null): string {
  if (!value?.trim()) return '—';
  const s = value.trim().toUpperCase().replace(/\s+/g, '_');
  const map: Record<string, string> = {
    NEW: 'New',
    QUALIFIED: 'Qualified',
    CONTACTED: 'Contacted',
    FOLLOW_UP: 'Follow-up',
    REPLIED: 'Replied',
    INTERESTED: 'Interested',
    PARTNER: 'Partner',
    CLOSED: 'Closed',
    DRAFT: 'Draft',
    APPROVED: 'Approved',
    SCHEDULED: 'Scheduled',
    SENT: 'Sent',
  };
  return map[s] || titleCaseToken(value);
}

function statusLabelMap(map: Record<string, string>, value?: string | null): string {
  if (!value?.trim()) return '—';
  const s = value.trim().toUpperCase().replace(/\s+/g, '_');
  return map[s] || titleCaseToken(value);
}

export function formatAcquisitionStatus(value?: string | null): string {
  return statusLabelMap(
    {
      DISCOVERED: 'Discovered',
      CONTACT_NEEDED: 'Contact needed',
      CONTACTABLE: 'Contactable',
      QUALIFIED: 'Qualified',
      DRAFT: 'Draft',
      AWAITING_APPROVAL: 'Awaiting approval',
      APPROVED: 'Approved',
      QUEUED: 'Queued',
      SENT: 'Sent',
      DELIVERED: 'Delivered',
      OPENED: 'Opened',
      CLICKED: 'Clicked',
      REPLIED: 'Replied',
      INTERESTED: 'Interested',
      CONVERTED: 'Converted',
      NOT_QUALIFIED: 'Not qualified',
      REJECTED: 'Rejected',
      OPTED_OUT: 'Opted out',
      BOUNCED: 'Bounced',
    },
    value,
  );
}

export function formatCustomerStatus(value?: string | null): string {
  return statusLabelMap(
    {
      NOT_CUSTOMER: 'Not a customer',
      REGISTERED: 'Registered',
      ACTIVATED: 'Activated',
      PAYING_CUSTOMER: 'Paying customer',
    },
    value,
  );
}

export function formatDistributionStatus(value?: string | null): string {
  return statusLabelMap(
    {
      NONE: 'None',
      INVITE_CREATED: 'Invite created',
      SHARING: 'Sharing',
      ACTIVE_SOURCE: 'Active source',
    },
    value,
  );
}

export function formatPartnershipStatus(value?: string | null): string {
  return statusLabelMap(
    {
      NONE: 'None',
      INTERESTED: 'Interested',
      PARTNER: 'Partner',
    },
    value,
  );
}

export function formatEntityType(value?: string | null): string {
  if (!value?.trim()) return '—';
  const s = value.trim().toUpperCase();
  if (s === 'INDIVIDUAL' || s === 'PERSON') return 'Individual';
  if (s === 'ORGANIZATION' || s === 'ORG') return 'Organization';
  return titleCaseToken(value);
}

export function resolveNextAction(
  p: PartnerProspect,
  queueItems: PartnerQueueItem[] = [],
  apiNext?: { key?: string; label?: string; primaryButton?: string } | string | null,
): { key: string; label: string; primaryButton: string } {
  if (apiNext && typeof apiNext === 'object' && (apiNext.key || apiNext.label || apiNext.primaryButton)) {
    const key = (apiNext.key || 'REVIEW').toUpperCase();
    const label = apiNext.label || formatNextActionKey(key);
    return {
      key,
      label,
      primaryButton: apiNext.primaryButton || label,
    };
  }
  if (typeof apiNext === 'string' && apiNext.trim()) {
    const key = apiNext.trim().toUpperCase().replace(/\s+/g, '_');
    const label = formatNextActionKey(key);
    return { key, label, primaryButton: label };
  }
  if (p.nextAction && typeof p.nextAction === 'object') {
    return resolveNextAction(p, queueItems, p.nextAction);
  }
  if (typeof p.nextAction === 'string' && p.nextAction.trim()) {
    return resolveNextAction(p, queueItems, p.nextAction);
  }

  const acq = (p.acquisitionStatus || '').toUpperCase();
  const cust = (p.customerStatus || '').toUpperCase();
  const life = (p.crmLifecycle || '').toUpperCase();
  const emailState = (p.emailState || '').toUpperCase();
  const draft = queueItems.find((q) => q.status === 'draft');
  const approved = queueItems.find((q) => q.status === 'approved');
  const scheduled = queueItems.find((q) => q.status === 'scheduled');

  if (cust === 'REGISTERED' || cust === 'ACTIVATED' || cust === 'PAYING_CUSTOMER') {
    return { key: 'VIEW_CUSTOMER', label: 'View customer', primaryButton: 'View customer' };
  }
  if (life === 'REPLIED' || acq === 'REPLIED') {
    return { key: 'READ_REPLY', label: 'Read reply', primaryButton: 'Open inbox' };
  }
  if (life === 'INTERESTED' || acq === 'INTERESTED') {
    return { key: 'VIEW_ACTIVITY', label: 'Review interest', primaryButton: 'Open' };
  }
  if (draft || acq === 'DRAFT' || acq === 'AWAITING_APPROVAL' || emailState === 'AWAITING_APPROVAL') {
    return { key: 'REVIEW_APPROVE', label: 'Review & approve', primaryButton: 'Open approvals' };
  }
  if (approved || acq === 'APPROVED' || emailState === 'APPROVED') {
    return { key: 'SEND_OR_QUEUE', label: 'Send / queue', primaryButton: 'Open approvals' };
  }
  if (scheduled) {
    return { key: 'VIEW_ACTIVITY', label: 'Follow-up due', primaryButton: 'Open approvals' };
  }
  if (acq === 'SENT' || acq === 'DELIVERED' || acq === 'OPENED' || acq === 'CLICKED' || emailState === 'SENT' || emailState === 'DELIVERED') {
    return { key: 'VIEW_ACTIVITY', label: 'Awaiting reply', primaryButton: 'Open' };
  }
  if (needsContactResearch(p) || acq === 'CONTACT_NEEDED' || acq === 'DISCOVERED') {
    return { key: 'RESEARCH_CONTACT', label: 'Research contact', primaryButton: 'Research contact' };
  }
  if (hasEmail(p) || acq === 'CONTACTABLE' || acq === 'QUALIFIED') {
    return { key: 'CREATE_OUTREACH', label: 'Create outreach', primaryButton: 'Prepare draft' };
  }
  return { key: 'REVIEW', label: 'Review', primaryButton: 'Open' };
}

export function formatNextActionKey(key?: string | null): string {
  if (!key?.trim()) return 'Review';
  const map: Record<string, string> = {
    RESEARCH_CONTACT: 'Research contact',
    CREATE_OUTREACH: 'Create outreach',
    REVIEW_APPROVE: 'Review & approve',
    SEND_OR_QUEUE: 'Send / queue',
    SEND: 'Send',
    VIEW_REPLY: 'View reply',
    READ_REPLY: 'Read reply',
    VIEW_CUSTOMER: 'View customer',
    VIEW_ACTIVITY: 'View activity',
    QUALIFY: 'Qualify',
  };
  const k = key.trim().toUpperCase().replace(/\s+/g, '_');
  return map[k] || titleCaseToken(key);
}

/** Show Convert Partner / Mark Interested only after engagement. */
export function canShowPartnershipActions(p: PartnerProspect): boolean {
  const acq = (p.acquisitionStatus || '').toUpperCase();
  const part = (p.partnershipStatus || '').toUpperCase();
  const life = (p.crmLifecycle || '').toUpperCase();
  const emailState = (p.emailState || '').toUpperCase();
  if (part === 'INTERESTED' || part === 'PARTNER') return true;
  if (life === 'REPLIED' || life === 'INTERESTED' || life === 'PARTNER') return true;
  if (['REPLIED', 'INTERESTED', 'SENT', 'DELIVERED'].includes(acq)) return true;
  // Legacy when AcquisitionStatus not yet populated
  if (!acq && ['SENT', 'DELIVERED'].includes(emailState)) return true;
  return false;
}

export function northStarValues(ns?: import('./types').NorthStars | null) {
  const newSignups = ns?.newSignups ?? ns?.referralSignups ?? 0;
  const activatedUsers = ns?.activatedUsers ?? ns?.activeUsersAcquired ?? 0;
  const payingCustomers = ns?.payingCustomers ?? ns?.customersAcquired ?? 0;
  const creditPurchases = ns?.creditPurchases ?? ns?.payingCustomers ?? ns?.customersAcquired ?? 0;
  const revenueCents = ns?.revenueCents ?? ns?.revenueAttributedCents ?? 0;
  return { newSignups, activatedUsers, payingCustomers, creditPurchases, revenueCents };
}

export function needsContactResearch(p: PartnerProspect): boolean {
  if (hasEmail(p)) return false;
  const state = (p.contactabilityState || p.contactState || '').toUpperCase();
  if (state === 'CONTACT_FOUND') return false;
  if (state === 'NO_PUBLIC_CONTACT' && (p.researchAttempts ?? 0) >= 5) return false;
  return (
    state === 'CONTACT_NEEDED' ||
    state === 'RESEARCHING' ||
    state === 'RETRY_LATER' ||
    state === 'MANUAL_REVIEW' ||
    state === 'UNKNOWN' ||
    !state ||
    p.status === 'no_verified_public_email' ||
    (p.emailVerificationStatus || '').toLowerCase() === 'no_verified_public_email'
  );
}

export function formatResultsCompact(p: PartnerProspect): string {
  const u = p.referralSignups ?? 0;
  const c = p.paidCustomers ?? 0;
  const dollars = ((p.attributedRevenueCents ?? 0) / 100).toFixed(0);
  return `U:${u} C:${c} $${dollars}`;
}

export function formatNextAction(
  p: PartnerProspect,
  queueItems: PartnerQueueItem[],
): string {
  return resolveNextAction(p, queueItems).label;
}

export function ScoreBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number | undefined | null;
  max: number;
}) {
  const n = value == null || Number.isNaN(Number(value)) ? 0 : Number(value);
  const pct = max > 0 ? Math.min(100, Math.max(0, (n / max) * 100)) : 0;
  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {value == null ? '—' : `${n}/${max}`}
        </Typography>
      </Box>
      <Box sx={{ height: 8, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 1, overflow: 'hidden' }}>
        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: 'primary.main', borderRadius: 1 }} />
      </Box>
    </Box>
  );
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
