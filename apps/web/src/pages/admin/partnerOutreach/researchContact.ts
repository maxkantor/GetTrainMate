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
