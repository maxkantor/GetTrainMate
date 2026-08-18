/**
 * Admin growth-report HTML + text (YouTubeBooster-style section order).
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
    hour12: true,
    timeZoneName: 'short'
  }).format(d);
  return { dateStr, timeStr, isoDate: d.toISOString().slice(0, 10) };
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
  const blocker = os.connectorBlocker || fb.blocker || ig.blocker || '';
  return { os, fb, ig, fbYes, igYes, executed, blocker };
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
    .join(' + ') || 'Owned social (Facebook + Instagram) — not published this run';
  return {
    distributionExecuted: social.executed,
    audienceChannel: channel,
    attributedVisits: social.fbYes || social.igYes ? 'Pending GA4 (post just published)' : '0',
    activations: formatCell(board7.completed_signups),
    checkoutStarts: formatCell(board7.checkout_starts || board7.checkoutStarts),
    newlyAttributedExternalCustomers: '0',
    verifiedRevenue: '$0.00',
    requiredOwnerApproval: social.blocker
      ? `Meta connector: ${social.blocker}`
      : social.executed === 'none'
        ? 'Meta credentials missing or publish failed — draft is not distribution'
        : 'No per-post owner approval required when Meta Page token is valid',
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
  return out;
}

export function defaultDecision({ health, reconciliation, shipped, snapshot } = {}) {
  const healthOk = health?.ok !== false;
  const reconOk = reconciliation?.ok !== false;
  const social = ownedSocialSummary(snapshot);
  const shippedLine = shipped ? 'Shipped: code in this run.' : 'Shipped: none.';
  return (
    `${shippedLine} ` +
    `GetTrainMate is TRAIN + VIBE + DATE, multilingual and international. Atlanta TRAIN is one acquisition experiment, not the product. ` +
    `Owned social: ${social.executed}${social.blocker ? ` · blocker: ${social.blocker}` : ''}. ` +
    'Partner email remains fail-closed. ' +
    'EXP-001 KEEP (Atlanta landing experiment). EXP-002 collecting. EXP-003 referral is user-initiated, not a wait action. ' +
    'Existing verified customers: 0. New customers acquired by this run: 0. ' +
    `Production is ${healthOk ? 'healthy' : 'FAILED'}.` +
    (reconOk ? '' : ' Data quality warning is in effect.')
  );
}

function stripeStatusLines(snapshot) {
  const allow = loadStripeAllowlist();
  const configured = allow.productIds.size > 0 || allow.priceIds.size > 0 || allow.paymentLinkIds.size > 0;
  const reconComplete = Boolean(allow.reconciliationComplete);
  const board30 = snapshot?.scoreboard?.['30d'] || {};
  const payments = formatCell(board30.live_payments);
  const customers = formatCell(board30.unique_paying_customers);
  const revenue = formatCell(board30.revenue);
  const unattr = formatCell(board30.unattributed_live_payments);
  if (!configured || !reconComplete) {
    return {
      configured,
      verifiedRevenue: '$0.00',
      verifiedCustomers: '0',
      lines: [
        'Verified attributed payments: 0',
        'Verified external customers: 0',
        'Attributed revenue: $0.00',
        `Unattributed payments: ${unattr}`,
        'Attribution status: Incomplete — product allowlist not configured; verified customers held at baseline 0'
      ]
    };
  }
  return {
    configured: true,
    verifiedRevenue: revenue,
    verifiedCustomers: customers,
    lines: [
      `Verified attributed payments: ${payments}`,
      `Verified external customers: ${customers}`,
      `Attributed revenue: ${revenue}`,
      `Unattributed payments: ${unattr}`,
      'Attribution status: Product/Price allowlist configured'
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
  experiments,
  notes,
  generatedAt,
  decision,
  shipped = false,
  acquisition
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

  const t = [];
  t.push('GetTrainMate Growth Report');
  t.push('==========================');
  t.push('Product: multilingual international TRAIN + VIBE + DATE. Atlanta TRAIN is one experiment, not the product.');
  t.push(`Local time: ${et.dateStr} ${et.timeStr} (${TIMEZONE})`);
  t.push(`Site: ${SITE.origin}`);
  t.push('');
  t.push('1) GETTRAINMATE GLOBAL GROWTH');
  t.push('-----------------------------');
  t.push(`Total completed profiles (30d users): ${formatCell(board30.completed_profiles)}`);
  t.push(`New profiles 7d (users): ${formatCell(board7.completed_profiles)}`);
  t.push(`Landings 7d / 30d (events): ${formatCell(board7.landings)} / ${formatCell(board30.landings)}`);
  t.push(`Signups 7d / 30d (users): ${formatCell(board7.completed_signups)} / ${formatCell(board30.completed_signups)}`);
  t.push(`Discover users 7d / 30d: ${formatCell(board7.discover_users)} / ${formatCell(board30.discover_users)}`);
  t.push(`Requests 7d / 30d (events): ${formatCell(board7.connections_sent)} / ${formatCell(board30.connections_sent)}`);
  t.push(`Matches 7d / 30d (events): ${formatCell(board7.matches_created)} / ${formatCell(board30.matches_created)}`);
  t.push(`First messages 7d / 30d: ${formatCell(board7.first_messages)} / ${formatCell(board30.first_messages)}`);
  t.push(`Returning users 7d / 30d: ${formatCell(board7.returning_users)} / ${formatCell(board30.returning_users)}`);
  t.push(`Verified paying customers: ${stripe.verifiedCustomers}`);
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
  t.push('4) ACQUISITION EXECUTED TODAY');
  t.push('-----------------------------');
  t.push(`What was actually distributed: ${ascii(lead.distributionExecuted)}`);
  t.push(`Audience/channel: ${ascii(lead.audienceChannel)}`);
  t.push(`channel: ${ascii(lead.audienceChannel)}`);
  t.push(`market: evidence-ranked (not Atlanta-only)`);
  t.push(`language: ${ascii(social.os.language || 'n/a')}`);
  t.push(`mode: ${ascii(social.os.mode || 'n/a')}`);
  t.push(`campaign: ${ascii(social.fb.campaign || social.ig.campaign || 'n/a')}`);
  t.push(`distribution status: ${ascii(lead.distributionExecuted)}`);
  t.push(`visits: ${ascii(lead.attributedVisits)}`);
  t.push(`signups: ${ascii(lead.activations)}`);
  t.push(`profiles: ${formatCell(board7.completed_profiles)}`);
  t.push(`Discover users: ${formatCell(board7.discover_users)}`);
  t.push(`matches: ${formatCell(board7.matches_created)}`);
  t.push(`customers: ${ascii(lead.newCustomersAcquiredByThisRun)}`);
  t.push(`revenue: ${ascii(lead.verifiedRevenue)}`);
  t.push('Draft prepared does not count as distribution.');
  t.push('');
  t.push('5) OWNED SOCIAL DISTRIBUTION');
  t.push('----------------------------');
  t.push(`Facebook page: ${PREPARED_OWNED_SOCIAL.facebookUrl}`);
  t.push(`Instagram: ${PREPARED_OWNED_SOCIAL.instagramUrl}`);
  t.push(`Facebook: Published: ${social.fbYes ? 'YES' : 'NO'}`);
  t.push(`  Post ID: ${ascii(social.fb.postId || 'n/a')}`);
  t.push(`  Campaign: ${ascii(social.fb.campaign || 'n/a')}`);
  t.push(`  Mode: ${ascii(social.fb.mode || social.os.mode || 'n/a')}`);
  t.push(`  Language: ${ascii(social.fb.language || social.os.language || 'n/a')}`);
  t.push(`  Attributed visits: ${ascii(social.fb.attributedVisits || lead.attributedVisits)}`);
  t.push(`  Completed profiles: ${ascii(social.fb.completedProfiles || 'Unavailable')}`);
  t.push(`  Matches: ${ascii(social.fb.matches || 'Unavailable')}`);
  t.push(`  Customers: ${ascii(social.fb.customers || '0')}`);
  if (social.fb.blocker) t.push(`  Blocker: ${ascii(social.fb.blocker)}`);
  t.push(`Instagram: Published: ${social.igYes ? 'YES' : 'NO'}`);
  t.push(`  Media/Post ID: ${ascii(social.ig.postId || 'n/a')}`);
  t.push(`  Campaign: ${ascii(social.ig.campaign || 'n/a')}`);
  t.push(`  Mode: ${ascii(social.ig.mode || social.os.mode || 'n/a')}`);
  t.push(`  Language: ${ascii(social.ig.language || social.os.language || 'n/a')}`);
  t.push(`  Attributed visits: ${ascii(social.ig.attributedVisits || lead.attributedVisits)}`);
  t.push(`  Completed profiles: ${ascii(social.ig.completedProfiles || 'Unavailable')}`);
  t.push(`  Matches: ${ascii(social.ig.matches || 'Unavailable')}`);
  t.push(`  Customers: ${ascii(social.ig.customers || '0')}`);
  if (social.ig.blocker) t.push(`  Blocker: ${ascii(social.ig.blocker)}`);
  t.push('');
  t.push('6) DECISION');
  t.push('-----------');
  t.push(decisionText);
  t.push('');
  t.push(`What shipped: ${shipped ? 'code this run' : 'none'}`);
  t.push(`Newly attributed external customers: ${ascii(lead.newlyAttributedExternalCustomers)}`);
  t.push(`Verified revenue: ${ascii(lead.verifiedRevenue)}`);
  t.push(`Required owner approval: ${ascii(lead.requiredOwnerApproval)}`);
  t.push(`Meta / owner note: ${ascii(lead.requiredOwnerApproval)}`);
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
  t.push(`GA4 data-through date: ${snapshot?.ga4DataThrough || et.isoDate}`);
  t.push('Measurement ID: G-C29M8NWNY4');
  t.push(`Snapshot ID: ${snapshot?.snapshotId || snapshot?.wrote || 'n/a'}`);
  t.push(`Commit: ${exp001?.commit || exp002row?.commit || 'n/a'}`);
  t.push(`Amplify deployment: ${ascii(exp001?.amplify || exp002row?.amplify || 'n/a')}`);
  t.push(
    `Missing configuration: metro token ${md?.status === 'ok' ? 'ok' : 'missing'}; Stripe product allowlist ${stripe.configured ? 'configured' : 'not configured'}`
  );
  t.push(`Controlled error codes: ${md?.errorCode || (md?.status === 'ok' ? 'none' : 'metro_token_unconfigured')}`);
  t.push(
    `Stripe allowlist status: ${stripe.configured ? 'configured' : 'Incomplete — product allowlist not configured'}`
  );
  if (noteText) t.push(`Agent notes (sanitized): ${noteText}`);

  const text = t.join('\n');

  const healthRows = (health?.checks || [])
    .map(
      (c) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(c.name)}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${c.ok ? 'OK' : 'FAIL'}</td></tr>`
    )
    .join('');

  const pocketHtml = pockets.length
    ? `<ul style="margin:0 0 16px;padding-left:18px;font-size:13px;line-height:1.5;">${pockets
        .map(
          (p) =>
            `<li>${escapeHtml(p.country || '?')} / ${escapeHtml(p.metro || '?')} / ${escapeHtml(p.language || 'n/a')} / ${escapeHtml(p.mode || 'all')} / completed=${p.completedProfiles ?? 0} / matches=${p.matches ?? 0}</li>`
        )
        .join('')}</ul>`
    : `<p style="margin:0 0 16px;font-size:13px;">${md?.status === 'ok' ? 'No metro pockets above cohort threshold.' : 'Unavailable (Metro CRM)'}</p>`;

  const qualityHtml = dataQualityNeeded
    ? `<h2 style="font-size:15px;margin:18px 0 8px;color:#b45309;">7) Data Quality Warning</h2>
      <div style="padding:12px;border:1px solid #f59e0b;background:#fffbeb;border-radius:8px;font-size:13px;line-height:1.45;">
        <p style="margin:0 0 8px;">Measurement blocked for flagged metrics. Production health is evaluated separately.</p>
        <ul style="margin:0;padding-left:18px;">${qualityLines.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>
      </div>`
    : `<h2 style="font-size:15px;margin:18px 0 8px;">7) Data Quality Warning</h2>
      <p style="margin:0 0 16px;font-size:13px;">None. Measurement not blocked.</p>`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GetTrainMate Growth</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Segoe UI,Arial,sans-serif;color:#111827;">
  <div style="max-width:640px;margin:24px auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
    <div style="padding:18px 20px;background:#0f172a;color:#fff;">
      <div style="font-size:18px;font-weight:700;">GetTrainMate Growth</div>
      <div style="font-size:13px;opacity:0.9;margin-top:4px;">TRAIN + VIBE + DATE · ${escapeHtml(et.dateStr)} · ${escapeHtml(et.timeStr)}</div>
    </div>
    <div style="padding:18px 20px;">
      <h2 style="font-size:15px;margin:0 0 8px;">1) GetTrainMate global growth</h2>
      <p style="margin:0 0 16px;font-size:13px;line-height:1.5;">
        Completed profiles 30d: ${escapeHtml(formatCell(board30.completed_profiles))}<br/>
        New profiles 7d: ${escapeHtml(formatCell(board7.completed_profiles))}<br/>
        Discover 7d / 30d: ${escapeHtml(formatCell(board7.discover_users))} / ${escapeHtml(formatCell(board30.discover_users))}<br/>
        Requests 7d / 30d: ${escapeHtml(formatCell(board7.connections_sent))} / ${escapeHtml(formatCell(board30.connections_sent))}<br/>
        Matches 7d / 30d: ${escapeHtml(formatCell(board7.matches_created))} / ${escapeHtml(formatCell(board30.matches_created))}<br/>
        First messages 7d / 30d: ${escapeHtml(formatCell(board7.first_messages))} / ${escapeHtml(formatCell(board30.first_messages))}<br/>
        Returning 7d / 30d: ${escapeHtml(formatCell(board7.returning_users))} / ${escapeHtml(formatCell(board30.returning_users))}<br/>
        Verified paying customers: ${escapeHtml(stripe.verifiedCustomers)}<br/>
        Verified revenue: ${escapeHtml(stripe.verifiedRevenue)}
      </p>
      <h2 style="font-size:15px;margin:18px 0 8px;">2) Growth by mode</h2>
      <p style="margin:0 0 16px;font-size:13px;line-height:1.5;">TRAIN: ${escapeHtml(naMode(modes.TRAIN))}<br/>VIBE: ${escapeHtml(naMode(modes.VIBE))}<br/>DATE: ${escapeHtml(naMode(modes.DATE))}</p>
      <h2 style="font-size:15px;margin:18px 0 8px;">3) Top markets</h2>
      ${pocketHtml}
      <h2 style="font-size:15px;margin:18px 0 8px;">4) Acquisition executed today</h2>
      <p style="margin:0 0 16px;padding:12px;background:#fff7ed;border:1px solid #fdba74;border-radius:8px;font-size:13px;line-height:1.5;">
        What was actually distributed: ${escapeHtml(lead.distributionExecuted)}<br/>
        Audience/channel: ${escapeHtml(lead.audienceChannel)}<br/>
        Distribution: ${escapeHtml(lead.distributionExecuted)}<br/>
        Channel: ${escapeHtml(lead.audienceChannel)}<br/>
        Mode / language: ${escapeHtml(social.os.mode || 'n/a')} / ${escapeHtml(social.os.language || 'n/a')}<br/>
        Visits: ${escapeHtml(lead.attributedVisits)}<br/>
        Signups: ${escapeHtml(lead.activations)}<br/>
        Customers this run: ${escapeHtml(lead.newCustomersAcquiredByThisRun)}<br/>
        New customers acquired by the current run: ${escapeHtml(lead.newCustomersAcquiredByThisRun)}<br/>
        Required owner approval: ${escapeHtml(lead.requiredOwnerApproval)}<br/>
        Draft prepared does not count as distribution.
      </p>
      <h2 style="font-size:15px;margin:18px 0 8px;">5) Owned social distribution</h2>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.5;">
        Accounts: ${escapeHtml(PREPARED_OWNED_SOCIAL.facebookUrl)} · ${escapeHtml(PREPARED_OWNED_SOCIAL.instagramUrl)}<br/>
        Facebook: Published: ${social.fbYes ? 'YES' : 'NO'} · Post ID: ${escapeHtml(social.fb.postId || 'n/a')}<br/>
        Campaign: ${escapeHtml(social.fb.campaign || 'n/a')} · Mode: ${escapeHtml(social.fb.mode || social.os.mode || 'n/a')} · Language: ${escapeHtml(social.fb.language || social.os.language || 'n/a')}<br/>
        ${social.fb.blocker ? `Blocker: ${escapeHtml(social.fb.blocker)}<br/>` : ''}
        Instagram: Published: ${social.igYes ? 'YES' : 'NO'} · Media/Post ID: ${escapeHtml(social.ig.postId || 'n/a')}<br/>
        Campaign: ${escapeHtml(social.ig.campaign || 'n/a')} · Mode: ${escapeHtml(social.ig.mode || social.os.mode || 'n/a')} · Language: ${escapeHtml(social.ig.language || social.os.language || 'n/a')}
        ${social.ig.blocker ? `<br/>Blocker: ${escapeHtml(social.ig.blocker)}` : ''}
      </p>
      <h2 style="font-size:15px;margin:18px 0 8px;">6) Decision</h2>
      <p style="margin:0 0 16px;padding:12px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;font-size:14px;line-height:1.5;">${escapeHtml(decisionText)}</p>
      ${qualityHtml}
      <h2 style="font-size:15px;margin:18px 0 8px;">8) Experiments (not the global KPI)</h2>
      <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">Atlanta TRAIN is one experiment. Do not treat the Atlanta landing experiment as the product scoreboard.</p>
      <div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;font-size:13px;line-height:1.45;margin-bottom:12px;">
        <div style="font-weight:700;">EXP-001 — Atlanta training-partners landing page</div>
        <div>Decision: ${escapeHtml(EXP001.decision)} (treatment unchanged)</div>
        <div>30d landing sessions: ${escapeHtml(String(attr30?.landings?.value ?? 'Unavailable'))}</div>
        <div>Attributed paid conversions: ${escapeHtml(
          attr30?.attributed_paid_conversions?.available
            ? String(attr30.attributed_paid_conversions.value)
            : attr30?.attributed_paid_conversions?.label || 'Unknown'
        )}</div>
      </div>
      <div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;font-size:13px;line-height:1.45;margin-bottom:12px;">
        <div style="font-weight:700;">EXP-002 — Atlanta partner hub and invite-code acquisition</div>
        <div>Evaluation: ${escapeHtml(EXP002.evaluationWeekday)} (${escapeHtml(EXP002.evaluationDate)})</div>
        <div>Drafts prepared: ${escapeHtml(exp002.draftsPrepared)} (not approved, not sent)</div>
      </div>
      <p style="margin:0 0 16px;font-size:13px;line-height:1.5;">${stripe.lines.map((l) => escapeHtml(l)).join('<br/>')}</p>
      ${metroBlock ? `<pre style="white-space:pre-wrap;font-size:12px;background:#f8fafc;padding:12px;border-radius:8px;">${escapeHtml(metroBlock)}</pre>` : ''}
      <h2 style="font-size:15px;margin:18px 0 8px;">9) Next actions</h2>
      <ol style="margin:0 0 16px;padding-left:18px;font-size:13px;line-height:1.5;">
        <li>Owner action required: if Metro CRM is unavailable, configure the metro read token (GROWTH_METRO_READ_TOKEN).</li>
        <li>If Facebook/Instagram Published=NO: configure Meta Page token + Page id + IG business id in SSM and run publish-owned-social.mjs.</li>
        <li>Partner email stays paused until a verified public recipient is approved. Never invent inboxes.</li>
        <li>Concentrate the next owned-social rotation on the highest-ranked metro/mode pocket.</li>
      </ol>
      <h2 style="font-size:15px;margin:18px 0 8px;">10) Production Health</h2>
      <p style="margin:0 0 8px;font-size:13px;"><b>Overall:</b> ${health?.ok ? 'OK' : 'FAILED'}</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;"><tbody>${healthRows}</tbody></table>
      <h2 style="font-size:15px;margin:18px 0 8px;">11) Data Sources</h2>
      <p style="margin:0;font-size:13px;">GA4: ${escapeHtml(snapshot?.sources?.ga4 ?? 'unknown')}<br/>Stripe: ${escapeHtml(snapshot?.sources?.stripe ?? 'unknown')}<br/>Metro / Admin CRM: ${escapeHtml(md?.status ?? 'unavailable')}</p>
      <h2 style="font-size:15px;margin:18px 0 8px;color:#6b7280;">12) Technical Details</h2>
      <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.45;">
        UTC timestamp: ${escapeHtml(generatedUtc)}<br/>
        Measurement ID: G-C29M8NWNY4<br/>
        Snapshot ID: ${escapeHtml(snapshot?.snapshotId || 'n/a')}<br/>
        Missing configuration: metro ${md?.status === 'ok' ? 'ok' : 'token not configured'}; Stripe allowlist ${stripe.configured ? 'ok' : 'not configured'}; Meta ${social.os.connectorHealthy ? 'ok' : 'not configured'}<br/>
        Controlled error codes: ${escapeHtml(md?.errorCode || (md?.status === 'ok' ? 'none' : 'metro_token_unconfigured'))}
      </p>
    </div>
  </div>
</body>
</html>`;

  return { text, html, et, subjectMeta: { shipped, dataQualityNeeded } };
}
