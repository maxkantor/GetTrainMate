/**
 * Admin growth-report HTML + text (LuckyNumbersLab layout; GetTrainMate TRAIN + VIBE + DATE order).
 */
import { SITE, EXP001, EXP002, EXP003, TIMEZONE } from './metric-definitions.mjs';
import { formatCell } from './normalize-metrics.mjs';
import { loadStripeAllowlist } from './stripe-attribution.mjs';
import { modeTotalsFromMetro, pocketsFromMetroCrm } from './market-density.mjs';

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
  const base = `GetTrainMate Growth — ${phrase} · ${customers} · ${et.shortDate}`;
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
  const fbYes = fb.published === true;
  const igYes = ig.published === true;
  const parts = [];
  if (fbYes) parts.push(`Facebook ${fb.postId || 'published'}`);
  if (igYes) parts.push(`Instagram ${ig.postId || 'published'}`);
  const executed = parts.length ? parts.join(' + ') : 'none';
  const blocker = os.connectorBlocker || fb.blocker || ig.blocker || os.metaAuth?.status || '';
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
    requiredOwnerApproval: social.metaAuth?.ownerActionRequired
      ? 'YES — META REAUTHORIZATION'
      : social.blocker
        ? `Meta: ${social.blocker}`
        : published
          ? 'No per-post owner approval required when Meta Page token is valid'
          : 'Meta credentials missing or publish failed — draft is not distribution',
    existingCustomers: existing,
    customersObservedInWindow:
      observed === 'Unavailable'
        ? '0 (do not call observed payers new customers)'
        : `${observed} (observed in window; not new customers this run)`,
    customersCausallyAttributedToExperiment: '0 (no causal proof this run)',
    newCustomersAcquiredByThisRun: '0'
  };
}

/**
 * Merge snapshot.acquisitionLead or a JSON object in notes with defaults.
 * Unknown / missing fields stay honest zeros or "none".
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
  // Notes often pass a narrative under distributionExecuted — keep YES/NO semantics.
  if (extra.distributionExecuted && !/^(YES|NO)$/i.test(String(extra.distributionExecuted).trim())) {
    out.distributionExecutedDetail = String(extra.distributionExecuted).trim();
    if (extra.distributionAttempted == null) out.distributionAttempted = 'YES';
    if (!/^(YES|NO)$/i.test(String(out.distributionExecuted))) {
      out.distributionExecuted = base.distributionExecuted;
    }
  }
  return out;
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
  return (
    `${shippedLine} ` +
    `GetTrainMate is TRAIN + VIBE + DATE, multilingual and international. Atlanta TRAIN is one acquisition experiment, not the product. ` +
    `Owned social: ${social.executed}. ` +
    (metaAuth ? `Meta authentication: ${metaAuth}. ` : '') +
    (igLine ? `${igLine} ` : social.blocker && !igFail ? `Blocker: ${social.blocker}. ` : '') +
    'Partner email remains fail-closed. ' +
    'EXP-001 KEEP (Atlanta landing experiment). EXP-002 collecting. EXP-003 referral is user-initiated, not a wait action. ' +
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
  const unattr = formatCell(board30.unattributed_live_payments);
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
        `Unattributed payments: ${unattr}`,
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
      `Unattributed payments: ${unattr}`,
      'Attribution status: reconciliationComplete — metadata and/or Product/Price allowlist'
    ]
  };
}

function exp002Stats(snapshot) {
  const s = snapshot?.partnerOutreach || {};
  const na = (v) => (v == null || v === '' ? 'Unavailable' : String(v));
  return {
    partnerPagesCreated: na(s.partnerPagesCreated ?? 10),
    inviteCodesCreated: na(s.inviteCodesCreated ?? 10),
    draftsPrepared: na(s.draftsPrepared ?? 9),
    recipientsApproved: na(s.recipientsApproved ?? 0),
    emailsSent: na(s.emailsSent ?? 'See private operational record'),
    delivered: na(s.delivered ?? 'Unknown'),
    partnerResponses: na(s.partnerResponses ?? 'Unknown'),
    partnerVisits: na(s.partnerAttributedVisits ?? 'Unavailable'),
    partnerSignups: na(s.partnerAttributedSignups ?? 'Unavailable'),
    completedProfiles: na(s.completedProfiles ?? 'Unavailable'),
    discoverUsers: na(s.discoverUsers ?? 'Unavailable'),
    connectionRequests: na(s.connectionRequests ?? 'Unavailable')
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
  const dataQualityNeeded = recon && recon.ok === false;
  const qualityLines = dataQualityNeeded ? (recon.warnings || []).map((w) => ascii(w)) : [];
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
  t.push('GetTrainMate Growth Report');
  t.push('==========================');
  t.push('Product: multilingual international TRAIN + VIBE + DATE. Atlanta TRAIN is one experiment, not the product.');
  t.push(`Local time: ${et.dateStr} ${et.timeStr}`);
  t.push(`Report generated: ${et.monthDayYear}`);
  t.push(`GA4 data through: ${formatMonthDayYearFromYmd(ga4Through)}`);
  t.push(`Site: ${SITE.origin}`);
  t.push('');
  t.push('1) GETTRAINMATE — TODAY');
  t.push('------------------------');
  t.push(`Visitors / landings 7d (GA4 events): ${formatCell(board7.landings)}`);
  t.push(`New signups 7d (GA4 users): ${formatCell(board7.completed_signups)}`);
  t.push(`Completed profiles 7d (GA4 users): ${formatCell(board7.completed_profiles)}`);
  t.push(`Completed profiles 30d (GA4 users): ${formatCell(board30.completed_profiles)}`);
  t.push(`Completed profiles — CRM verified: ${md?.status === 'ok' ? 'see Top markets' : 'unavailable'}`);
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
  t.push('country / city / language / mode / profiles / matches (ranked by liquidity evidence; missing metrics not guessed)');
  if (!pockets.length) {
    t.push(md?.status === 'ok' ? 'No metro pockets above cohort threshold.' : 'Unavailable (Metro CRM)');
  } else {
    for (const p of pockets) {
      t.push(
        `  ${p.country || '?'} / ${p.metro || '?'} / ${p.language || 'n/a'} / ${p.mode || 'all'} / completed=${p.completedProfiles ?? 0} / matches=${p.matches ?? 0}`
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
        ma.ownerActionRequired === true || ma.ownerActionRequired === 'YES'
          ? 'YES'
          : ma.authentication === 'VALID' || social.fbYes
            ? 'NO'
            : ma.authentication === 'INVALID'
              ? 'YES'
              : 'NO'
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
  if (dataQualityNeeded) {
    t.push('7) DATA QUALITY WARNING');
    t.push('-----------------------');
    t.push('Measurement blocked for flagged metrics. Production health is separate.');
    for (const w of qualityLines) t.push(`- ${w}`);
    t.push('');
  } else {
    t.push('7) DATA QUALITY WARNING');
    t.push('-----------------------');
    t.push('None. Measurement not blocked.');
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
  t.push(`EXP-002 — Atlanta partner hub and invite-code acquisition`);
  t.push(`  Evaluation: ${EXP002.evaluationWeekday} (${EXP002.evaluationDate})`);
  if (exp002row) {
    t.push(`  Status: ${exp002row.status} | Stage: ${exp002row.funnelStage || 'n/a'}`);
    if (exp002row.commit) t.push(`  Commit: ${SITE.repo}/commit/${exp002row.commit}`);
  }
  t.push(`  Partner pages created: ${exp002.partnerPagesCreated}`);
  t.push(`  Invite codes created: ${exp002.inviteCodesCreated}`);
  t.push(`  Drafts prepared: ${exp002.draftsPrepared} (not approved, not sent)`);
  t.push(`  Recipients explicitly approved: ${exp002.recipientsApproved}`);
  t.push(`  Emails actually sent: ${exp002.emailsSent}`);
  t.push(`  Delivered when known: ${exp002.delivered}`);
  t.push(`  Partner responses: ${exp002.partnerResponses}`);
  t.push(`  Partner-attributed visits: ${exp002.partnerVisits}`);
  t.push(`  Partner-attributed signups: ${exp002.partnerSignups}`);
  t.push(`  Completed profiles: ${exp002.completedProfiles}`);
  t.push(`  Discover users: ${exp002.discoverUsers}`);
  t.push(`  Connection requests: ${exp002.connectionRequests}`);
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
  t.push('Owner action required:');
  if (md?.status !== 'ok') {
    t.push('  - Configure the metro read token (GROWTH_METRO_READ_TOKEN) so country/metro/mode ranking is available.');
  }
  t.push('  - If Facebook/Instagram Published=NO: store Meta Page token + Page id + IG business id in SSM /gettrainmate/growth/* and retry node scripts/growth/publish-owned-social.mjs.');
  t.push('  - Partner email stays paused until a verified public recipient is approved in Admin CRM. Never invent inboxes.');
  t.push('  - Concentrate the next owned-social rotation on the highest-ranked metro/mode pocket above — not Atlanta-only by default.');
  t.push('  - Configure Stripe Product/Price allowlists if still incomplete.');
  t.push('');
  t.push('10) PRODUCTION HEALTH');
  t.push('--------------------');
  t.push(`Overall: ${health?.ok ? 'OK' : 'FAILED'}`);
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
  const qualityHtml = dataQualityNeeded
    ? `<h2 style="${H2}">Data Quality Warning</h2>
       <ul style="margin:0 0 18px;padding:12px 12px 12px 32px;background:#fff7ed;border:1px solid #fdba74;border-radius:8px;font-size:15px;line-height:1.55;color:#9a3412;">
         ${qualityLines.map((w) => `<li style="margin:0 0 8px;">${escapeHtml(w)}</li>`).join('')}
       </ul>`
    : `<h2 style="${H2}">Data Quality Warning</h2>
       <p style="margin:0 0 18px;font-size:15px;color:#334155;">None. Measurement not blocked.</p>`;
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
          <div style="font-size:22px;font-weight:700;line-height:1.3;">GetTrainMate — Growth report</div>
          <div style="font-size:14px;opacity:0.9;margin-top:6px;">${escapeHtml(et.dateStr)} ${escapeHtml(et.timeStr)}</div>
          <div style="font-size:14px;opacity:0.9;margin-top:4px;">Report generated: ${escapeHtml(et.monthDayYear)} · GA4 data through: ${escapeHtml(formatMonthDayYearFromYmd(ga4Through))}</div>
          <div style="margin-top:14px;line-height:1.8;">${links}</div>
        </td></tr>
        <tr><td style="padding:24px 28px 32px;">
      <h2 style="${H2_FIRST}">GetTrainMate — Today</h2>
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
          value:
            social.metaAuth?.ownerActionRequired === true || social.metaAuth?.ownerActionRequired === 'YES'
              ? 'YES'
              : social.metaAuth?.authentication === 'VALID' || distYes
                ? 'NO'
                : social.metaAuth?.authentication === 'INVALID'
                  ? 'YES'
                  : 'NO'
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
          <div style="font-size:17px;font-weight:700;">EXP-002 — Atlanta partner hub and invite-code acquisition</div>
          <div style="margin-top:10px;font-size:15px;line-height:1.5;color:#334155;">
            <div><b>Evaluation:</b> ${escapeHtml(EXP002.evaluationWeekday)} (${escapeHtml(EXP002.evaluationDate)})</div>
            <div><b>Drafts prepared:</b> ${escapeHtml(exp002.draftsPrepared)} (not approved, not sent)</div>
          </div>
        </td></tr>
      </table>
      ${kvTable(stripe.lines.map((l) => {
        const parts = String(l).split(': ');
        return { label: parts[0], value: parts.slice(1).join(': ') || l, left: String(l).length > 48 };
      }))}
      <h2 style="${H2}">Next Actions</h2>
      <ol style="margin:0 0 18px;padding-left:22px;font-size:15px;line-height:1.55;">
        <li style="margin:0 0 8px;">If Metro CRM is unavailable, configure GROWTH_METRO_READ_TOKEN. <span style="color:#64748b;">(needs Max)</span></li>
        <li style="margin:0 0 8px;">If Facebook/Instagram Published=NO: store Meta credentials in /gettrainmate/growth/* and retry publish-owned-social.mjs. <span style="color:#64748b;">(automatic)</span></li>
        <li style="margin:0 0 8px;">Partner email stays paused until a verified public recipient is approved. Never invent inboxes. <span style="color:#64748b;">(needs Max)</span></li>
        <li style="margin:0 0 8px;">Concentrate the next owned-social rotation on the highest-ranked metro/mode pocket. <span style="color:#64748b;">(automatic)</span></li>
      </ol>
      <h2 style="${H2}">Production Health</h2>
      <p style="margin:0 0 8px;font-size:15px;"><b>Overall:</b> ${health?.ok ? 'OK' : 'Failed'}</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:15px;margin:0 0 18px;">
        <thead><tr style="background:#f1f5f9;"><th align="left" style="padding:8px 12px;">Check</th><th align="left" style="padding:8px 12px;">Status</th></tr></thead>
        <tbody>${healthRows || '<tr><td style="padding:8px 12px;">(unavailable)</td></tr>'}</tbody>
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

  return { text, html, et, subject, subjectMeta: { shipped, dataQualityNeeded } };
}
