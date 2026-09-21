/** Shared research-contact outcome parsing for Prospects UI + tests. */

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
};

export type ResearchSummary = {
  ok: boolean;
  text: string;
  kind: 'found' | 'not_found' | 'skipped' | 'failed' | 'website_dead';
};

export function summarizeResearchResult(
  result: ResearchResult | null | undefined,
  name: string,
): ResearchSummary {
  if (result?.found && result.email) {
    return { ok: true, kind: 'found', text: `Found ${result.email} for ${name}` };
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

  if (result?.found === false) {
    const when = result.nextResearchAt
      ? ` · next ${new Date(result.nextResearchAt).toLocaleDateString()}`
      : '';
    const detail = result.message || result.websiteDetail;
    return {
      ok: false,
      kind: 'not_found',
      text: detail ? `${detail}${when}` : `No public email for ${name}${when}`,
    };
  }
  return { ok: false, kind: 'failed', text: `${name}: no contact found` };
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
