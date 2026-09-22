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
  // Prefer sessionToken for X-Admin-Token (Cognito JWT in `token` breaks AdminTokenAuth).
  return body?.sessionToken || body?.token || body?.Token || null;
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
 * Distinguishes: ok (real numbers, including 0) vs unavailable vs error.
 */
export async function fetchPartnerOutreachSnapshot() {
  const token = await adminCrmToken();
  if (!token) {
    return {
      status: 'unavailable',
      reason:
        'Admin CRM credentials not configured. Set GROWTH_CRM_ADMIN_EMAIL/PASSWORD (or SSM /gettrainmate/growth/crm-admin-* / ses-admin-email + admin/password).',
    };
  }
  try {
    const [dashboard, metrics, summary, settings, pipeline] = await Promise.all([
      adminGet(token, '/api/admin/partner-outreach/acquisition/dashboard'),
      adminGet(token, '/api/admin/partner-outreach/metrics'),
      adminGet(token, '/api/admin/partner-outreach/discovery/summary'),
      adminGet(token, '/api/admin/partner-outreach/settings'),
      adminGet(token, '/api/admin/partner-outreach/prospects/pipeline-counters').catch(() => null),
    ]);
    const ns = dashboard?.northStars || {};
    const funnel = dashboard?.funnel || {};
    const actions = Array.isArray(dashboard?.todaysActions) ? dashboard.todaysActions : [];
    const awaiting = Number(funnel.awaitingApproval ?? metrics?.approvalReadyRecipients ?? 0);
    const prospects = Number(
      pipeline?.prospects ?? summary?.organizationsDiscovered ?? funnel.discovered ?? 0,
    );
    const contacts = Number(
      pipeline?.emailsFound ?? summary?.verifiedPublicContacts ?? metrics?.verifiedPublicContacts ?? 0,
    );
    const needContact = Number(pipeline?.needContact ?? funnel.contactNeeded ?? 0);
    const drafts = Number(funnel.drafts ?? summary?.draftsGenerated ?? metrics?.draftsGenerated ?? 0);
    const approved = Number(funnel.approved ?? metrics?.approvedRecipients ?? 0);
    const sent = Number(funnel.sent ?? metrics?.sent ?? 0);
    const replies = Number(metrics?.replies ?? funnel.replied ?? 0);
    const interested = Number(funnel.interested ?? 0);
    const partners = Number(funnel.partners ?? 0);

    return {
      status: 'ok',
      source: 'admin_partner_outreach_api',
      northStars: ns,
      funnel,
      pipeline: pipeline || null,
      conversionRates: dashboard?.conversionRates || {},
      todaysActions: actions,
      settings: {
        outreachMode: settings?.outreachMode ?? metrics?.outreachMode ?? 'off',
        pauseAllOutreach: Boolean(settings?.pauseAllOutreach ?? metrics?.pauseAllOutreach),
        sendEnabled: Boolean(settings?.sendEnabled ?? metrics?.sendEnabled),
        complaintPause: Boolean(settings?.complaintPause ?? metrics?.complaintPause),
        keepPipelineFull: Boolean(settings?.keepPipelineFull ?? pipeline?.keepPipelineFull),
        targetProspectInventory: Number(
          settings?.targetProspectInventory ?? pipeline?.targetProspectInventory ?? 200,
        ),
      },
      discovery: summary,
      // Explicit funnel counts — 0 means queried and empty, never "Unavailable"
      prospects,
      contacts,
      needContact,
      draftsPrepared: drafts,
      awaitingApproval: awaiting,
      recipientsApproved: approved,
      emailsSent: sent,
      delivered: Number(metrics?.delivered ?? 0),
      partnerResponses: replies,
      interested,
      partners,
      partnerPagesCreated: Number(summary?.inviteCodesGenerated ?? 0),
      inviteCodesCreated: Number(summary?.inviteCodesGenerated ?? 0),
      partnerAttributedVisits: null, // GA4 partner attribution not wired — report as Unavailable separately
      partnerAttributedSignups: ns.referralSignups != null ? Number(ns.referralSignups) : null,
      completedProfiles: ns.activeUsersAcquired != null ? Number(ns.activeUsersAcquired) : null,
      discoverUsers: null,
      connectionRequests: null,
      customersAcquired: Number(ns.customersAcquired ?? 0),
      revenueAttributedCents: Number(ns.revenueAttributedCents ?? 0),
      ownerAction:
        (() => {
          const paused = Boolean(settings?.pauseAllOutreach ?? metrics?.pauseAllOutreach);
          if (paused) {
            return 'Emergency pause is on. Resume in Admin → Customer Acquisition → Settings only for emergencies.';
          }
          if (awaiting > 0) {
            return `${awaiting} message${awaiting === 1 ? '' : 's'} need approval. Open Admin → Customer Acquisition → Approvals → APPROVE & SEND.`;
          }
          if (approved > 0) {
            return `${approved} approved for next send — daily job will dispatch when capacity allows.`;
          }
          if (needContact > 0) {
            return `${needContact} prospects still need contact discovery.`;
          }
          return 'No action required today.';
        })(),
      approvalsAdminUrl: 'https://gettrainmate.com/admin/partner-outreach?tab=approvals',
    };
  } catch (e) {
    return {
      status: 'error',
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
 * Research CONTACT_NEEDED prospects (controlled batch). Never invents emails.
 */
export async function researchContactNeededBatch({ dryRun = false, max } = {}) {
  const token = await adminCrmToken();
  if (!token) {
    return { ok: false, status: 'skipped', reason: 'Admin CRM credentials not configured' };
  }
  if (dryRun) {
    return { ok: true, status: 'dry_run', note: 'Would POST research/contact-needed' };
  }
  try {
    const body = max != null ? { max } : {};
    const result = await adminPost(token, '/api/admin/partner-outreach/research/contact-needed', body);
    return { ok: true, status: 'ok', result };
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
