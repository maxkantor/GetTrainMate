/**
 * Admin growth-report HTML + text (LuckyNumbersLab layout; GetTrainMate TRAIN + VIBE + DATE order).
 */
import { SITE, EXP001, EXP002, EXP003, TIMEZONE } from './metric-definitions.mjs';
import { formatCell, formatCellLabeled } from './normalize-metrics.mjs';
import { loadStripeAllowlist, summarizeUnattributedPayments } from './stripe-attribution.mjs';
import { ownerActionRequiredForMeta } from './meta-token.mjs';
import { modeTotalsFromMetro, pocketsFromMetroCrm } from './market-density.mjs';
import { AUTOMATION_HEALTHY, buildOwnerActions, ownerActionRequiresMax } from './owner-actions.mjs';

function ascii(s) {
  return String(s ?? '')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2026]/g, '...')
    .replace(/[\u2190-\u21FF]/g, '->')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
}

function escapeHtml(s) {
  return ascii(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatEt(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const dateStr = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(d);
  const timeStr = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(d);
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
  const monthDayYear = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(d);
  const shortDate = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    month: 'short',
    day: 'numeric'
  }).format(d);
  return {
    dateStr,
    timeStr: `${timeStr} ${TIMEZONE}`,
    isoDate: ymd,
    ymd,
    monthDayYear,
    shortDate,
    zone: TIMEZONE
  };
}

function shiftYmd(ymd, days) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0)).toISOString().slice(0, 10);
}

function formatMonthDayYearFromYmd(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  if (!y || !m || !d) return String(ymd);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
}

const H2 = 'font-size:18px;margin:28px 0 10px;color:#9a3412;';
const H2_FIRST = 'font-size:18px;margin:0 0 10px;color:#9a3412;';
const CELL = 'padding:10px 14px;';

function kvTable(rows, { peach = false } = {}) {
  const wrap = peach
    ? 'margin:0 0 18px;border:1px solid #fdba74;border-radius:8px;border-collapse:separate;font-size:15px;background:#fff7ed;'
    : 'margin:0 0 18px;border:1px solid #e2e8f0;border-radius:8px;border-collapse:separate;font-size:15px;';
  const line = peach ? '#fed7aa' : '#e5e7eb';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${wrap}">${rows
    .map((row, i) => {
      const last = i === rows.length - 1;
      const bb = last ? '' : `border-bottom:1px solid ${line};`;
      const long = String(row.value ?? '').length > 42;
      const align = long || row.left ? '' : 'text-align:right;';
      return `<tr><td style="${CELL}${bb}"><b>${escapeHtml(row.label)}</b></td><td style="${CELL}${bb}${align}">${escapeHtml(String(row.value ?? ''))}</td></tr>`;
    })
    .join('')}</table>`;
}

function badge(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'ok' || s === 'yes' || s === 'keep' || s === 'kept' || s === 'published') {
    return { label: status, color: '#047857', bg: '#ecfdf5' };
  }
  if (s === 'warning' || s === 'no' || s === 'collecting') {
    return { label: status, color: '#b45309', bg: '#fffbeb' };
  }
  return { label: status, color: '#b91c1c', bg: '#fef2f2' };
}

export function growthEmailSubject({ et, shipped = false, social, testEmail = false, newCustomersThisRun = '0' } = {}) {
  const published = Boolean(social?.fbYes || social?.igYes);
  const status = social?.metaAuth?.status || '';
  const phrase = shipped
    ? 'Acquisition change deployed'
    : published
      ? 'Owned social published'
      : status === 'META_TOKEN_EXPIRED' || /META_TOKEN_EXPIRED|expired/i.test(String(social?.blocker || ''))
        ? 'Meta token expired'
        : social?.blocker
          ? 'Distribution failed'
          : 'No change deployed';
  const n = Number(newCustomersThisRun) || 0;
  const customers = n === 1 ? '1 new customer this run' : `${n} new customers this run`;
  const base = `GetTrainMate Growth - ${phrase} - ${customers} - ${et.shortDate}`;
  return testEmail ? `[TEST] ${base}` : base;
}

export function formatMetroDensityLines(md) {
  if (!md || md.status !== 'ok' || !Array.isArray(md.metros) || md.metros.length === 0) {
    return 'Unavailable';
  }
  return md.metros
    .map((row) => {
      const metro = row.metro || row.Metro || 'Unknown';
      const completed = row.completedProfiles ?? row.CompletedProfiles ?? 0;
      const profiles = row.profiles ?? row.Profiles ?? 0;
      return `${metro}: ${completed} completed / ${profiles} profiles`;
    })
    .join('; ');
}

export function formatMetroUnavailable(md) {
  if (!md || md.status === 'ok') {
    if (md?.status === 'ok') {
      const lines = formatMetroDensityLines(md);
      if (lines && lines !== 'Unavailable') {
        return ['Metro CRM (by market — not a global total):', lines].join('\n');
      }
    }
    return null;
  }
  const cause =
    md.cause ||
    (String(md.reason || '').includes('GROWTH_METRO_READ_TOKEN')
      ? 'GROWTH_METRO_READ_TOKEN is not configured'
      : ascii(md.reason || 'Unavailable'));
  const http = md.httpStatus || 503;
  return [
    'Metro CRM: Unavailable',
    `Cause: ${cause}`,
    `HTTP status: ${http} Configuration unavailable`,
    `Customer data exposed: ${md.customerDataExposed === true ? 'Yes' : 'No'}`
  ].join('\n');
}

export const PREPARED_OWNED_SOCIAL = {
  facebookUrl: 'https://www.facebook.com/gettrainmate',
  instagramUrl: 'https://www.instagram.com/gettrainmate/'
};

function ownedSocialSummary(snapshot) {
  const os = snapshot?.ownedSocial || {};
  const fb = os.facebook || {};
  const ig = os.instagram || {};
  const fbYes =
    fb.published === true ||
    Boolean(String(fb.postId || '').trim() && /already_published/i.test(String(fb.reason || '')));
  const igYes =
    ig.published === true ||
    Boolean(String(ig.postId || '').trim() && /already_published/i.test(String(ig.reason || '')));
  const parts = [];
  if (fbYes) parts.push(`Facebook ${fb.postId || 'published'}`);
  if (igYes) parts.push(`Instagram ${ig.postId || 'published'}`);
  const executed = parts.length ? parts.join(' + ') : 'none';
  const rawBlocker = os.connectorBlocker || fb.blocker || ig.blocker || '';
  const authStatus = os.metaAuth?.status || '';
  const authIsFailure =
    Boolean(authStatus) && !/^(META_VALID|VALID|OK)$/i.test(authStatus);
  const blocker = rawBlocker || (authIsFailure ? authStatus : '');
  const attempted = os.distributionAttempted === true || Boolean(os.contentId) || Boolean(blocker) || fbYes || igYes;
  const metaAuth = os.metaAuth || null;
  return { os, fb, ig, fbYes, igYes, executed, blocker, attempted, metaAuth };
}

export function defaultAcquisitionLead(snapshot) {
  const allow = loadStripeAllowlist();
  const board30 = snapshot?.scoreboard?.['30d'] || {};
  const board7 = snapshot?.scoreboard?.['7d'] || {};
  const observed = formatCell(board30.unique_paying_customers);
  const existing = allow.reconciliationComplete
    ? observed === 'Unavailable'
      ? '0'
      : observed
    : '0';
  const social = ownedSocialSummary(snapshot);
  const channel = [
    social.fbYes ? `Facebook ${PREPARED_OWNED_SOCIAL.facebookUrl}` : null,
    social.igYes ? `Instagram ${PREPARED_OWNED_SOCIAL.instagramUrl}` : null
  ]
    .filter(Boolean)
    .join(' + ') || 'Owned social (Facebook + Instagram)';
  const published = social.fbYes || social.igYes;
  return {
    distributionAttempted: social.attempted ? 'YES' : 'NO',
    distributionExecuted: published ? 'YES' : 'NO',
    technicalDistributionResult: published ? 'SUCCEEDED' : social.attempted ? 'FAILED' : 'NOT_ATTEMPTED',
    distributionExecutedDetail: published ? social.executed : 'none — API failure or blocked is not distribution',
    audienceChannel: channel,
    attributedVisits: published ? 'Pending GA4 (post just published)' : '0',
    activations: formatCell(board7.completed_signups),
    checkoutStarts: formatCell(board7.checkout_starts || board7.checkoutStarts),
    newlyAttributedExternalCustomers: '0',
    verifiedRevenue: '$0.00',
    requiredOwnerApproval: ownerActionRequiredForMeta(social.metaAuth, { published })
      ? social.metaAuth?.status === 'SSM_ACCESS_DENIED'
        ? 'YES — grant ssm:GetParameter on /gettrainmate/growth/* to the growth automation IAM user'
        : social.metaAuth?.authentication === 'INVALID' || !social.metaAuth
          ? 'YES — META REAUTHORIZATION / credentials'
          : 'YES — owner intervention required'
      : published
        ? 'No per-post owner approval required when Meta Page token is valid'
        : social.blocker
          ? `Meta: ${social.blocker}`
          : 'NO',
    existingCustomers: existing,
    customersObservedInWindow:
      observed === 'Unavailable'
        ? '0 (do not call observed payers new customers)'
        : `${observed} (observed in window; not new customers this run)`,
    customersCausallyAttributedToExperiment: '0 (no causal proof this run)',
    newCustomersAcquiredByThisRun: '0'
  };
}

/** Coerce boolean / loose strings to YES|NO; return null if not a yes/no token. */
export function coerceYesNo(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (s === '') return null;
  if (/^(YES|TRUE|1)$/i.test(s)) return 'YES';
  if (/^(NO|FALSE|0)$/i.test(s)) return 'NO';
  return null;
}

/**
 * Merge snapshot.acquisitionLead or a JSON object in notes with defaults.
 * Unknown / missing fields stay honest zeros or "none".
 * Live publish evidence on the snapshot wins over stale notes that claim no distribution
 * or missing Meta credentials after a successful Facebook/Instagram publish.
 */
export function resolveAcquisitionLead({ snapshot, notes, acquisition } = {}) {
  const base = defaultAcquisitionLead(snapshot);
  let extra = acquisition && typeof acquisition === 'object' ? acquisition : null;
  const noteText = String(notes || '').trim();
  if (!extra && noteText.startsWith('{')) {
    try {
      extra = JSON.parse(noteText);
    } catch {
      extra = null;
    }
  }
  if (!extra) return base;
  const out = { ...base };
  for (const key of Object.keys(base)) {
    if (extra[key] != null && String(extra[key]).trim() !== '') out[key] = String(extra[key]).trim();
  }
  const coercedExec = coerceYesNo(extra.distributionExecuted);
  if (coercedExec) {
    out.distributionExecuted = coercedExec;
  } else if (extra.distributionExecuted != null && String(extra.distributionExecuted).trim() !== '') {
    // Notes often pass a narrative under distributionExecuted — keep YES/NO semantics.
    if (!/^(YES|NO)$/i.test(String(extra.distributionExecuted).trim())) {
      out.distributionExecutedDetail = String(extra.distributionExecuted).trim();
      if (extra.distributionAttempted == null) out.distributionAttempted = 'YES';
      out.distributionExecuted = base.distributionExecuted;
    }
  }
  // Snapshot publish truth beats stale notes (e.g. distributionExecuted: false + Meta BLOCKING).
  if (base.distributionExecuted === 'YES') {
    out.distributionExecuted = 'YES';
    out.technicalDistributionResult = base.technicalDistributionResult;
    if (!out.distributionExecutedDetail || /^none\b/i.test(out.distributionExecutedDetail)) {
      out.distributionExecutedDetail = base.distributionExecutedDetail;
    }
    if (/Meta Page credentials missing|META REAUTHORIZATION|credentials missing/i.test(String(out.requiredOwnerApproval || ''))) {
      out.requiredOwnerApproval = base.requiredOwnerApproval;
    }
  }
  return out;
}

export function computeBusinessScoreboard(snapshot, md) {
  const board7 = snapshot?.scoreboard?.['7d'] || {};

  // Sessions = GA4 sessions metric (browsing sessions)
  const sessionsAvailable = Boolean(board7.sessions?.available);
  const totalSessions = sessionsAvailable ? Number(board7.sessions.value ?? 0) : null;

  // Unique users = GA4 totalUsers when available
  const usersAvailable = Boolean(board7.active_users?.available);
  const uniqueUsers = usersAvailable ? Number(board7.active_users.value ?? 0) : null;

  // Landing events = GA4 landing_page_view event count (NOT the same as visitors/sessions)
  const landingsAvailable = Boolean(board7.landings?.available);
  const landingEvents = landingsAvailable ? Number(board7.landings.value ?? 0) : null;

  // Campaign-attributed visitors from experimentAttribution when present
  const attr7 = snapshot?.experimentAttribution?.['7d'];
  const campaignVisitors =
    attr7?.landing_users?.available != null && attr7.landing_users.available !== false
      ? Number(attr7.landing_users.value ?? 0)
      : attr7?.landings?.available
        ? Number(attr7.landings.value ?? 0)
        : null;

  // Qualified external visitors for funnel: prefer unique users, else sessions, else landing events (labeled)
  let qualifiedVisitors = null;
  let qualifiedVisitorUnit = 'unavailable';
  if (uniqueUsers != null) {
    qualifiedVisitors = uniqueUsers;
    qualifiedVisitorUnit = 'unique_users';
  } else if (totalSessions != null) {
    qualifiedVisitors = totalSessions;
    qualifiedVisitorUnit = 'sessions';
  } else if (landingEvents != null) {
    qualifiedVisitors = landingEvents;
    qualifiedVisitorUnit = 'landing_page_view_events';
  }

  const signups = board7.completed_signups?.available
    ? Number(board7.completed_signups.value ?? 0)
    : board7.signup_starts?.available
      ? Number(board7.signup_starts.value ?? 0)
      : 0;

  const completedProfiles = board7.completed_profiles?.available
    ? Number(board7.completed_profiles.value ?? 0)
    : 0;

  const discoverUsers = board7.discover_users?.available ? Number(board7.discover_users.value ?? 0) : 0;
  const requests = board7.connections_sent?.available ? Number(board7.connections_sent.value ?? 0) : 0;
  const matches = board7.matches_created?.available ? Number(board7.matches_created.value ?? 0) : 0;
  const firstMessages = board7.first_messages?.available ? Number(board7.first_messages.value ?? 0) : 0;
  // Meaningful interactions = Discover starters (unique-user style metric when available)
  const interactions = discoverUsers;

  const payingCustomers = board7.unique_paying_customers?.available
    ? Number(board7.unique_paying_customers.value ?? 0)
    : 0;

  const rawRev = board7.revenue?.value;
  const revenueStr =
    rawRev != null && !isNaN(Number(rawRev))
      ? `$${Number(rawRev).toFixed(2)}`
      : typeof rawRev === 'string' && rawRev.startsWith('$')
        ? rawRev
        : '$0.00';

  // Sequential conversion % only when denominator is the same cohort type AND downstream <= upstream
  function sequentialPct(numer, denom) {
    if (denom == null || denom <= 0) return { label: 'n/a (no upstream cohort)', raw: null };
    if (numer > denom) {
      return {
        label: `not sequential (${numer} vs ${denom} — different metrics)`,
        raw: null,
      };
    }
    return { label: ((numer / denom) * 100).toFixed(1) + '%', raw: numer / denom };
  }

  const visitorToSignup = sequentialPct(signups, qualifiedVisitors);
  const signupToProfile = sequentialPct(completedProfiles, signups);
  const profileToInteraction = sequentialPct(interactions, completedProfiles);

  const TRAFFIC_EVAL_MIN = 100;
  const trafficForGate = qualifiedVisitors ?? 0;
  const trafficSampleSufficient = trafficForGate >= TRAFFIC_EVAL_MIN;

  let primaryBottleneck = 'TRAFFIC / INSUFFICIENT SAMPLE';
  let decision = 'HOLD / KEEP / COLLECT DATA';
  let nextAction =
    'Grow qualified distribution (owned social + partner outreach). Do not redesign product UI.';
  let bottleneckNote = `Qualified visitors ${trafficForGate} / ${TRAFFIC_EVAL_MIN} minimum evaluation sample. Collect more traffic before diagnosing conversion.`;

  if (trafficSampleSufficient) {
    bottleneckNote = `Traffic sample threshold crossed (${trafficForGate} ≥ ${TRAFFIC_EVAL_MIN}). Evaluating the next funnel stage.`;
    const visitorToSignupRatio = visitorToSignup.raw ?? 0;
    const signupToProfileRatio = signupToProfile.raw ?? 0;
    const profileToInteractionRatio = profileToInteraction.raw ?? 0;

    if (visitorToSignup.raw != null && visitorToSignupRatio < 0.05) {
      primaryBottleneck = 'SIGNUP CONVERSION';
      decision = 'EVALUATE_SIGNUP_FLOW';
      nextAction = 'Analyze landing-to-signup dropoff by campaign and mode before modifying copy.';
    } else if (signups > 0 && signupToProfile.raw != null && signupToProfileRatio < 0.5) {
      primaryBottleneck = 'ACTIVATION';
      decision = 'EVALUATE_ONBOARDING';
      nextAction = 'Analyze profile completion dropoff in onboarding.';
    } else if (
      completedProfiles > 0 &&
      profileToInteraction.raw != null &&
      profileToInteractionRatio < 0.4
    ) {
      primaryBottleneck = 'ENGAGEMENT';
      decision = 'EVALUATE_DISCOVERY';
      nextAction = 'Analyze Discover engagement among completed profiles.';
    } else if ((interactions > 0 || completedProfiles > 0) && payingCustomers === 0) {
      primaryBottleneck = 'MONETIZATION';
      decision = 'EVALUATE_PAYMENT_CONVERSION';
      nextAction = 'Review pricing/checkout among interacting users.';
    } else {
      primaryBottleneck = 'SCALE';
      decision = 'SCALE_DISTRIBUTION';
      nextAction = 'Double down on top-performing acquisition campaigns and markets.';
    }
  }

  return {
    // Honest traffic breakdown (do not conflate events with visitors)
    totalSessions: totalSessions ?? 'Unavailable',
    uniqueUsers: uniqueUsers ?? 'Unavailable',
    landingEvents: landingEvents ?? 'Unavailable',
    campaignAttributedVisitors: campaignVisitors ?? 'Unavailable',
    qualifiedVisitors: qualifiedVisitors ?? 'Unavailable',
    qualifiedVisitorUnit,
    // Back-compat aliases used by older report sections
    qualifiedTraffic: qualifiedVisitors ?? 0,
    totalTraffic: totalSessions ?? qualifiedVisitors ?? 0,
    signups,
    completedProfiles,
    discoverUsers,
    requests,
    matches,
    firstMessages,
    interactions,
    payingCustomers,
    revenue: revenueStr,
    visitorToSignup: visitorToSignup.label,
    signupToProfile: signupToProfile.label,
    profileToInteraction: profileToInteraction.label,
    primaryBottleneck,
    decision,
    nextAction,
    trafficSampleSufficient,
    bottleneckNote,
    trafficEvalMin: TRAFFIC_EVAL_MIN,
  };
}

export function defaultDecision({ health, reconciliation, shipped, snapshot } = {}) {
  const healthOk = health?.ok !== false;
  const reconOk = reconciliation?.ok !== false;
  const social = ownedSocialSummary(snapshot);
  const shippedLine = shipped ? 'Shipped: code in this run.' : 'Shipped: none.';
  const metaAuth =
    social.metaAuth?.authentication ||
    (social.fbYes || social.metaAuth?.status === 'META_VALID' ? 'VALID' : null);
  const igFail = !social.igYes && social.ig.blocker;
  const igIsAuth =
    igFail && /META_TOKEN_|META_AUTH_|code 190/i.test(String(social.ig.blocker || ''));
  const igLine = social.igYes
    ? `Instagram publishing: PUBLISHED (${social.ig.postId || 'ok'}).`
    : igFail
      ? `Instagram publishing: FAILED (${social.ig.state || social.ig.blocker}).${
          metaAuth === 'VALID' && !igIsAuth ? ' Meta authentication remains VALID.' : ''
        }`
      : '';
  const board7 = snapshot?.scoreboard?.['7d'] || {};
  const traffic = board7.landings?.available ? Number(board7.landings.value ?? 0) : Number(board7.sessions?.value ?? 0);
  const decisionPhase = traffic < 100
    ? 'HOLD / KEEP / COLLECT DATA (traffic sample below 100–200 visit evaluation threshold; no product/funnel changes)'
    : 'EVALUATE FUNNEL';

  return (
    `DECISION: ${decisionPhase}. ${shippedLine} ` +
    `GetTrainMate is TRAIN + VIBE + DATE, multilingual and international. Atlanta TRAIN is one acquisition experiment, not the product. ` +
    `Owned social: ${social.executed}. ` +
    (metaAuth ? `Meta authentication: ${metaAuth}. ` : '') +
    (igLine ? `${igLine} ` : social.blocker && !igFail ? `Blocker: ${social.blocker}. ` : '') +
    'Partner email remains fail-closed. ' +
    'EXP-001 KEEP (Atlanta landing experiment). ' +
    `EXP-002 ${
      snapshot?.partnerOutreach?.status === 'ok'
        ? snapshot.partnerOutreach.ownerAction || 'No outreach action required.'
        : 'Partner CRM status in report body.'
    } ` +
    'EXP-003 referral is user-initiated, not a wait action. ' +
    'Existing verified customers: 0. New customers acquired by this run: 0. ' +
    `Production is ${healthOk ? 'healthy' : 'FAILED'}.` +
    (reconOk ? '' : ' Data quality warning is in effect.')
  );
}

function stripeStatusLines(snapshot) {
  const allow = loadStripeAllowlist();
  const catalogAllowlist =
    allow.productIds.size > 0 || allow.priceIds.size > 0 || allow.paymentLinkIds.size > 0;
  // Metadata gtm_source=gettrainmate is the primary conclusive ownership rule (always configured in repo).
  const metadataRulesConfigured = Boolean(allow.appSourceKey && allow.appSourceValue);
  const configured = metadataRulesConfigured || catalogAllowlist;
  const reconComplete = Boolean(allow.reconciliationComplete);
  const board30 = snapshot?.scoreboard?.['30d'] || {};
  const payments = formatCell(board30.live_payments);
  const customers = formatCell(board30.unique_paying_customers);
  const revenue = formatCell(board30.revenue);
  const unattrCell = board30.unattributed_live_payments;
  const unattrCount = unattrCell?.available ? Number(unattrCell.value ?? 0) : null;
  const sessions =
    snapshot?.windows?.['30d']?.stripeNormalized?.unattributed_sessions ||
    snapshot?.stripe30d?.unattributed_sessions ||
    snapshot?.windows?.['7d']?.stripeNormalized?.unattributed_sessions ||
    [];
  const unattrClass = summarizeUnattributedPayments(
    sessions,
    unattrCount != null && !Number.isNaN(unattrCount) ? unattrCount : 0,
  );
  const unattr =
    unattrClass.count > 0
      ? `${unattrClass.count} — ${unattrClass.label}`
      : formatCell(unattrCell);
  if (!reconComplete) {
    return {
      configured,
      catalogAllowlist,
      verifiedRevenue: '$0.00',
      verifiedCustomers: '0',
      lines: [
        'Verified attributed payments: 0',
        'Verified external customers: 0 (baseline until reconciliationComplete)',
        'Attributed revenue: $0.00',
        `Unattributed payment: ${unattr}`,
        `Attribution rules: metadata ${allow.appSourceKey}=${allow.appSourceValue}` +
          (catalogAllowlist ? '; Product/Price allowlist also present' : '; Product/Price allowlists empty (optional)'),
        'Attribution status: Metadata rules configured; verified customers held at baseline 0 until reconciliationComplete'
      ]
    };
  }
  return {
    configured: true,
    catalogAllowlist,
    verifiedRevenue: revenue,
    verifiedCustomers: customers,
    lines: [
      `Verified attributed payments: ${payments}`,
      `Verified external customers: ${customers}`,
      `Attributed revenue: ${revenue}`,
      `Unattributed payment: ${unattr}`,
      'Attribution status: reconciliationComplete — metadata and/or Product/Price allowlist'
    ]
  };
}

function exp002Stats(snapshot) {
  const s = snapshot?.partnerOutreach || {};
  const status = String(s.status || 'unavailable').toLowerCase();
  if (status !== 'ok') {
    return {
      status,
      reason: s.reason || 'Partner Outreach CRM could not be queried',
      unavailable: true,
      prospects: 'Unavailable',
      contacts: 'Unavailable',
      needContact: 'Unavailable',
      draftsPrepared: 'Unavailable',
      awaitingApproval: 'Unavailable',
      recipientsApproved: 'Unavailable',
      emailsSent: 'Unavailable',
      emailsSentToday: 'Unavailable',
      emailsSent7d: 'Unavailable',
      emailsSentLifetime: 'Unavailable',
      delivered: 'Unavailable',
      partnerResponses: 'Unavailable',
      interested: 'Unavailable',
      partners: 'Unavailable',
      partners7d: 'Unavailable',
      partnersLifetime: 'Unavailable',
      partnerPagesCreated: 'Unavailable',
      inviteCodesCreated: 'Unavailable',
      partnerVisits: 'Unavailable',
      partnerSignups: 'Unavailable',
      partnerSignups7d: 'Unavailable',
      partnerSignupsLifetime: 'Unavailable',
      completedProfiles: 'Unavailable',
      discoverUsers: 'Unavailable',
      connectionRequests: 'Unavailable',
      customersAcquired: 'Unavailable',
      revenueAttributedCents: 'Unavailable',
      outreachMode: 'Unavailable',
      pauseAllOutreach: false,
      automaticSending: false,
      dryRun: false,
      dailyLimit: 'Unavailable',
      remaining: 'Unavailable',
      sesRemaining: 'Unavailable',
      deliveredTracking: 'NOT TRACKED',
      ownerAction: `MAX — ACTION REQUIRED: Partner CRM ${status.toUpperCase()}: ${s.reason || 'fix credentials / API access'}`,
      ownerActions: [
        {
          id: 'crm',
          severity: 'required',
          text: `MAX — ACTION REQUIRED: Partner CRM ${status.toUpperCase()}: ${s.reason || 'fix credentials / API access'}`,
        },
      ],
      contactsAdminUrl: s.contactsAdminUrl || 'https://gettrainmate.com/admin/partner-outreach?tab=prospects',
      approvalsAdminUrl: s.approvalsAdminUrl || 'https://gettrainmate.com/admin/partner-outreach?tab=approvals',
      discoveryNew: 'Unavailable',
      highScore: 'See Admin CRM',
      contactsFound: 'Unavailable',
      draftsCreated: 'Unavailable',
    };
  }

  const num = (v) => (v == null || v === '' ? 'Unavailable' : String(v));
  const zeroOk = (v) => (v == null || v === '' ? 'Unavailable' : String(Number(v)));

  return {
    status: 'ok',
    unavailable: false,
    reason: null,
    prospects: zeroOk(s.prospects ?? s.funnel?.discovered),
    contacts: zeroOk(s.contacts ?? s.discovery?.verifiedPublicContacts),
    needContact: zeroOk(s.needContact ?? s.funnel?.contactNeeded),
    draftsPrepared: zeroOk(s.draftsPrepared ?? s.funnel?.drafts),
    awaitingApproval: zeroOk(s.awaitingApproval ?? s.funnel?.awaitingApproval),
    recipientsApproved: zeroOk(s.recipientsApproved ?? s.funnel?.approved),
    emailsSent: zeroOk(s.emailsSent ?? s.funnel?.sent),
    emailsSentToday: s.emailsSentToday != null ? zeroOk(s.emailsSentToday) : 'Unavailable',
    emailsSent7d: s.emailsSent7d != null ? zeroOk(s.emailsSent7d) : 'Unavailable',
    emailsSentLifetime: zeroOk(s.emailsSentLifetime ?? s.emailsSent ?? s.funnel?.sent),
    delivered: zeroOk(s.delivered),
    partnerResponses: zeroOk(s.partnerResponses ?? s.funnel?.replied),
    interested: zeroOk(s.interested ?? s.funnel?.interested),
    partners: zeroOk(s.partners ?? s.funnel?.partners),
    partners7d: s.partners7d != null ? zeroOk(s.partners7d) : 'Unavailable',
    partnersLifetime: zeroOk(s.partnersLifetime ?? s.partners ?? s.funnel?.partners),
    partnerPagesCreated: zeroOk(s.partnerPagesCreated),
    inviteCodesCreated: zeroOk(s.inviteCodesCreated),
    partnerVisits: num(s.partnerAttributedVisits),
    partnerSignups: num(s.partnerAttributedSignups ?? s.northStars?.referralSignups),
    partnerSignups7d:
      s.partnerAttributedSignups7d != null ? zeroOk(s.partnerAttributedSignups7d) : 'Unavailable',
    partnerSignupsLifetime: num(
      s.partnerAttributedSignupsLifetime ?? s.partnerAttributedSignups ?? s.northStars?.referralSignups,
    ),
    completedProfiles: num(s.completedProfiles ?? s.northStars?.activeUsersAcquired),
    discoverUsers: num(s.discoverUsers),
    connectionRequests: num(s.connectionRequests),
    customersAcquired: zeroOk(s.customersAcquired ?? s.northStars?.customersAcquired ?? 0),
    revenueAttributedCents: zeroOk(s.revenueAttributedCents ?? s.northStars?.revenueAttributedCents ?? 0),
    outreachMode: num(s.settings?.outreachMode),
    pauseAllOutreach: Boolean(s.settings?.pauseAllOutreach),
    automaticSending: Boolean(s.settings?.automaticSending),
    dryRun: Boolean(s.settings?.dryRun),
    dailyLimit: zeroOk(s.settings?.dailyLimit ?? 100),
    remaining: s.settings?.remaining != null ? zeroOk(s.settings.remaining) : 'Unavailable',
    sesRemaining: s.settings?.sesRemaining != null ? zeroOk(s.settings.sesRemaining) : 'Unavailable',
    deliveredTracking: s.settings?.deliveredTracking || 'NOT TRACKED',
    ownerAction: num(s.ownerAction),
    ownerActions: Array.isArray(s.ownerActions)
      ? s.ownerActions
      : buildOwnerActions({
          needContact: s.needContact ?? s.funnel?.contactNeeded,
          awaitingApproval: s.awaitingApproval ?? s.funnel?.awaitingApproval,
          approvedEligible: s.recipientsApproved ?? s.funnel?.approved,
          pauseAllOutreach: Boolean(s.settings?.pauseAllOutreach),
          automaticSending: Boolean(s.settings?.automaticSending),
          autoDiscoverContacts: s.settings?.autoDiscoverContacts !== false,
          sendQualifiedAutomatically: s.settings?.sendQualifiedAutomatically !== false,
          dryRun: Boolean(s.settings?.dryRun),
          complaintPause: Boolean(s.settings?.complaintPause),
        }),
    contactsAdminUrl: s.contactsAdminUrl || 'https://gettrainmate.com/admin/partner-outreach?tab=prospects',
    approvalsAdminUrl: s.approvalsAdminUrl || 'https://gettrainmate.com/admin/partner-outreach?tab=approvals',
    discoveryNew: zeroOk(s.funnel?.discovered),
    highScore: 'See Admin CRM',
    contactsFound: zeroOk(s.contacts ?? s.discovery?.verifiedPublicContacts),
    draftsCreated: zeroOk(s.draftsPrepared ?? s.discovery?.draftsGenerated),
  };
}

export function composeGrowthEmailBody({
  snapshot,
  health,
  experiments = [],
  notes,
  generatedAt,
  decision,
  shipped = false,
  acquisition,
  commitSha
}) {
  const et = formatEt(generatedAt || new Date());
  const generatedUtc = (generatedAt || new Date()).toISOString();
  const rawNotes = String(notes || '').trim();
  const noteText = ascii(rawNotes.startsWith('{') ? '' : rawNotes);
  const board7 = snapshot?.scoreboard?.['7d'] || {};
  const board30 = snapshot?.scoreboard?.['30d'] || {};
  const recon = snapshot?.reconciliation;
  const attr7 = snapshot?.experimentAttribution?.['7d'];
  const attr30 = snapshot?.experimentAttribution?.['30d'];
  const md = snapshot?.marketplaceDensity;
  const decisionText = ascii(decision || defaultDecision({ health, reconciliation: recon, shipped, snapshot }));
  const lead = resolveAcquisitionLead({ snapshot, notes, acquisition });
  const ga4Ok = snapshot?.sources?.ga4 === 'ok';
  const dataQualityNeeded = recon && recon.ok === false;
  const qualityLines = dataQualityNeeded ? (recon.warnings || []).map((w) => ascii(w)) : [];
  if (!ga4Ok) {
    qualityLines.push(
      `GA4 source status is "${snapshot?.sources?.ga4 ?? 'unknown'}" — event funnel metrics may show Unavailable unless CRM fallback applied.`
    );
  }
  if (!health?.checks?.length) {
    qualityLines.push('Production health checks did not run — overall health cannot be verified.');
  }
  const showDataQualityWarning = dataQualityNeeded || !ga4Ok || !health?.checks?.length;
  const healthOk = health?.ok !== false && (health?.checks?.length ?? 0) > 0;
  const stripe = stripeStatusLines(snapshot);
  const metroBlock = formatMetroUnavailable(md);
  const exp002 = exp002Stats(snapshot);
  const exp001 = experiments.find((e) => /EXP-001/i.test(e.idLine));
  const exp002row = experiments.find((e) => /EXP-002/i.test(e.idLine));
  const modes = modeTotalsFromMetro(md);
  const pockets = pocketsFromMetroCrm(md).slice(0, 8);
  const social = ownedSocialSummary(snapshot);
  const naMode = (v) => (v == null ? 'Unavailable' : String(v));
  const ga4Through = snapshot?.ga4DataThrough || shiftYmd(et.ymd, -1);
  const sha = String(commitSha || exp001?.commit || exp002row?.commit || '').trim();
  const distYes = Boolean(social.fbYes || social.igYes);
  const subject = growthEmailSubject({
    et,
    shipped,
    social,
    newCustomersThisRun: lead.newCustomersAcquiredByThisRun
  });

  const t = [];
  const sb = computeBusinessScoreboard(snapshot, md);
  const published = Boolean(social.fbYes || social.igYes);
  const creative = social.os?.socialImage || social.os?.creative || {};
  const runStatus = published
    ? 'SUCCESS'
    : social.attempted
      ? 'PARTIAL FAILURE'
      : 'FAILURE';
  const metaActionNeeded = ownerActionRequiredForMeta(social.metaAuth, { published: distYes });
  const partnerCrmOk = !exp002.unavailable && exp002.status === 'ok';

  t.push('GETTRAINMATE — CUSTOMER ACQUISITION');
  t.push('===================================');
  t.push('ARE WE GETTING CUSTOMERS?');
  t.push(`Local time (America/New_York): ${et.dateStr} ${et.timeStr}`);
  t.push(`GA4 data through: ${formatMonthDayYearFromYmd(ga4Through)}`);
  t.push(`Site: ${SITE.origin}`);
  t.push('');
  t.push('7 DAYS');
  t.push('------');
  t.push(`Qualified Visitors        ${sb.qualifiedVisitors} / 250`);
  t.push(`External Signups           ${sb.signups} / 10`);
  t.push(`Activated Profiles         ${sb.completedProfiles}`);
  t.push(`Meaningful Interactions    ${sb.interactions}`);
  t.push(`Paying Customers           ${sb.payingCustomers}`);
  t.push(`Revenue                    ${sb.revenue}`);
  t.push('');
  t.push(`PRIMARY BOTTLENECK: ${sb.primaryBottleneck}`);
  t.push(`DECISION: ${sb.decision}`);
  t.push(`NEXT ACTION: ${sb.nextAction}`);
  t.push(sb.bottleneckNote);
  t.push('');
  t.push('GETTRAINMATE PARTNER OUTREACH');
  t.push('-----------------------------');
  if (partnerCrmOk) {
    t.push(`Automatic: ${exp002.automaticSending ? 'ON' : 'OFF'}`);
    t.push(`Dry Run: ${exp002.dryRun ? 'ON' : 'OFF'}`);
    t.push(`Daily Limit: ${exp002.dailyLimit}`);
    t.push(`Sent Today: ${exp002.emailsSentToday}`);
    t.push(`Remaining: ${exp002.remaining}`);
    t.push(`SES Remaining: ${exp002.sesRemaining}`);
    t.push(`Delivered: ${exp002.deliveredTracking === 'NOT TRACKED' ? 'NOT TRACKED' : exp002.delivered}`);
    t.push('');
    t.push('DISCOVERY');
    t.push(`Prospects: ${exp002.prospects}`);
    t.push(`Usable contacts: ${exp002.contacts}`);
    t.push(`Need contact discovery (automation): ${exp002.needContact}`);
    t.push(`Drafts prepared: ${exp002.draftsPrepared}`);
    t.push(`Ready to send: ${exp002.recipientsApproved}`);
    t.push('');
    t.push('SENDING');
    t.push(`Sent today / 7d / lifetime: ${exp002.emailsSentToday} / ${exp002.emailsSent7d} / ${exp002.emailsSentLifetime}`);
    t.push('');
    t.push('ENGAGEMENT');
    t.push(`Replies: ${exp002.partnerResponses}`);
    t.push(`Partners 7d / lifetime: ${exp002.partners7d} / ${exp002.partnersLifetime}`);
    t.push(`Attributed signups 7d / lifetime: ${exp002.partnerSignups7d} / ${exp002.partnerSignupsLifetime}`);
    t.push(`Customers: ${exp002.customersAcquired}`);
    t.push(`Revenue: ${exp002.revenueAttributedCents}`);
  } else {
    t.push(`Partner CRM: ${String(exp002.status || 'unavailable').toUpperCase()} — ${exp002.reason || 'could not query'}`);
  }
  t.push('');
  t.push('SOCIAL DISTRIBUTION');
  t.push('-------------------');
  t.push(
    `Facebook publishing: ${social.fbYes ? 'PUBLISHED' : social.attempted ? 'FAILED/SKIPPED' : 'NOT ATTEMPTED'} (technical success)${social.fb.postId ? ` (${social.fb.postId})` : ''}`,
  );
  t.push(
    `Instagram publishing: ${social.igYes ? 'PUBLISHED' : social.ig.blocker ? 'FAILED' : 'NOT ATTEMPTED'} (technical success)${social.ig.postId ? ` (${social.ig.postId})` : ''}`,
  );
  t.push(`Attributed visits: ${ascii(lead.attributedVisits)} (acquisition — publishing is not customer acquisition)`);
  t.push('');
  const requiredActions = [];
  if (partnerCrmOk) {
    for (const a of exp002.ownerActions || []) {
      if (a.id === 'none') continue;
      const line = a.href ? `${a.text} → ${a.href}` : a.text;
      requiredActions.push(line);
    }
  } else {
    requiredActions.push(`MAX — ACTION REQUIRED: Fix Partner CRM access: ${exp002.reason || 'credentials / API'}`);
  }
  if (metaActionNeeded) {
    requiredActions.push('MAX — ACTION REQUIRED: Meta authentication failure — Facebook/Instagram did not publish.');
  }
  if (ownerActionRequiresMax(exp002.ownerActions) || metaActionNeeded || !partnerCrmOk) {
    t.push('MAX — ACTION REQUIRED');
    t.push('---------------------');
    for (const a of requiredActions) t.push(`• ${a}`);
  } else {
    t.push('NEXT ACTION');
    t.push('-----------');
    t.push(exp002.automaticSending ? AUTOMATION_HEALTHY : 'No outreach action required.');
  }
  t.push('');
  t.push('7-DAY ACQUISITION FUNNEL (detail)');
  t.push('--------------------------------');
  t.push(`External unique visitors:     ${sb.uniqueUsers}  (unit: unique users)`);
  t.push(`External sessions:            ${sb.totalSessions}  (unit: sessions)`);
  t.push(`Landing page view events:     ${sb.landingEvents}  (events — not visitors)`);
  t.push(`Campaign-attributed visitors: ${sb.campaignAttributedVisitors}`);
  t.push(`Signups:                      ${sb.signups} / 10 target`);
  t.push(`Activated profiles:           ${sb.completedProfiles}`);
  t.push(`Meaningful interactions:      ${sb.interactions}  (Discover starters)`);
  t.push(`  Connections/matches:        ${sb.matches} matches · ${sb.requests} requests`);
  t.push(`Paying customers:             ${sb.payingCustomers} / 1–3 target`);
  t.push(`Revenue:                      ${sb.revenue}`);
  t.push(`Funnel cohort used for conversion: ${sb.qualifiedVisitorUnit}`);
  t.push(`Visitor → signup:             ${sb.visitorToSignup}`);
  t.push(`Signup → profile:             ${sb.signupToProfile}`);
  t.push(`Profile → interaction:        ${sb.profileToInteraction}`);
  t.push('');

  t.push('RUN STATUS');
  t.push('----------');
  t.push(`Status: ${runStatus}`);
  t.push(`Mode: ${ascii(creative.mode || social.os?.contentId || 'n/a')}`);
  t.push(`Creative headline: ${ascii(creative.imageHeadline || 'n/a')}`);
  t.push('');

  t.push('PRODUCT SCOREBOARD (TRAIN / VIBE / DATE — not Atlanta-only)');
  t.push('-----------------------------------------------------------');
  t.push(`New users 7d (GA4): ${formatCell(board7.new_users ?? board7.active_users)}`);
  t.push(`Sessions 7d (GA4): ${formatCell(board7.sessions)}`);
  t.push(`Landing page view events 7d: ${formatCellLabeled(board7.landings)}`);
  t.push(`Signup starts 7d: ${formatCellLabeled(board7.signup_starts)}`);
  t.push(`Completed signups 7d: ${formatCellLabeled(board7.completed_signups)}`);
  t.push(`Completed profiles 7d: ${formatCellLabeled(board7.completed_profiles)}`);
  t.push(`CRM profiles (all modes): TRAIN ${naMode(modes.TRAIN)} / VIBE ${naMode(modes.VIBE)} / DATE ${naMode(modes.DATE)}`);
  t.push(`Discover users 7d / 30d: ${formatCellLabeled(board7.discover_users)} / ${formatCellLabeled(board30.discover_users)}`);
  t.push(`Requests 7d / 30d: ${formatCellLabeled(board7.connections_sent)} / ${formatCellLabeled(board30.connections_sent)}`);
  t.push(`Matches 7d / 30d: ${formatCellLabeled(board7.matches_created)} / ${formatCellLabeled(board30.matches_created)}`);
  t.push(`First messages 7d / 30d: ${formatCellLabeled(board7.first_messages)} / ${formatCellLabeled(board30.first_messages)}`);
  t.push(`Paying customers 7d: ${formatCell(board7.unique_paying_customers)}`);
  t.push(`Revenue 7d: ${formatCell(board7.revenue)}`);
  t.push('');
  t.push('BY MODE (CRM completed profiles — users may select multiple modes)');
  t.push('--------------------------------------------------------------');
  t.push(`TRAIN completed profiles: ${naMode(modes.TRAIN)}`);
  t.push(`VIBE completed profiles: ${naMode(modes.VIBE)}`);
  t.push(`DATE completed profiles: ${naMode(modes.DATE)}`);
  t.push('');
  t.push('TOP MARKET × MODE POCKETS');
  t.push('-------------------------');
  t.push('country / metro / language / mode / completed_profiles / matches');
  if (!pockets.length) {
    t.push(md?.status === 'ok' ? 'No metro pockets above cohort threshold.' : 'Unavailable (Metro CRM)');
  } else {
    for (const p of pockets) {
      t.push(
        `  ${p.country || 'unknown'} / ${p.metro || 'unknown'} / ${p.language || 'unknown'} / ${p.mode || 'all'} / completed=${p.completedProfiles ?? 0} / matches=${p.matches ?? 0}`
      );
    }
  }
  t.push('');
  t.push('ACQUISITION CAMPAIGNS (7d GA4 sessionCampaignName)');
  t.push('--------------------------------------------------');
  const campaigns7 = snapshot?.campaignAttribution?.['7d'] || [];
  const ownedToday = campaigns7.filter((c) => /^owned-/i.test(c.campaign));
  if (!ownedToday.length) {
    t.push('No owned-social campaign sessions in 7d window yet (posts may need 24–48h GA4 lag).');
  } else {
    for (const c of ownedToday.slice(0, 6)) {
      const outcome =
        c.sessions === 0
          ? 'PUBLISHED_NO_TRAFFIC'
          : c.newUsers === 0
            ? 'TRAFFIC_NO_ACTIVATION'
            : 'MEASURING';
      t.push(`  ${c.campaign}: sessions=${c.sessions} users=${c.users} newUsers=${c.newUsers} → ${outcome}`);
    }
  }
  t.push('');
  t.push('1) GETTRAINMATE — TODAY (summary)');
  t.push('---------------------------------');
  t.push(`Visitors / landings 7d (GA4 events): ${formatCell(board7.landings)}`);
  t.push(`New signups 7d (GA4 users): ${formatCell(board7.completed_signups)}`);
  t.push(`Completed profiles 7d (GA4 users): ${formatCell(board7.completed_profiles)}`);
  t.push(`Completed profiles 30d (GA4 users): ${formatCell(board30.completed_profiles)}`);
  t.push(`Completed profiles — CRM verified: ${md?.status === 'ok' ? 'see BY MODE above' : 'unavailable'}`);
  t.push(`Discover users 7d / 30d (GA4): ${formatCell(board7.discover_users)} / ${formatCell(board30.discover_users)}`);
  t.push(`Requests 7d / 30d (GA4 events): ${formatCell(board7.connections_sent)} / ${formatCell(board30.connections_sent)}`);
  t.push(`Matches 7d / 30d (GA4 events): ${formatCell(board7.matches_created)} / ${formatCell(board30.matches_created)}`);
  t.push(`First messages 7d / 30d (GA4): ${formatCell(board7.first_messages)} / ${formatCell(board30.first_messages)}`);
  t.push(`Returning users 7d / 30d (GA4): ${formatCell(board7.returning_users)} / ${formatCell(board30.returning_users)}`);
  t.push(`New paying customers (this run): ${ascii(lead.newCustomersAcquiredByThisRun)}`);
  t.push(`Verified revenue: ${stripe.verifiedRevenue}`);
  t.push('');
  t.push('2) GROWTH BY MODE');
  t.push('-----------------');
  t.push(`TRAIN completed profiles (CRM): ${naMode(modes.TRAIN)}`);
  t.push(`VIBE completed profiles (CRM): ${naMode(modes.VIBE)}`);
  t.push(`DATE completed profiles (CRM): ${naMode(modes.DATE)}`);
  t.push('GA4 does not yet split Discover/matches by mode; CRM mode counts are completed profiles that include that mode.');
  t.push('');
  t.push('3) TOP MARKETS');
  t.push('--------------');
  t.push('country / metro / language / mode / completed_profiles / matches');
  if (!pockets.length) {
    t.push(md?.status === 'ok' ? 'No metro pockets above cohort threshold.' : 'Unavailable (Metro CRM)');
  } else {
    for (const p of pockets) {
      t.push(
        `  ${p.country || 'unknown'} / ${p.metro || 'unknown'} / ${p.language || 'unknown'} / ${p.mode || 'all'} / completed=${p.completedProfiles ?? 0} / matches=${p.matches ?? 0}`
      );
    }
  }
  if (metroBlock) {
    t.push('');
    t.push(metroBlock);
  }
  t.push('');
  t.push('4) ACQUISITION');
  t.push('-------------');
  t.push(`External sessions 7d: ${sb.totalSessions}`);
  t.push(`External unique users 7d: ${sb.uniqueUsers}`);
  t.push(`Landing page view events 7d: ${sb.landingEvents} (events — not visitors)`);
  t.push(`Campaign-attributed visitors 7d: ${sb.campaignAttributedVisitors}`);
  t.push(`Funnel cohort (${sb.qualifiedVisitorUnit}): ${sb.qualifiedVisitors}`);
  t.push(`New external signups 7d: ${sb.signups} / 10 target`);
  t.push(`Activated users 7d (completed profiles): ${sb.completedProfiles}`);
  t.push(`Verified external paying customers 7d: ${sb.payingCustomers} / 1–3 target`);
  t.push(`Verified attributed revenue: ${sb.revenue}`);
  t.push(`Distribution attempted: ${ascii(lead.distributionAttempted)}`);
  t.push(`Distribution executed: ${ascii(lead.distributionExecuted)}`);
  t.push(`Technical distribution result: ${ascii(lead.technicalDistributionResult)}`);
  t.push(`What was actually distributed: ${ascii(lead.distributionExecutedDetail)}`);
  t.push(`Audience/channel: ${ascii(lead.audienceChannel)}`);
  t.push(`Mode / language: ${ascii(social.os.mode || 'n/a')} / ${ascii(social.os.language || 'n/a')}`);
  t.push(`Campaign: ${ascii(social.fb.campaign || social.ig.campaign || 'n/a')}`);
  t.push(`Attributed visits: ${ascii(lead.attributedVisits)}`);
  t.push(`Activations: ${ascii(lead.activations)}`);
  t.push(`Checkout starts: ${ascii(lead.checkoutStarts)}`);
  t.push(`Newly attributed external customers: ${ascii(lead.newlyAttributedExternalCustomers)}`);
  t.push(`Verified revenue (this run): ${ascii(lead.verifiedRevenue)}`);
  t.push(
    `Funnel progression: distributed → visitors (${sb.qualifiedVisitors}) → signup (${sb.signups}) → profile (${sb.completedProfiles}) → discover (${sb.discoverUsers}) → request (${sb.requests}) → match (${sb.matches}) → message (${sb.firstMessages}) → payment (${sb.payingCustomers})`
  );
  t.push('Draft prepared / failed API call does not count as distribution.');
  t.push('');
  t.push('5) OWNED SOCIAL + META AUTHENTICATION');
  t.push('------------------------------------');
  t.push(`Facebook page: ${PREPARED_OWNED_SOCIAL.facebookUrl}`);
  t.push(`Instagram: ${PREPARED_OWNED_SOCIAL.instagramUrl}`);
  t.push(`Facebook: Published: ${social.fbYes ? 'YES' : 'NO'}`);
  t.push(`  Post ID: ${ascii(social.fb.postId || 'n/a')}`);
  t.push(`  Campaign: ${ascii(social.fb.campaign || 'n/a')}`);
  t.push(`Instagram: Published: ${social.igYes ? 'YES' : 'NO'}`);
  t.push(`  Media/Post ID: ${ascii(social.ig.postId || 'n/a')}`);
  t.push(`  Campaign: ${ascii(social.ig.campaign || 'n/a')}`);
  {
    const ma = social.metaAuth || {};
    t.push(`Meta configuration: ${ascii(ma.configuration || 'UNKNOWN')}`);
    t.push(`Meta authentication: ${ascii(ma.authentication || (social.fbYes ? 'VALID' : 'INVALID'))}`);
    t.push(`Meta status: ${ascii(ma.status || (social.fbYes ? 'META_VALID' : 'UNKNOWN'))}`);
    t.push(`Facebook publishing: ${social.fbYes ? 'PUBLISHED' : ascii(ma.facebookPublishing || 'BLOCKED')}`);
    t.push(
      `Instagram publishing: ${social.igYes ? 'PUBLISHED' : social.ig.blocker ? 'FAILED' : ascii(ma.instagramPublishing || 'BLOCKED')}`
    );
    if (!social.igYes && (social.ig.state || social.ig.blocker)) {
      t.push(`Instagram error: ${ascii(social.ig.state || social.ig.blocker)}`);
    }
    t.push(`Page: ${ascii(ma.pageName || 'Get Train Mate App')} (${ascii(ma.pageId || '1138684902641972')})`);
    t.push(`Instagram: @${ascii(ma.instagramUsername || 'gettrainmate')} (${ascii(ma.instagramId || '17841434503711452')})`);
    t.push(`Token expiry: ${ascii(ma.tokenExpires || 'unknown')}`);
    t.push(`Last validated: ${ascii(ma.validatedAt || 'n/a')}`);
    t.push(
      `Owner action required: ${
        ownerActionRequiredForMeta(ma, { published: social.fbYes || social.igYes }) ? 'YES' : 'NO'
      }`
    );
  }
  t.push('');
  t.push('6) DECISION');
  t.push('-----------');
  t.push(decisionText);
  t.push('');
  t.push(`What shipped: ${shipped ? 'code this run' : 'none'}`);
  t.push(`Verified revenue: ${ascii(lead.verifiedRevenue)}`);
  t.push(`Required owner approval: ${ascii(lead.requiredOwnerApproval)}`);
  t.push('');
  t.push('Customer attribution (do not collapse):');
  t.push(`  Existing customers: ${ascii(lead.existingCustomers)}`);
  t.push(`  Customers observed during experiment window: ${ascii(lead.customersObservedInWindow)}`);
  t.push(`  Customers causally attributed to a specific experiment: ${ascii(lead.customersCausallyAttributedToExperiment)}`);
  t.push(`  New customers acquired by the current run: ${ascii(lead.newCustomersAcquiredByThisRun)}`);
  t.push('');
  if (showDataQualityWarning) {
    t.push('7) DATA QUALITY WARNING');
    t.push('-----------------------');
    if (!ga4Ok) {
      t.push(`GA4 measurement status: ${snapshot?.sources?.ga4 ?? 'unknown'} (0 is reported as 0; Unavailable means query/instrumentation gap).`);
    }
    if (!health?.checks?.length) {
      t.push('Production health checks did not run in this report build.');
    }
    for (const w of qualityLines) t.push(`- ${w}`);
    t.push('');
  } else {
    t.push('7) DATA QUALITY WARNING');
    t.push('-----------------------');
    t.push('None. GA4, CRM, and Stripe sources responded; zeros are reported as 0.');
    t.push('');
  }
  t.push('8) EXPERIMENTS (not the global KPI)');
  t.push('------------------------------------');
  t.push('Atlanta TRAIN landings (EXP-001/002/003) are experiments. Do not treat the Atlanta landing experiment as the product scoreboard.');
  t.push(`EXP-001 — Atlanta training-partners landing page`);
  t.push(`  Original evaluation date: ${EXP001.evaluationWeekday} (${EXP001.evaluationDate})`);
  t.push(`  Actual evaluation date: ${EXP001.actualEvaluationWeekday} (${EXP001.actualEvaluationDate})`);
  t.push(`  Decision: ${EXP001.decision} (treatment unchanged)`);
  if (exp001) {
    t.push(`  Status: ${exp001.status} | Stage: ${exp001.funnelStage || 'n/a'}`);
    if (exp001.commit) t.push(`  Commit: ${SITE.repo}/commit/${exp001.commit}`);
  }
  const a = attr30 || attr7;
  if (a) {
    t.push(`  Path: ${a.path || EXP001.path}`);
    t.push(`  30d landing sessions: ${a.landings?.value ?? 'Unavailable'}`);
    t.push(`  30d signup starts: ${a.signup_starts?.value ?? 'Unavailable'}`);
    t.push(`  30d completed signups: ${a.completed_signups?.value ?? 'Unavailable'}`);
    t.push(
      `  Attributed paid conversions: ${
        a.attributed_paid_conversions?.available
          ? a.attributed_paid_conversions.value
          : a.attributed_paid_conversions?.label || 'Unknown'
      }`
    );
  }
  t.push('');
  t.push(`EXP-002 — Partner Outreach / Customer Acquisition CRM`);
  t.push(`  Evaluation: ${EXP002.evaluationWeekday} (${EXP002.evaluationDate})`);
  if (exp002row) {
    t.push(`  Status: ${exp002row.status} | Stage: ${exp002row.funnelStage || 'n/a'}`);
    if (exp002row.commit) t.push(`  Commit: ${SITE.repo}/commit/${exp002row.commit}`);
  }
  t.push(`  CRM source: ${exp002.status}${exp002.unavailable ? ` — ${exp002.reason}` : ''}`);
  if (exp002.unavailable) {
    t.push('  Prospects / Contacts / Drafts / Sent: Unavailable (CRM could not be queried — not zero)');
    t.push(`  OWNER ACTION: ${exp002.ownerAction}`);
  } else {
    t.push(`  Pause all: ${exp002.pauseAllOutreach ? 'YES' : 'no'}`);
    t.push('  --- Partner funnel (live CRM; 0 means queried empty) ---');
    t.push(
      `  DISCOVERY: prospects=${exp002.prospects} emails_found=${exp002.contacts} need_contact=${exp002.needContact} drafts=${exp002.draftsPrepared}`
    );
    t.push(
      `  OUTREACH: awaiting_approval=${exp002.awaitingApproval} approved=${exp002.recipientsApproved} sent=${exp002.emailsSent} delivered=${exp002.delivered}`
    );
    t.push(
      `  ENGAGEMENT: replies=${exp002.partnerResponses} interested=${exp002.interested} partners=${exp002.partners}`
    );
    t.push(
      `  CUSTOMERS: attributed_signups=${exp002.partnerSignups} customers=${exp002.customersAcquired} revenue_cents=${exp002.revenueAttributedCents}`
    );
    t.push(`  Automatic / Dry Run: ${exp002.automaticSending ? 'ON' : 'OFF'} / ${exp002.dryRun ? 'ON' : 'OFF'}`);
    t.push(`  Daily limit / remaining / SES remaining: ${exp002.dailyLimit} / ${exp002.remaining} / ${exp002.sesRemaining}`);
    t.push(`  OWNER ACTION: ${exp002.ownerAction}`);
    if (ownerActionRequiresMax(exp002.ownerActions)) {
      t.push(`  Settings: ${exp002.approvalsAdminUrl.replace('tab=approvals', 'tab=settings')}`);
    }
    t.push(`  Partner-attributed visits: ${exp002.partnerVisits}`);
    t.push(`  Completed profiles (attributed): ${exp002.completedProfiles}`);
  }
  t.push('');
  t.push(`EXP-003 — Atlanta TRAIN user-initiated referral invite`);
  t.push(`  Evaluation: ${EXP003.evaluationWeekday} (${EXP003.evaluationDate})`);
  t.push('  Status: active | Stage: acquisition / referral');
  t.push('  Locked surface: /invite and TRAIN profile/Discover invite CTA. Does not modify EXP-002.');
  t.push('  Primary metric: referral landing sessions (events) + signup_started with src=referral');
  t.push('');
  t.push('Stripe (GetTrainMate-attributed only; unattributed excluded from revenue):');
  for (const line of stripe.lines) t.push(`  ${line}`);
  t.push('');
  t.push('9) NEXT ACTIONS');
  t.push('---------------');
  t.push(`Primary Acquisition Action: ${sb.nextAction}`);
  t.push('Owner action required / opportunities:');
  t.push(`  - Customer Acquisition: ${exp002.ownerAction}`);
  if (md?.status !== 'ok') {
    t.push('  - Configure the metro read token (GROWTH_METRO_READ_TOKEN) so country/metro/mode ranking is available.');
  }
  if (metaActionNeeded) {
    t.push(
      '  - MAX — ACTION REQUIRED: Facebook/Instagram did not publish: store Meta Page token + Page id + IG business id in SSM /gettrainmate/growth/* and retry publish-owned-social.mjs.'
    );
  }
  t.push('  - Concentrate owned-social rotation on the highest-ranked metro/mode pocket — not Atlanta-only by default.');
  if (!stripe.configured) {
    t.push('  - Configure Stripe Product/Price allowlists if still incomplete.');
  }
  t.push('');
  t.push('10) PRODUCTION HEALTH');
  t.push('--------------------');
  t.push(
    `Overall: ${healthOk ? 'OK' : health?.checks?.length ? 'FAILED' : 'UNKNOWN (checks not run)'}`
  );
  if (!health?.checks?.length) {
    t.push('- (no health checks executed — do not treat Overall OK as verified)');
  }
  for (const c of health?.checks || []) {
    t.push(`- ${c.name}: ${c.ok ? 'ok' : 'FAIL'}`);
  }
  t.push('');
  t.push('11) DATA SOURCES');
  t.push('---------------');
  t.push(`GA4: ${snapshot?.sources?.ga4 ?? 'unknown'}`);
  t.push(`Stripe: ${snapshot?.sources?.stripe ?? 'unknown'}`);
  t.push(`Admin CRM / metro: ${md?.status ?? snapshot?.sources?.adminCrm ?? 'unavailable'}`);
  t.push('');
  t.push('12) TECHNICAL DETAILS');
  t.push('---------------------');
  t.push(`UTC timestamp: ${generatedUtc}`);
  t.push(`GA4 data-through date: ${ga4Through}`);
  t.push('Measurement ID: G-C29M8NWNY4');
  t.push(`Snapshot ID: ${snapshot?.snapshotId || snapshot?.wrote || 'n/a'}`);
  t.push(`Commit: ${sha || 'n/a'}`);
  t.push(`Amplify deployment: ${ascii(exp001?.amplify || exp002row?.amplify || 'n/a')}`);
  t.push(
    `Missing configuration: metro token ${md?.status === 'ok' ? 'ok' : 'missing_or_api_unavailable'}; Stripe attribution ${stripe.configured ? 'metadata rules configured' : 'not configured'}; Meta configuration ${social.metaAuth?.configuration || 'unknown'}; Meta authentication ${social.metaAuth?.authentication || (social.fbYes || social.igYes ? 'VALID' : 'INVALID')} (${social.metaAuth?.status || social.blocker || 'n/a'})`
  );
  t.push(`Controlled error codes: ${md?.errorCode || (md?.status === 'ok' ? 'none' : 'metro_token_unconfigured')}`);
  t.push(
    `Stripe allowlist status: ${stripe.configured ? 'configured' : 'Incomplete — product allowlist not configured'}`
  );
  if (noteText) t.push(`Agent notes (sanitized): ${noteText}`);

  const text = t.join('\n');

  const paidLabel = attr30?.attributed_paid_conversions?.available
    ? String(attr30.attributed_paid_conversions.value)
    : attr30?.attributed_paid_conversions?.label || 'Unknown';
  const keepBadge = badge('KEEP');
  const healthRows = (health?.checks || [])
    .map((c) => {
      const b = badge(c.ok ? 'OK' : 'Failed');
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(c.name)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;"><span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${b.bg};color:${b.color};font-weight:700;font-size:13px;">${escapeHtml(b.label)}</span></td>
      </tr>`;
    })
    .join('');
  const pocketHtml = pockets.length
    ? kvTable(
        pockets.map((p) => ({
          label: `${p.country || '?'} / ${p.metro || '?'} / ${p.language || 'n/a'} / ${p.mode || 'all'}`,
          value: `completed=${p.completedProfiles ?? 0} · matches=${p.matches ?? 0}`,
          left: true
        }))
      )
    : `<p style="margin:0 0 18px;font-size:15px;color:#334155;">${md?.status === 'ok' ? 'No metro pockets above cohort threshold.' : 'Unavailable (Metro CRM)'}</p>`;
  const qualityHtml = showDataQualityWarning
    ? `<h2 style="${H2}">Data Quality Warning</h2>
       <ul style="margin:0 0 18px;padding:12px 12px 12px 32px;background:#fff7ed;border:1px solid #fdba74;border-radius:8px;font-size:15px;line-height:1.55;color:#9a3412;">
         ${qualityLines.map((w) => `<li style="margin:0 0 8px;">${escapeHtml(w)}</li>`).join('')}
       </ul>`
    : `<h2 style="${H2}">Data Quality Warning</h2>
       <p style="margin:0 0 18px;font-size:15px;color:#334155;">None. GA4, CRM, and Stripe sources responded; zeros are reported as 0.</p>`;
  const commitUrl = sha ? `${SITE.repo}/commit/${sha}` : '';
  const linkStyle = 'color:#93c5fd;text-decoration:none;font-size:14px;white-space:nowrap;';
  const nav = [
    ['Homepage', SITE.origin],
    ['Admin', SITE.admin],
    ['Pricing', `${SITE.origin}/pricing`],
    ['TRAIN', `${SITE.origin}/workout-partner`],
    ['VIBE', `${SITE.origin}/meet-people`],
    ['DATE', `${SITE.origin}/active-dating`]
  ];
  if (commitUrl) nav.push([`Commit ${sha}`, commitUrl]);
  const links = nav
    .map(([label, href], i) => {
      const sep = i ? '<span style="display:inline-block;padding:0 8px;color:#64748b;">·</span>' : '';
      return `${sep}<a href="${escapeHtml(href)}" style="${linkStyle}">${escapeHtml(label)}</a>`;
    })
    .join('');
  const decisionBg = distYes ? '#ecfdf5' : '#fff7ed';
  const decisionBd = distYes ? '#6ee7b7' : '#fdba74';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#e2e8f0;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;font-size:16px;line-height:1.5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e2e8f0;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="840" cellpadding="0" cellspacing="0" style="width:840px;max-width:840px;background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;">
        <tr><td style="padding:22px 28px;background:#0f172a;color:#fff;border-radius:12px 12px 0 0;">
          <div style="font-size:22px;font-weight:700;line-height:1.3;">GetTrainMate — Customer Acquisition Report</div>
          <div style="font-size:14px;opacity:0.9;margin-top:6px;">${escapeHtml(et.dateStr)} ${escapeHtml(et.timeStr)}</div>
          <div style="font-size:14px;opacity:0.9;margin-top:4px;">Report generated: ${escapeHtml(et.monthDayYear)} · GA4 data through: ${escapeHtml(formatMonthDayYearFromYmd(ga4Through))}</div>
          <div style="margin-top:14px;line-height:1.8;">${links}</div>
        </td></tr>
        <tr><td style="padding:24px 28px 32px;">
      <h2 style="${H2_FIRST}">GetTrainMate — Customer Acquisition</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:2px solid #0284c7;border-radius:10px;background:#f0f9ff;overflow:hidden;border-collapse:separate;">
        <tr><td style="padding:12px 16px;background:#0284c7;color:#ffffff;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:15px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#ffffff;">7 DAYS</td>
              <td align="right"><span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#e0f2fe;color:#0369a1;font-weight:700;font-size:11px;">${escapeHtml(sb.decision)}</span></td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:14px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;">
            <tr>
              <td style="padding:6px 0;width:55%;"><b>Qualified Visitors</b></td>
              <td style="padding:6px 0;text-align:right;"><b>${escapeHtml(String(sb.qualifiedVisitors))}</b> / 250</td>
            </tr>
            <tr>
              <td style="padding:6px 0;border-top:1px solid #e0f2fe;"><b>External Signups</b></td>
              <td style="padding:6px 0;text-align:right;border-top:1px solid #e0f2fe;"><b>${escapeHtml(String(sb.signups))}</b> / 10</td>
            </tr>
            <tr>
              <td style="padding:6px 0;border-top:1px solid #e0f2fe;"><b>Activated Profiles</b></td>
              <td style="padding:6px 0;text-align:right;border-top:1px solid #e0f2fe;">${escapeHtml(String(sb.completedProfiles))}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;border-top:1px solid #e0f2fe;"><b>Meaningful Interactions</b></td>
              <td style="padding:6px 0;text-align:right;border-top:1px solid #e0f2fe;">${escapeHtml(String(sb.interactions))}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;border-top:1px solid #e0f2fe;"><b>Paying Customers</b></td>
              <td style="padding:6px 0;text-align:right;border-top:1px solid #e0f2fe;">${escapeHtml(String(sb.payingCustomers))}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;border-top:1px solid #e0f2fe;"><b>Revenue</b></td>
              <td style="padding:6px 0;text-align:right;border-top:1px solid #e0f2fe;">${escapeHtml(sb.revenue)}</td>
            </tr>
          </table>
          <div style="margin-top:12px;padding:12px;background:#ffffff;border:1px solid #bae6fd;border-radius:6px;font-size:14px;line-height:1.5;">
            <div><b>PRIMARY BOTTLENECK:</b> <span style="color:#b91c1c;font-weight:700;">${escapeHtml(sb.primaryBottleneck)}</span></div>
            <div style="margin-top:4px;color:#64748b;">${escapeHtml(sb.bottleneckNote)}</div>
            <div style="margin-top:4px;"><b>DECISION:</b> <span style="color:#0369a1;font-weight:700;">${escapeHtml(sb.decision)}</span></div>
            <div style="margin-top:4px;"><b>NEXT ACTION:</b> ${escapeHtml(sb.nextAction)}</div>
          </div>
        </td></tr>
      </table>
      <h2 style="${H2}">GetTrainMate Partner Outreach</h2>
      ${
        partnerCrmOk
          ? kvTable(
              [
                { label: 'Automatic', value: exp002.automaticSending ? 'ON' : 'OFF' },
                { label: 'Dry Run', value: exp002.dryRun ? 'ON' : 'OFF' },
                { label: 'Daily Limit', value: String(exp002.dailyLimit) },
                { label: 'Sent Today', value: String(exp002.emailsSentToday) },
                { label: 'Remaining', value: String(exp002.remaining) },
                { label: 'SES Remaining', value: String(exp002.sesRemaining) },
                { label: 'Delivered', value: exp002.deliveredTracking === 'NOT TRACKED' ? 'NOT TRACKED' : String(exp002.delivered) },
                { label: 'Prospects', value: String(exp002.prospects) },
                { label: 'Usable Contacts', value: String(exp002.contacts) },
                { label: 'Need contact discovery (automation)', value: String(exp002.needContact) },
                { label: 'Ready to Send', value: String(exp002.recipientsApproved) },
                {
                  label: 'Sent today / 7d / lifetime',
                  value: `${exp002.emailsSentToday} / ${exp002.emailsSent7d} / ${exp002.emailsSentLifetime}`,
                },
                { label: 'Replies', value: String(exp002.partnerResponses) },
                {
                  label: 'Partners 7d / lifetime',
                  value: `${exp002.partners7d} / ${exp002.partnersLifetime}`,
                },
                {
                  label: 'Attributed signups 7d / lifetime',
                  value: `${exp002.partnerSignups7d} / ${exp002.partnerSignupsLifetime}`,
                },
                { label: 'Attributed customers', value: String(exp002.customersAcquired) },
              ],
              { peach: true },
            )
          : `<p style="margin:0 0 18px;font-size:15px;color:#9a3412;">Partner CRM ${escapeHtml(String(exp002.status || 'unavailable').toUpperCase())} — ${escapeHtml(exp002.reason || 'could not query')}</p>`
      }
      <h2 style="${H2}">${ownerActionRequiresMax(exp002.ownerActions) || metaActionNeeded || !partnerCrmOk ? 'Max — Action Required' : 'Next action'}</h2>
      <div style="margin:0 0 18px;padding:12px 14px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;font-size:15px;line-height:1.55;">
        ${
          ownerActionRequiresMax(exp002.ownerActions) || metaActionNeeded || !partnerCrmOk
            ? `<ul style="margin:0;padding-left:18px;">${[
                ...(partnerCrmOk
                  ? (exp002.ownerActions || [])
                      .filter((a) => a.id !== 'none')
                      .map((a) => {
                        const link =
                          a.href && a.cta
                            ? ` <a href="${escapeHtml(a.href)}" style="color:#0369a1;font-weight:700;">${escapeHtml(a.cta)}</a>`
                            : '';
                        return `<li style="margin:0 0 6px;">${escapeHtml(a.text)}${link}</li>`;
                      })
                  : [
                      `<li style="margin:0 0 6px;">MAX — ACTION REQUIRED: Fix Partner CRM access: ${escapeHtml(exp002.reason || 'credentials / API')}</li>`,
                    ]),
                metaActionNeeded
                  ? '<li style="margin:0 0 6px;">MAX — ACTION REQUIRED: Meta authentication failure — Facebook/Instagram did not publish.</li>'
                  : '',
              ]
                .filter(Boolean)
                .join('')}</ul>`
            : escapeHtml(exp002.automaticSending ? AUTOMATION_HEALTHY : 'No outreach action required.')
        }
      </div>
      <h2 style="${H2}">Social distribution</h2>
      ${kvTable([
        {
          label: 'Facebook publishing',
          value: `${social.fbYes ? 'PUBLISHED' : 'FAILED'} (technical success)`,
        },
        {
          label: 'Instagram publishing',
          value: `${social.igYes ? 'PUBLISHED' : social.ig.blocker ? 'FAILED' : 'NOT ATTEMPTED'} (technical success)`,
        },
        {
          label: 'Attributed visits',
          value: `${lead.attributedVisits} (acquisition — publishing is not customer acquisition)`,
          left: true,
        },
      ])}
      <h2 style="${H2}">GetTrainMate — Today</h2>
      ${kvTable([
        { label: 'Visitors / landings 7d (GA4 events)', value: formatCell(board7.landings) },
        { label: 'New signups 7d (GA4 users)', value: formatCell(board7.completed_signups) },
        { label: 'Completed profiles 7d (GA4)', value: formatCell(board7.completed_profiles) },
        { label: 'Completed profiles 30d (GA4)', value: formatCell(board30.completed_profiles) },
        { label: 'Completed profiles — CRM verified', value: md?.status === 'ok' ? 'see Top markets' : 'unavailable' },
        { label: 'Discover 7d / 30d (GA4)', value: `${formatCell(board7.discover_users)} / ${formatCell(board30.discover_users)}` },
        { label: 'Requests 7d / 30d (GA4)', value: `${formatCell(board7.connections_sent)} / ${formatCell(board30.connections_sent)}` },
        { label: 'Matches 7d / 30d (GA4)', value: `${formatCell(board7.matches_created)} / ${formatCell(board30.matches_created)}` },
        { label: 'First messages 7d / 30d (GA4)', value: `${formatCell(board7.first_messages)} / ${formatCell(board30.first_messages)}` },
        { label: 'Returning 7d / 30d (GA4)', value: `${formatCell(board7.returning_users)} / ${formatCell(board30.returning_users)}` },
        { label: 'New paying customers (this run)', value: lead.newCustomersAcquiredByThisRun },
        { label: 'Verified revenue', value: stripe.verifiedRevenue }
      ])}
      <h2 style="${H2}">Acquisition</h2>
      ${kvTable(
        [
          { label: 'Total traffic 7d (all sessions)', value: String(sb.totalTraffic) },
          { label: 'Qualified campaign traffic 7d', value: `${sb.qualifiedTraffic} / 250 target` },
          { label: 'New external signups 7d', value: `${sb.signups} / 10 target` },
          { label: 'Activated users 7d (completed profiles)', value: String(sb.completedProfiles) },
          { label: 'Verified paying customers 7d', value: `${sb.payingCustomers} / 1–3 target` },
          { label: 'Verified revenue 7d', value: sb.revenue },
          { label: 'Distribution attempted', value: lead.distributionAttempted },
          { label: 'Distribution executed', value: lead.distributionExecuted },
          { label: 'Technical distribution result', value: lead.technicalDistributionResult },
          { label: 'Facebook', value: social.fbYes ? 'PUBLISHED' : 'FAILED' },
          { label: 'Instagram', value: social.igYes ? 'PUBLISHED' : 'FAILED' },
          { label: 'Campaign', value: social.fb.campaign || social.ig.campaign || 'n/a', left: true },
          { label: 'Audience/channel', value: lead.audienceChannel, left: true },
          { label: 'What was actually distributed', value: lead.distributionExecutedDetail, left: true },
          { label: 'Attributed visits', value: lead.attributedVisits },
          { label: 'Signups / activations', value: lead.activations },
          { label: 'Customers this run', value: lead.newCustomersAcquiredByThisRun },
          { label: 'Revenue this run', value: lead.verifiedRevenue },
          { label: 'Required owner approval', value: lead.requiredOwnerApproval, left: true }
        ],
        { peach: true }
      )}
      <h2 style="${H2}">Meta authentication</h2>
      ${kvTable([
        { label: 'Meta configuration', value: social.metaAuth?.configuration || (social.metaAuth ? 'PRESENT' : 'UNKNOWN') },
        { label: 'Meta authentication', value: social.metaAuth?.authentication || (distYes ? 'VALID' : 'INVALID') },
        { label: 'Meta status', value: social.metaAuth?.status || (distYes ? 'META_VALID' : 'UNKNOWN'), left: true },
        { label: 'Facebook publishing', value: social.fbYes ? 'PUBLISHED' : social.metaAuth?.facebookPublishing || 'BLOCKED' },
        { label: 'Instagram publishing', value: social.igYes ? 'PUBLISHED' : social.ig.blocker ? 'FAILED' : social.metaAuth?.instagramPublishing || 'BLOCKED' },
        {
          label: 'Instagram error',
          value: social.igYes ? 'none' : social.ig.state || social.ig.blocker || 'n/a',
          left: true
        },
        { label: 'Page', value: `${social.metaAuth?.pageName || 'Get Train Mate App'} (${social.metaAuth?.pageId || '1138684902641972'})`, left: true },
        { label: 'Instagram', value: `@${social.metaAuth?.instagramUsername || 'gettrainmate'} (${social.metaAuth?.instagramId || '17841434503711452'})`, left: true },
        { label: 'Token expiry', value: social.metaAuth?.tokenExpires || 'unknown' },
        { label: 'Last validated', value: social.metaAuth?.validatedAt || 'n/a' },
        {
          label: 'Owner action required',
          value: ownerActionRequiredForMeta(social.metaAuth, { published: distYes }) ? 'YES' : 'NO'
        }
      ])}
      <h2 style="${H2}">Growth by mode</h2>
      ${kvTable([
        { label: 'TRAIN completed profiles (CRM)', value: naMode(modes.TRAIN) },
        { label: 'VIBE completed profiles (CRM)', value: naMode(modes.VIBE) },
        { label: 'DATE completed profiles (CRM)', value: naMode(modes.DATE) }
      ])}
      <h2 style="${H2}">Top markets</h2>
      ${pocketHtml}
      ${metroBlock ? `<pre style="white-space:pre-wrap;font-size:13px;background:#f8fafc;padding:12px;border-radius:8px;margin:0 0 18px;">${escapeHtml(metroBlock)}</pre>` : ''}
      <h2 style="${H2}">Owned social posts</h2>
      ${kvTable([
        { label: 'Facebook post ID', value: social.fb.postId || 'n/a' },
        { label: 'Instagram media/post ID', value: social.ig.postId || 'n/a' },
        { label: 'Facebook campaign', value: social.fb.campaign || 'n/a', left: true },
        { label: 'Instagram campaign', value: social.ig.campaign || 'n/a', left: true }
      ])}
      <h2 style="${H2}">Decision</h2>
      <p style="margin:0 0 18px;padding:16px 18px;background:${decisionBg};border:1px solid ${decisionBd};border-radius:8px;font-size:16px;line-height:1.55;">${escapeHtml(decisionText)}</p>
      ${qualityHtml}
      <h2 style="${H2}">Experiment Results</h2>
      <p style="margin:0 0 10px;font-size:14px;color:#64748b;">Atlanta TRAIN is one experiment. Do not treat the Atlanta landing experiment as the product scoreboard.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;border:1px solid #e2e8f0;border-radius:8px;border-collapse:separate;">
        <tr><td style="padding:14px 16px;">
          <div style="font-size:17px;font-weight:700;">EXP-001 — Atlanta training-partners landing page</div>
          <div style="margin-top:8px;"><span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${keepBadge.bg};color:${keepBadge.color};font-weight:700;font-size:13px;">${escapeHtml(EXP001.decision)}</span></div>
          <div style="margin-top:10px;font-size:15px;line-height:1.5;color:#334155;">
            <div><b>Decision:</b> ${escapeHtml(EXP001.decision)} (treatment unchanged)</div>
            <div><b>30d landing sessions:</b> ${escapeHtml(String(attr30?.landings?.value ?? 'Unavailable'))}</div>
            <div><b>Attributed paid conversions:</b> ${escapeHtml(paidLabel)}</div>
          </div>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid #e2e8f0;border-radius:8px;border-collapse:separate;">
        <tr><td style="padding:14px 16px;">
          <div style="font-size:17px;font-weight:700;">Customer Acquisition CRM <span style="font-size:13px;color:#0369a1;font-weight:600;">(EXP-002)</span></div>
          <div style="margin-top:10px;font-size:15px;line-height:1.5;color:#334155;">
            <div><b>CRM source:</b> ${escapeHtml(exp002.status)}${exp002.unavailable ? ` — ${escapeHtml(exp002.reason || '')}` : ''} · emergency pause ${exp002.pauseAllOutreach ? 'ON' : 'off'}</div>
            ${
              exp002.unavailable
                ? `<div><b>Prospects / Contacts / Drafts / Sent:</b> Unavailable (CRM could not be queried — not zero)</div>`
                : `<div><b>Discovery:</b> prospects ${escapeHtml(exp002.prospects)}, emails ${escapeHtml(exp002.contacts)}, need contact ${escapeHtml(exp002.needContact)}, drafts ${escapeHtml(exp002.draftsPrepared)}</div>
            <div><b>Outreach:</b> awaiting approval ${escapeHtml(exp002.awaitingApproval)}, approved ${escapeHtml(exp002.recipientsApproved)}, sent ${escapeHtml(exp002.emailsSent)}</div>
            <div><b>Engagement:</b> replies ${escapeHtml(exp002.partnerResponses)}, interested ${escapeHtml(exp002.interested)}, partners ${escapeHtml(exp002.partners)}</div>
            <div><b>Customers:</b> signups ${escapeHtml(exp002.partnerSignups)}, paid ${escapeHtml(exp002.customersAcquired)}, revenue_cents ${escapeHtml(exp002.revenueAttributedCents)}</div>`
            }
            <div style="margin-top:8px;"><b>Automatic / Dry Run:</b> ${exp002.automaticSending ? 'ON' : 'OFF'} / ${exp002.dryRun ? 'ON' : 'OFF'}</div>
            <div><b>Owner action:</b> ${escapeHtml(exp002.ownerAction)}</div>
          </div>
        </td></tr>
      </table>
      ${kvTable(stripe.lines.map((l) => {
        const parts = String(l).split(': ');
        return { label: parts[0], value: parts.slice(1).join(': ') || l, left: String(l).length > 48 };
      }))}
      <h2 style="${H2}">Next Actions</h2>
      <div style="margin:0 0 12px;padding:12px 14px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;font-size:15px;line-height:1.5;">
        <b>Primary Acquisition Action:</b> ${escapeHtml(sb.nextAction)}
      </div>
      <ol style="margin:0 0 18px;padding-left:22px;font-size:15px;line-height:1.55;">
        <li style="margin:0 0 8px;">Customer Acquisition: ${escapeHtml(exp002.ownerAction)}${ownerActionRequiresMax(exp002.ownerActions) || !partnerCrmOk ? ' <span style="color:#64748b;">(needs Max)</span>' : ''}</li>
        ${
          md?.status !== 'ok'
            ? '<li style="margin:0 0 8px;">Configure GROWTH_METRO_READ_TOKEN for metro ranking. <span style="color:#64748b;">(needs Max)</span></li>'
            : ''
        }
        ${
          metaActionNeeded
            ? '<li style="margin:0 0 8px;">MAX — ACTION REQUIRED: Facebook/Instagram did not publish — repair Meta SSM credentials and retry publish-owned-social.mjs.</li>'
            : ''
        }
        <li style="margin:0 0 8px;">Concentrate owned-social rotation on the highest-ranked metro/mode pocket. <span style="color:#64748b;">(automatic)</span></li>
      </ol>
      <h2 style="${H2}">Production Health</h2>
      <p style="margin:0 0 8px;font-size:15px;"><b>Overall:</b> ${healthOk ? 'OK' : health?.checks?.length ? 'Failed' : 'Unknown (checks not run)'}</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:15px;margin:0 0 18px;">
        <thead><tr style="background:#f1f5f9;"><th align="left" style="padding:8px 12px;">Check</th><th align="left" style="padding:8px 12px;">Status</th></tr></thead>
        <tbody>${healthRows || '<tr><td colspan="2" style="padding:8px 12px;">No health checks executed in this report build.</td></tr>'}</tbody>
      </table>
      <h2 style="${H2}">Data Sources</h2>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#334155;">GA4: ${escapeHtml(snapshot?.sources?.ga4 ?? 'unknown')}. Stripe: ${escapeHtml(snapshot?.sources?.stripe ?? 'unknown')}. Metro / Admin CRM: ${escapeHtml(md?.status ?? 'unavailable')}. Only GetTrainMate-attributed Stripe transactions are reported.</p>
      <h2 style="font-size:16px;margin:28px 0 10px;color:#64748b;">Technical Details</h2>
      <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">
        UTC: ${escapeHtml(generatedUtc)}.
        Snapshot: ${escapeHtml(snapshot?.snapshotId || 'n/a')}.
        Commit: ${escapeHtml(sha || 'unknown')}.
        GA4 through ${escapeHtml(ga4Through)}; report day ${escapeHtml(et.ymd)}.
        Measurement ID: G-C29M8NWNY4.
        Missing configuration: metro ${md?.status === 'ok' ? 'ok' : 'missing_or_api_unavailable'}; Stripe attribution ${stripe.configured ? 'metadata rules configured' : 'not configured'}; Meta configuration ${escapeHtml(social.metaAuth?.configuration || 'unknown')}; Meta authentication ${escapeHtml(social.metaAuth?.authentication || (distYes ? 'VALID' : 'INVALID'))} (${escapeHtml(social.metaAuth?.status || social.blocker || 'n/a')}).
        Controlled error codes: ${escapeHtml(md?.errorCode || (md?.status === 'ok' ? 'none' : 'metro_token_unconfigured'))}.
      </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { text, html, et, subject, subjectMeta: { shipped, dataQualityNeeded: showDataQualityWarning } };
}
