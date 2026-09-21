/**
 * Partner Outreach CRM helpers for weekday growth.
 * Uses Admin CRM credentials — never invents metrics or emails.
 */
const DEFAULT_API =
  process.env.GROWTH_CRM_API_BASE_URL ||
  process.env.GTM_API_BASE_URL ||
  'https://goskwzjzjg.execute-api.us-east-1.amazonaws.com';

function apiBase() {
  return String(DEFAULT_API).replace(/\/$/, '');
}

export async function adminCrmToken() {
  const direct = process.env.GROWTH_CRM_ADMIN_TOKEN?.trim();
  if (direct) return direct;
  const email = process.env.GROWTH_CRM_ADMIN_EMAIL?.trim();
  const password = process.env.GROWTH_CRM_ADMIN_PASSWORD;
  if (!email || !password) return null;
  const res = await fetch(`${apiBase()}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const body = await res.json();
  return body?.token || body?.Token || body?.sessionToken || null;
}

async function adminGet(token, path) {
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { Accept: 'application/json', 'X-Admin-Token': token },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`CRM GET ${path} → ${res.status}: ${text.slice(0, 180)}`);
  }
  return res.json();
}

async function adminPost(token, path, body) {
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Admin-Token': token,
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 400) };
  }
  if (!res.ok) {
    throw new Error(`CRM POST ${path} → ${res.status}: ${text.slice(0, 180)}`);
  }
  return json;
}

/**
 * Snapshot Partner Outreach metrics for the daily growth report.
 * Returns status unavailable when credentials missing — never invents counts.
 */
export async function fetchPartnerOutreachSnapshot() {
  const token = await adminCrmToken();
  if (!token) {
    return {
      status: 'unavailable',
      reason: 'Admin CRM credentials not configured (GROWTH_CRM_ADMIN_*)',
    };
  }
  try {
    const [dashboard, metrics, summary, settings] = await Promise.all([
      adminGet(token, '/api/admin/partner-outreach/acquisition/dashboard'),
      adminGet(token, '/api/admin/partner-outreach/metrics'),
      adminGet(token, '/api/admin/partner-outreach/discovery/summary'),
      adminGet(token, '/api/admin/partner-outreach/settings'),
    ]);
    const ns = dashboard?.northStars || {};
    const funnel = dashboard?.funnel || {};
    const actions = Array.isArray(dashboard?.todaysActions) ? dashboard.todaysActions : [];
    const awaiting = funnel.awaitingApproval ?? metrics?.approvalReadyRecipients ?? 0;
    return {
      status: 'ok',
      source: 'admin_partner_outreach_api',
      northStars: ns,
      funnel,
      conversionRates: dashboard?.conversionRates || {},
      todaysActions: actions,
      settings: {
        outreachMode: settings?.outreachMode ?? metrics?.outreachMode ?? 'off',
        pauseAllOutreach: Boolean(settings?.pauseAllOutreach ?? metrics?.pauseAllOutreach),
        sendEnabled: Boolean(settings?.sendEnabled ?? metrics?.sendEnabled),
        complaintPause: Boolean(settings?.complaintPause ?? metrics?.complaintPause),
      },
      discovery: summary,
      // Legacy EXP-002 fields (honest mapping — no fabricated partner pages)
      partnerPagesCreated: summary?.inviteCodesGenerated ?? funnel.discovered ?? 'Unavailable',
      inviteCodesCreated: summary?.inviteCodesGenerated ?? 'Unavailable',
      draftsPrepared: funnel.drafts ?? summary?.draftsGenerated ?? 0,
      recipientsApproved: funnel.approved ?? metrics?.approvedRecipients ?? 0,
      emailsSent: funnel.sent ?? metrics?.sent ?? 0,
      delivered: metrics?.delivered ?? 'Unavailable',
      partnerResponses: metrics?.replies ?? funnel.replied ?? 0,
      partnerAttributedVisits: 'Unavailable',
      partnerAttributedSignups: ns.referralSignups ?? 'Unavailable',
      completedProfiles: ns.activeUsersAcquired ?? 'Unavailable',
      discoverUsers: 'Unavailable',
      connectionRequests: 'Unavailable',
      customersAcquired: ns.customersAcquired ?? 0,
      revenueAttributedCents: ns.revenueAttributedCents ?? 0,
      ownerAction:
        awaiting > 0
          ? `${awaiting} high-value outreach message${awaiting === 1 ? '' : 's'} waiting for approval. Open Admin → Partner Outreach → Approvals.`
          : 'No drafts awaiting approval.',
      approvalsAdminUrl: 'https://gettrainmate.com/admin/partner-outreach',
    };
  } catch (e) {
    return {
      status: 'unavailable',
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Limited partner discovery for a growth run (async job + poll).
 * Caps come from CRM settings unless overridden.
 */
export async function runLimitedPartnerDiscovery({
  dryRun = false,
  maxProspects,
  maxResearchAttempts,
  maxDrafts,
  onlyCampaignId,
  seedsOnly = false,
  prepareDrafts = true,
  maxPollMs = 180_000,
} = {}) {
  const token = await adminCrmToken();
  if (!token) {
    return { ok: false, status: 'skipped', reason: 'Admin CRM credentials not configured' };
  }
  if (dryRun) {
    return { ok: true, status: 'dry_run', note: 'Would start discovery/jobs' };
  }
  try {
    const job = await adminPost(token, '/api/admin/partner-outreach/discovery/jobs', {
      prepareDrafts,
      seedsOnly,
      onlyCampaignId,
      maxProspects,
      maxResearchAttempts,
      maxDrafts,
    });
    const jobId = job?.jobId || job?.JobId;
    if (!jobId) {
      return { ok: false, status: 'failed', reason: 'No jobId returned', job };
    }
    const started = Date.now();
    let latest = job;
    while (Date.now() - started < maxPollMs) {
      await new Promise((r) => setTimeout(r, 2000));
      latest = await adminGet(token, `/api/admin/partner-outreach/discovery/jobs/${encodeURIComponent(jobId)}`);
      const st = String(latest?.status || '').toLowerCase();
      if (st === 'complete' || st === 'partial' || st === 'failed') break;
    }
    return {
      ok: ['complete', 'partial'].includes(String(latest?.status || '').toLowerCase()),
      status: latest?.status || 'unknown',
      jobId,
      prospectsFound: latest?.prospectsFound ?? 0,
      draftsCreated: latest?.draftsCreated ?? 0,
      contactsFound: latest?.contactsFound ?? 0,
      stage: latest?.stage,
      error: latest?.error || null,
    };
  } catch (e) {
    return {
      ok: false,
      status: 'failed',
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Dispatch previously approved partner emails (never auto-approves).
 */
export async function dispatchApprovedPartnerOutreach({ dryRun = false } = {}) {
  const token = await adminCrmToken();
  if (!token) {
    return { ok: false, status: 'skipped', reason: 'Admin CRM credentials not configured' };
  }
  if (dryRun) {
    return { ok: true, status: 'dry_run', note: 'Would POST /dispatch' };
  }
  try {
    const result = await adminPost(token, '/api/admin/partner-outreach/dispatch', {});
    return { ok: true, status: 'ok', result };
  } catch (e) {
    return {
      ok: false,
      status: 'failed',
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}
