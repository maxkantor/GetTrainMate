/** Shared contact-discovery outcome parsing for Prospects UI + tests. */

export type ResearchResult = {
  ok?: boolean;
  found?: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
  message?: string;
  email?: string;
  prospectId?: string;
  nextResearchAt?: string;
  researchAttempts?: number;
  contactabilityState?: string;
  websiteStatus?: string;
  websiteDetail?: string;
  website?: string;
  /** discover-contact fields */
  organizationName?: string;
  foundEmail?: string;
  status?: string;
  confidence?: string;
  contactFormUrl?: string;
  pendingReviewEmail?: string;
  sourceUrl?: string;
  summary?: string;
  detail?: string;
  reasonCode?: string;
  pagesCheckedCount?: number;
  fromCache?: boolean;
};

export type ResearchSummary = {
  ok: boolean;
  text: string;
  kind:
    | 'found'
    | 'review_required'
    | 'contact_form'
    | 'not_found'
    | 'skipped'
    | 'failed'
    | 'website_dead';
};

export function summarizeResearchResult(
  result: ResearchResult | null | undefined,
  name: string,
): ResearchSummary {
  const status = (result?.status || '').toUpperCase();
  const foundEmail = result?.foundEmail || result?.email;
  if ((result?.found || status === 'EMAIL_FOUND' || status === 'MANUAL_CONTACT') && foundEmail) {
    const cached = result?.fromCache ? ' (cached)' : '';
    return { ok: true, kind: 'found', text: `Found ${foundEmail} for ${name}${cached}` };
  }
  if (result?.skipped) {
    const why =
      result.reason === 'retry_later'
        ? 'still in cooldown'
        : result.reason === 'max_research_attempts'
          ? 'max attempts reached'
          : result.reason || 'skipped';
    return { ok: false, kind: 'skipped', text: `${name}: ${why}` };
  }
  if (result?.ok === false) {
    return {
      ok: false,
      kind: 'failed',
      text: `${name}: ${result.error || result.message || result.reason || 'research failed'}`,
    };
  }

  const reason = (result?.reason || '').toLowerCase();
  if (status === 'REVIEW_REQUIRED' || reason === 'review_required' || result?.pendingReviewEmail) {
    const candidate = result?.pendingReviewEmail || foundEmail;
    const confidence = (result?.confidence || '').toLowerCase();
    return {
      ok: false,
      kind: 'review_required',
      text:
        result?.message ||
        `${name}: found ${candidate || 'a candidate email'}${
          confidence ? ` (${confidence} confidence)` : ''
        } — accept or reject it before sending`,
    };
  }
  if (status === 'CONTACT_FORM_FOUND' || reason === 'contact_form_only') {
    return {
      ok: false,
      kind: 'contact_form',
      text:
        result?.message ||
        `${name}: no public email — the site only offers a contact form`,
    };
  }
  if (reason === 'website_dead' || result?.websiteStatus === 'ParkingOrDisconnected') {
    return {
      ok: false,
      kind: 'website_dead',
      text:
        result?.websiteDetail ||
        result?.message ||
        `${name}: website is dead / not connected — use Enter contact manually`,
    };
  }
  if (reason === 'website_unreachable' || result?.websiteStatus === 'Unreachable') {
    return {
      ok: false,
      kind: 'website_dead',
      text:
        result?.websiteDetail ||
        result?.message ||
        `${name}: website unreachable — use Enter contact manually`,
    };
  }

  if (result?.found === false || status) {
    const when = result?.nextResearchAt
      ? ` · next ${new Date(result.nextResearchAt).toLocaleDateString()}`
      : '';
    const detail = result?.message || result?.websiteDetail;
    const fallback =
      status === 'NO_PUBLIC_CONTACT'
        ? `No public contact found for ${name}`
        : `No public email for ${name}`;
    return {
      ok: false,
      kind: 'not_found',
      text: detail ? `${detail}${when}` : `${fallback}${when}`,
    };
  }
  return { ok: false, kind: 'failed', text: `${name}: no contact found` };
}

/** Aggregate response of POST prospects/discover-contacts. */
export type DiscoveryBatchResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  dryRun?: boolean;
  processed?: number;
  emailsFound?: number;
  formsFound?: number;
  reviewRequired?: number;
  noContact?: number;
  errors?: number;
  cacheHits?: number;
  remaining?: number;
  eligible?: number;
  stoppedEarly?: boolean;
  results?: ResearchResult[];
};

export type DiscoveryProgress = {
  processed: number;
  total: number;
  emailsFound: number;
  formsFound: number;
  reviewRequired: number;
  noContact: number;
  remaining: number;
};

export function discoveryProgressFrom(
  raw: DiscoveryBatchResponse | null | undefined,
  requestedCount: number,
): DiscoveryProgress {
  const processed = Number(raw?.processed ?? 0);
  const remaining = Number(raw?.remaining ?? 0);
  return {
    processed,
    total: Number(raw?.eligible ?? 0) || requestedCount || processed,
    emailsFound: Number(raw?.emailsFound ?? 0),
    formsFound: Number(raw?.formsFound ?? 0),
    reviewRequired: Number(raw?.reviewRequired ?? 0),
    noContact: Number(raw?.noContact ?? 0),
    remaining,
  };
}

export function summarizeDiscoveryBatch(
  raw: DiscoveryBatchResponse | null | undefined,
  requestedCount: number,
): ResearchSummary {
  if (raw?.ok === false) {
    return {
      ok: false,
      kind: 'failed',
      text: raw.error || raw.message || 'Contact discovery failed',
    };
  }
  const p = discoveryProgressFrom(raw, requestedCount);
  const bits = [
    `${p.emailsFound} email${p.emailsFound === 1 ? '' : 's'}`,
    `${p.formsFound} contact form${p.formsFound === 1 ? '' : 's'}`,
    `${p.reviewRequired} to review`,
    `${p.noContact} no contact`,
  ];
  if (raw?.errors) bits.push(`${raw.errors} error${raw.errors === 1 ? '' : 's'}`);
  const tail = p.remaining > 0 ? ` · ${p.remaining} remaining` : '';
  return {
    ok: p.emailsFound > 0 || p.formsFound > 0 || p.reviewRequired > 0,
    kind: p.emailsFound > 0 ? 'found' : p.reviewRequired > 0 ? 'review_required' : 'not_found',
    text: `Discovery processed ${p.processed} of ${p.total}: ${bits.join(' · ')}${tail}`,
  };
}

export type ResearchStageState = 'done' | 'active' | 'pending';

export type ResearchStage = {
  key: string;
  label: string;
  state: ResearchStageState;
};

export type ContactDiscoveryJob = {
  jobId: string;
  status?: string;
  stage?: string;
  progressPct?: number;
  total?: number;
  processed?: number;
  emailsFound?: number;
  formsFound?: number;
  reviewRequired?: number;
  noContact?: number;
  errors?: number;
  remaining?: number;
  currentProspectId?: string;
  currentProspectName?: string;
  researchStages?: ResearchStage[];
  error?: string;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
  active?: boolean;
};

export type PipelineCounters = {
  prospects?: number;
  emailsFound?: number;
  contactForms?: number;
  needContact?: number;
  readyToReview?: number;
  approved?: number;
  sentToday?: number;
  sent7d?: number;
  sentLifetime?: number;
  partners7d?: number;
  partnersLifetime?: number;
  attributedSignups7d?: number;
  attributedSignupsLifetime?: number;
  customers?: number;
  eligibleUnsent?: number;
  keepPipelineFull?: boolean;
  targetProspectInventory?: number;
};

/** Prospect-level discovery outcome. Never invents an inbox. */
export type DiscoveryClass =
  | 'PUBLIC EMAIL FOUND'
  | 'NO PUBLIC EMAIL'
  | 'NEEDS REVIEW'
  | 'INVALID'
  | 'ERROR'
  | null;

export function classifyDiscoveryStatus(status?: string | null, hasUsableEmail = false): DiscoveryClass {
  if (hasUsableEmail) return 'PUBLIC EMAIL FOUND';
  const s = String(status || '').toUpperCase();
  if (s === 'EMAIL_FOUND' || s === 'MANUAL_CONTACT' || s === 'CONTACT_FOUND') return 'PUBLIC EMAIL FOUND';
  if (s === 'REVIEW_REQUIRED' || s === 'MANUAL_REVIEW') return 'NEEDS REVIEW';
  if (s === 'INVALID') return 'INVALID';
  if (s === 'ERROR' || s === 'FAILED') return 'ERROR';
  if (s === 'NO_PUBLIC_CONTACT' || s === 'CONTACT_FORM_FOUND') return 'NO PUBLIC EMAIL';
  return null;
}

const CONTACT_JOB_TERMINAL = new Set(['complete', 'partial', 'failed']);

export function isContactJobTerminal(status?: string): boolean {
  return CONTACT_JOB_TERMINAL.has((status || '').toLowerCase());
}

export function isContactJobRunning(status?: string): boolean {
  const s = (status || '').toLowerCase();
  return s === 'running' || s === 'starting' || s === 'queued' || s === 'researching';
}

export function contactJobProgressFrom(job: ContactDiscoveryJob | null | undefined): DiscoveryProgress & {
  progressPct: number | null;
  measurable: boolean;
  errors: number;
  currentProspectName: string;
  stages: ResearchStage[];
  status: string;
  jobId: string;
} {
  const total = Number(job?.total ?? 0);
  const processed = Number(job?.processed ?? 0);
  const remaining = Number(job?.remaining ?? Math.max(0, total - processed));
  const measurable = total > 0 && processed > 0;
  const progressPct = measurable ? Math.round((processed / total) * 100) : null;
  return {
    jobId: String(job?.jobId || ''),
    status: String(job?.status || ''),
    processed,
    total,
    emailsFound: Number(job?.emailsFound ?? 0),
    formsFound: Number(job?.formsFound ?? 0),
    reviewRequired: Number(job?.reviewRequired ?? 0),
    noContact: Number(job?.noContact ?? 0),
    remaining,
    progressPct,
    measurable,
    errors: Number(job?.errors ?? 0),
    currentProspectName: String(job?.currentProspectName || ''),
    stages: Array.isArray(job?.researchStages) ? job!.researchStages! : [],
  };
}

export function summarizeContactJob(job: ContactDiscoveryJob | null | undefined): ResearchSummary {
  const p = contactJobProgressFrom(job);
  const bits = [
    `${p.emailsFound} email${p.emailsFound === 1 ? '' : 's'}`,
    `${p.formsFound} form${p.formsFound === 1 ? '' : 's'}`,
    `${p.reviewRequired} review`,
    `${p.errors} failed`,
  ];
  const status = (job?.status || '').toLowerCase();
  if (status === 'failed') {
    return { ok: false, kind: 'failed', text: job?.error || 'Contact discovery failed' };
  }
  const done = isContactJobTerminal(status);
  return {
    ok: p.emailsFound > 0,
    kind: p.emailsFound > 0 ? 'found' : 'not_found',
    text: done
      ? `Discovery finished ${p.processed}/${p.total}: ${bits.join(' · ')}`
      : `Discovery ${p.processed}/${p.total}: ${bits.join(' · ')} · ${p.remaining} remaining`,
  };
}

/** Default checklist while a prospect is being researched (client-side animation). */
export const DEFAULT_RESEARCH_STAGES: ResearchStage[] = [
  { key: 'website', label: 'Official website', state: 'active' },
  { key: 'contact', label: 'Contact page', state: 'pending' },
  { key: 'about', label: 'About / staff pages', state: 'pending' },
  { key: 'listings', label: 'Public business listings', state: 'pending' },
  { key: 'social', label: 'Social profile links', state: 'pending' },
];

export function summarizeBulkResearch(
  results: ResearchResult[],
  nameById: Map<string, string>,
  requestedCount: number,
): ResearchSummary {
  let found = 0;
  let missed = 0;
  const notes: string[] = [];
  for (const r of results) {
    const name = nameById.get(String(r.prospectId || '')) || String(r.prospectId || 'prospect');
    const summary = summarizeResearchResult(r, name);
    if (summary.ok) found += 1;
    else missed += 1;
    if (notes.length < 3) notes.push(summary.text);
  }
  const headline =
    found > 0
      ? `Found ${found} contact${found === 1 ? '' : 's'}${missed ? ` · ${missed} no email` : ''} (of ${requestedCount})`
      : `No contacts found (${missed || requestedCount} researched)`;
  const detail = notes.join(' · ');
  return {
    ok: found > 0,
    kind: found > 0 ? 'found' : 'not_found',
    text: detail ? `${headline}. ${detail}` : headline,
  };
}

