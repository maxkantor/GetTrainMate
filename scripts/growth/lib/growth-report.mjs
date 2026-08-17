/**
 * Admin growth-report HTML + text (YouTubeBooster-style section order).
 */
import { SITE, EXP001, EXP002, EXP003, TIMEZONE } from './metric-definitions.mjs';
import { formatCell } from './normalize-metrics.mjs';
import { loadStripeAllowlist } from './stripe-attribution.mjs';

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

export function formatMetroUnavailable(md) {
  if (!md || md.status === 'ok') return null;
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
  approvalId: 'IG-2026-08-17',
  channel: 'Instagram @gettrainmate (owned; https://www.instagram.com/gettrainmate/)',
  landingUrl:
    'https://gettrainmate.com/atlanta-training-partners?utm_source=instagram&utm_medium=organic&utm_campaign=owned-ig-2026-08-17',
  caption: [
    'Looking for a consistent training partner in Atlanta?',
    '',
    'GetTrainMate is TRAIN-first (not dating-first). Create a profile, pick TRAIN, and find people who want to run, lift, or race with you.',
    '',
    'Atlanta: https://gettrainmate.com/atlanta-training-partners?utm_source=instagram&utm_medium=organic&utm_campaign=owned-ig-2026-08-17',
    '',
    'No guaranteed matches. You control your profile.'
  ].join('\n')
};

export function defaultAcquisitionLead(snapshot) {
  const allow = loadStripeAllowlist();
  const board30 = snapshot?.scoreboard?.['30d'] || {};
  const observed = formatCell(board30.unique_paying_customers);
  const existing = allow.reconciliationComplete
    ? observed === 'Unavailable'
      ? '0'
      : observed
    : '0';
  return {
    distributionExecuted: 'none — exact Instagram caption prepared; not posted',
    audienceChannel: PREPARED_OWNED_SOCIAL.channel,
    attributedVisits: '0 (post not live; do not count unattributed landings as this action)',
    activations: '0',
    checkoutStarts: '0',
    newlyAttributedExternalCustomers: '0',
    verifiedRevenue: '$0.00',
    requiredOwnerApproval: `YES — BLOCKING. Reply APPROVED ${PREPARED_OWNED_SOCIAL.approvalId} to authorize posting the exact caption in docs/growth/partners/OWNER-APPROVAL-REQUEST.md to Instagram @gettrainmate. Cursor will not post or send partner email.`,
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

export function defaultDecision({ health, reconciliation, shipped } = {}) {
  const healthOk = health?.ok !== false;
  const reconOk = reconciliation?.ok !== false;
  const shippedLine = shipped
    ? 'Shipped: EXP-003 Atlanta TRAIN user-initiated referral invite (/invite). EXP-002 partner landings/codes unchanged.'
    : 'Shipped: none.';
  return (
    `${shippedLine} ` +
    'Distributed: none this run. Referral share is user-initiated; no confirmed native share by a real user during this run. Instagram caption remains unposted. Partner email not sent. ' +
    'EXP-001: KEEP. Original evaluation date Sunday, August 16, 2026; recorded Monday, August 17, 2026. Treatment unchanged. ' +
    'EXP-002: active and collecting through Thursday, August 27, 2026. Treatment preserved. ' +
    'Qualified Atlanta TRAIN profiles: Unavailable (Metro CRM read token not configured). ' +
    'Existing verified customers: 0. New customers acquired by this run: 0. Verified revenue: $0.00. ' +
    'Primary marketplace-density blocker: no distributed qualified Atlanta TRAIN traffic entering Discover. ' +
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
  const decisionText = ascii(decision || defaultDecision({ health, reconciliation: recon, shipped }));
  const lead = resolveAcquisitionLead({ snapshot, notes, acquisition });
  const dataQualityNeeded = recon && recon.ok === false;
  const qualityLines = dataQualityNeeded ? (recon.warnings || []).map((w) => ascii(w)) : [];
  const stripe = stripeStatusLines(snapshot);
  const metroBlock = formatMetroUnavailable(md);
  const exp002 = exp002Stats(snapshot);
  const exp001 = experiments.find((e) => /EXP-001/i.test(e.idLine));
  const exp002row = experiments.find((e) => /EXP-002/i.test(e.idLine));

  const t = [];
  t.push('GetTrainMate Growth Report');
  t.push('==========================');
  t.push(`Local time: ${et.dateStr} ${et.timeStr} (${TIMEZONE})`);
  t.push(`Site: ${SITE.origin}`);
  t.push('');
  t.push('1) DECISION');
  t.push('-----------');
  t.push(decisionText);
  t.push('');
  t.push(`What shipped: ${shipped ? 'EXP-003 Atlanta TRAIN referral invite' : 'none'}`);
  t.push(`What was actually distributed: ${ascii(lead.distributionExecuted)}`);
  t.push(`Audience/channel: ${ascii(lead.audienceChannel)}`);
  t.push(`Attributed visits: ${ascii(lead.attributedVisits)}`);
  t.push(`Activations: ${ascii(lead.activations)}`);
  t.push(`Checkout starts: ${ascii(lead.checkoutStarts)}`);
  t.push(`Newly attributed external customers: ${ascii(lead.newlyAttributedExternalCustomers)}`);
  t.push(`Verified revenue: ${ascii(lead.verifiedRevenue)}`);
  t.push(`Required owner approval: ${ascii(lead.requiredOwnerApproval)}`);
  t.push(`Qualified Atlanta TRAIN profiles: ${md?.status === 'ok' ? formatCell(md.qualifiedAtlantaTrain) : 'Unavailable'}`);
  t.push('');
  t.push('Customer attribution (do not collapse):');
  t.push(`  Existing customers: ${ascii(lead.existingCustomers)}`);
  t.push(`  Customers observed during experiment window: ${ascii(lead.customersObservedInWindow)}`);
  t.push(`  Customers causally attributed to a specific experiment: ${ascii(lead.customersCausallyAttributedToExperiment)}`);
  t.push(`  New customers acquired by the current run: ${ascii(lead.newCustomersAcquiredByThisRun)}`);
  t.push('');
  if (dataQualityNeeded) {
    t.push('2) DATA QUALITY WARNING');
    t.push('-----------------------');
    t.push('Measurement blocked for flagged metrics. Production health is separate.');
    for (const w of qualityLines) t.push(`- ${w}`);
    t.push('');
  } else {
    t.push('2) DATA QUALITY WARNING');
    t.push('-----------------------');
    t.push('None. Measurement not blocked.');
    t.push('');
  }
  t.push('3) MARKETPLACE ACTION');
  t.push('---------------------');
  t.push('Target segment: Atlanta · TRAIN');
  t.push(`Partner hub: ${SITE.partnersHub}`);
  t.push('No new EXP-002 partner landing or invite code this run.');
  t.push('Shipped independent surface: EXP-003 /invite referral (user-initiated share only).');
  t.push('External partner email distribution: PAUSED (recipient-level approval required).');
  t.push('Prepared drafts are not approved and are not sent.');
  t.push('');
  t.push('4) SCOREBOARD');
  t.push('-------------');
  t.push('Landing sessions (events) | Completed signups (users) | Completed profiles (users)');
  t.push(
    `7d | landings(events)=${formatCell(board7.landings)} | signups(users)=${formatCell(board7.completed_signups)} | profiles(users)=${formatCell(board7.completed_profiles)} | Atlanta TRAIN profiles=Unavailable | Discover users=${formatCell(board7.discover_users)} | connection requests(events)=${formatCell(board7.connections_sent)} | matches(events)=${formatCell(board7.matches_created)} | first messages(events)=${formatCell(board7.first_messages)}`
  );
  t.push(
    `30d | landings(events)=${formatCell(board30.landings)} | signups(users)=${formatCell(board30.completed_signups)} | profiles(users)=${formatCell(board30.completed_profiles)} | Atlanta TRAIN profiles=Unavailable | Discover users=${formatCell(board30.discover_users)} | connection requests(events)=${formatCell(board30.connections_sent)} | matches(events)=${formatCell(board30.matches_created)} | first messages(events)=${formatCell(board30.first_messages)}`
  );
  t.push('');
  t.push('Stripe (GetTrainMate-attributed only; unattributed excluded from revenue):');
  for (const line of stripe.lines) t.push(`  ${line}`);
  if (metroBlock) {
    t.push('');
    t.push(metroBlock);
  }
  t.push('');
  t.push('5) EXPERIMENT RESULTS');
  t.push('---------------------');
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
  t.push('6) ACQUISITION ACTION');
  t.push('---------------------');
  t.push('Atlanta TRAIN referral invitation (user-initiated). Native Web Share where supported; copy-link fallback.');
  t.push('No automatic messages, no contact uploads, no address-book access, no fake acceptances.');
  t.push('Opaque SHA-256 referral code in the URL (not email, not Cognito id, not profile data).');
  t.push('Distributed this run: none until a real user shares or copies a link.');
  t.push('');
  t.push('7) NEXT ACTIONS');
  t.push('---------------');
  t.push('Owner action required:');
  t.push(`1. BLOCKING: Reply APPROVED ${PREPARED_OWNED_SOCIAL.approvalId} then post this exact caption to Instagram @gettrainmate.`);
  t.push('   Exact caption:');
  for (const line of PREPARED_OWNED_SOCIAL.caption.split('\n')) t.push(`   ${line}`);
  t.push('2. Do not invent partner inboxes. Partner email stays paused until a verified public recipient is approved separately.');
  t.push('3. Configure the metro read token.');
  t.push('4. Configure GetTrainMate Stripe Product/Price allowlists.');
  t.push('5. EXP-001 KEEP recorded; do not iterate for CRO. Next scheduled run: Wednesday, August 19, 2026.');
  t.push('');
  t.push('8) PRODUCTION HEALTH');
  t.push('--------------------');
  t.push(`Overall: ${health?.ok ? 'OK' : 'FAILED'}`);
  for (const c of health?.checks || []) {
    t.push(`- ${c.name}: ${c.ok ? 'ok' : 'FAIL'}`);
  }
  t.push('');
  t.push('9) DATA SOURCES');
  t.push('---------------');
  t.push(`GA4: ${snapshot?.sources?.ga4 ?? 'unknown'}`);
  t.push(`Stripe: ${snapshot?.sources?.stripe ?? 'unknown'}`);
  t.push(`Admin CRM / metro: ${md?.status ?? snapshot?.sources?.adminCrm ?? 'unavailable'}`);
  t.push('');
  t.push('10) TECHNICAL DETAILS');
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

  const qualityHtml = dataQualityNeeded
    ? `<h2 style="font-size:15px;margin:18px 0 8px;color:#b45309;">2) Data Quality Warning</h2>
      <div style="padding:12px;border:1px solid #f59e0b;background:#fffbeb;border-radius:8px;font-size:13px;line-height:1.45;">
        <p style="margin:0 0 8px;">Measurement blocked for flagged metrics. Production health is evaluated separately.</p>
        <ul style="margin:0;padding-left:18px;">${qualityLines.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>
      </div>`
    : `<h2 style="font-size:15px;margin:18px 0 8px;">2) Data Quality Warning</h2>
      <p style="margin:0 0 16px;font-size:13px;">None. Measurement not blocked.</p>`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GetTrainMate Growth</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Segoe UI,Arial,sans-serif;color:#111827;">
  <div style="max-width:640px;margin:24px auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
    <div style="padding:18px 20px;background:#0f172a;color:#fff;">
      <div style="font-size:18px;font-weight:700;">GetTrainMate Growth</div>
      <div style="font-size:13px;opacity:0.9;margin-top:4px;">${escapeHtml(et.dateStr)} · ${escapeHtml(et.timeStr)}</div>
    </div>
    <div style="padding:18px 20px;">
      <h2 style="font-size:15px;margin:0 0 8px;">1) Decision</h2>
      <p style="margin:0 0 16px;padding:12px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;font-size:14px;line-height:1.5;">${escapeHtml(decisionText)}</p>
      <p style="margin:0 0 16px;padding:12px;background:#fff7ed;border:1px solid #fdba74;border-radius:8px;font-size:13px;line-height:1.5;">
        What shipped: ${escapeHtml(shipped ? 'EXP-003 Atlanta TRAIN referral invite' : 'none')}<br/>
        What was actually distributed: ${escapeHtml(lead.distributionExecuted)}<br/>
        Audience/channel: ${escapeHtml(lead.audienceChannel)}<br/>
        Attributed visits: ${escapeHtml(lead.attributedVisits)}<br/>
        Activations: ${escapeHtml(lead.activations)}<br/>
        Checkout starts: ${escapeHtml(lead.checkoutStarts)}<br/>
        Newly attributed external customers: ${escapeHtml(lead.newlyAttributedExternalCustomers)}<br/>
        Verified revenue: ${escapeHtml(lead.verifiedRevenue)}<br/>
        Required owner approval: ${escapeHtml(lead.requiredOwnerApproval)}
      </p>
      <p style="margin:0 0 16px;font-size:13px;line-height:1.5;">
        Existing customers: ${escapeHtml(lead.existingCustomers)}<br/>
        Customers observed during experiment window: ${escapeHtml(lead.customersObservedInWindow)}<br/>
        Customers causally attributed to a specific experiment: ${escapeHtml(lead.customersCausallyAttributedToExperiment)}<br/>
        New customers acquired by the current run: ${escapeHtml(lead.newCustomersAcquiredByThisRun)}
      </p>
      ${qualityHtml}
      <h2 style="font-size:15px;margin:18px 0 8px;">3) Marketplace Action</h2>
      <ul style="margin:0 0 16px;padding-left:18px;font-size:13px;line-height:1.5;">
        <li>EXP-003 user-initiated Atlanta TRAIN referral invite shipped (not yet distributed until a real user shares)</li>
        <li>External partner distribution paused pending recipient-level approval</li>
        <li>Prepared drafts are not approved and not sent</li>
      </ul>
      <h2 style="font-size:15px;margin:18px 0 8px;">4) Scoreboard</h2>
      <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">Values are labeled as events, sessions, users, payments, or customers.</p>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.5;">
        30d landing sessions (events): ${escapeHtml(formatCell(board30.landings))}<br/>
        Completed signups (users): ${escapeHtml(formatCell(board30.completed_signups))}<br/>
        Completed profiles (users): ${escapeHtml(formatCell(board30.completed_profiles))}<br/>
        Atlanta TRAIN profiles: Unavailable<br/>
        Discover users: ${escapeHtml(formatCell(board30.discover_users))}<br/>
        Connection requests (events): ${escapeHtml(formatCell(board30.connections_sent))}<br/>
        Matches (events): ${escapeHtml(formatCell(board30.matches_created))}<br/>
        First messages (events): ${escapeHtml(formatCell(board30.first_messages))}
      </p>
      <p style="margin:0 0 16px;font-size:13px;line-height:1.5;">${stripe.lines.map((l) => escapeHtml(l)).join('<br/>')}</p>
      ${metroBlock ? `<pre style="white-space:pre-wrap;font-size:12px;background:#f8fafc;padding:12px;border-radius:8px;">${escapeHtml(metroBlock)}</pre>` : ''}
      <h2 style="font-size:15px;margin:18px 0 8px;">5) Experiment Results</h2>
      <div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;font-size:13px;line-height:1.45;margin-bottom:12px;">
        <div style="font-weight:700;">EXP-001 — Atlanta training-partners landing page</div>
        <div>Original evaluation date: ${escapeHtml(EXP001.evaluationWeekday)} (${escapeHtml(EXP001.evaluationDate)})</div>
        <div>Actual evaluation date: ${escapeHtml(EXP001.actualEvaluationWeekday)} (${escapeHtml(EXP001.actualEvaluationDate)})</div>
        <div>Decision: ${escapeHtml(EXP001.decision)} (treatment unchanged)</div>
        <div>30d landing sessions: ${escapeHtml(String(attr30?.landings?.value ?? 'Unavailable'))}</div>
        <div>Attributed paid conversions: ${escapeHtml(
          attr30?.attributed_paid_conversions?.available
            ? String(attr30.attributed_paid_conversions.value)
            : attr30?.attributed_paid_conversions?.label || 'Unknown'
        )}</div>
      </div>
      <div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;font-size:13px;line-height:1.45;">
        <div style="font-weight:700;">EXP-002 — Atlanta partner hub and invite-code acquisition</div>
        <div>Evaluation: ${escapeHtml(EXP002.evaluationWeekday)}</div>
        <div>Partner pages created: ${escapeHtml(exp002.partnerPagesCreated)}</div>
        <div>Invite codes created: ${escapeHtml(exp002.inviteCodesCreated)}</div>
        <div>Drafts prepared: ${escapeHtml(exp002.draftsPrepared)} (not approved, not sent)</div>
        <div>Recipients explicitly approved: ${escapeHtml(exp002.recipientsApproved)}</div>
        <div>Emails actually sent: ${escapeHtml(exp002.emailsSent)}</div>
        <div>Delivered when known: ${escapeHtml(exp002.delivered)}</div>
        <div>Partner responses: ${escapeHtml(exp002.partnerResponses)}</div>
        <div>Partner-attributed visits: ${escapeHtml(exp002.partnerVisits)}</div>
        <div>Partner-attributed signups: ${escapeHtml(exp002.partnerSignups)}</div>
        <div>Completed profiles: ${escapeHtml(exp002.completedProfiles)}</div>
        <div>Discover users: ${escapeHtml(exp002.discoverUsers)}</div>
        <div>Connection requests: ${escapeHtml(exp002.connectionRequests)}</div>
      </div>
      <div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;font-size:13px;line-height:1.45;margin-top:12px;">
        <div style="font-weight:700;">EXP-003 — Atlanta TRAIN user-initiated referral invite</div>
        <div>Evaluation: ${escapeHtml(EXP003.evaluationWeekday)} (${escapeHtml(EXP003.evaluationDate)})</div>
        <div>Locked surface: /invite plus TRAIN profile and Discover invite CTA. Does not modify EXP-002.</div>
      </div>
      <h2 style="font-size:15px;margin:18px 0 8px;">6) Acquisition Action</h2>
      <p style="margin:0 0 16px;font-size:13px;line-height:1.5;">
        User-initiated Invite a training partner flow. Native share or copy-link. Opaque referral code. No automatic messages or contact uploads. Distributed this run: none until a real user shares.
      </p>
      <h2 style="font-size:15px;margin:18px 0 8px;">7) Next Actions</h2>
      <p style="margin:0 0 8px;font-weight:700;font-size:13px;">Owner action required:</p>
      <ol style="margin:0;padding-left:18px;font-size:13px;line-height:1.5;">
        <li><b>BLOCKING:</b> Reply APPROVED ${escapeHtml(PREPARED_OWNED_SOCIAL.approvalId)} then post this exact caption to Instagram @gettrainmate.</li>
      </ol>
      <pre style="white-space:pre-wrap;font-size:12px;background:#fff7ed;padding:12px;border-radius:8px;border:1px solid #fdba74;">${escapeHtml(PREPARED_OWNED_SOCIAL.caption)}</pre>
      <ol start="2" style="margin:0 0 16px;padding-left:18px;font-size:13px;line-height:1.5;">
        <li>Do not invent partner inboxes. Partner email stays paused until a verified public recipient is approved separately.</li>
        <li>Configure the metro read token.</li>
        <li>Configure GetTrainMate Stripe Product/Price allowlists.</li>
      </ol>
      <h2 style="font-size:15px;margin:18px 0 8px;">8) Production Health</h2>
      <p style="margin:0 0 8px;font-size:13px;"><b>Overall:</b> ${health?.ok ? 'OK' : 'FAILED'}</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;"><tbody>${healthRows}</tbody></table>
      <h2 style="font-size:15px;margin:18px 0 8px;">9) Data Sources</h2>
      <p style="margin:0;font-size:13px;">GA4: ${escapeHtml(snapshot?.sources?.ga4 ?? 'unknown')}<br/>Stripe: ${escapeHtml(snapshot?.sources?.stripe ?? 'unknown')}<br/>Metro / Admin CRM: ${escapeHtml(md?.status ?? 'unavailable')}</p>
      <h2 style="font-size:15px;margin:18px 0 8px;color:#6b7280;">10) Technical Details</h2>
      <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.45;">
        UTC timestamp: ${escapeHtml(generatedUtc)}<br/>
        GA4 data-through date: ${escapeHtml(snapshot?.ga4DataThrough || et.isoDate)}<br/>
        Measurement ID: G-C29M8NWNY4<br/>
        Snapshot ID: ${escapeHtml(snapshot?.snapshotId || 'n/a')}<br/>
        Commit: ${escapeHtml(exp001?.commit || exp002row?.commit || 'n/a')}<br/>
        Amplify deployment: ${escapeHtml(exp001?.amplify || exp002row?.amplify || 'n/a')}<br/>
        Missing configuration: metro ${md?.status === 'ok' ? 'ok' : 'token not configured'}; Stripe allowlist ${stripe.configured ? 'ok' : 'not configured'}<br/>
        Controlled error codes: ${escapeHtml(md?.errorCode || (md?.status === 'ok' ? 'none' : 'metro_token_unconfigured'))}<br/>
        Stripe allowlist status: ${stripe.configured ? 'configured' : 'Incomplete — product allowlist not configured'}
      </p>
    </div>
  </div>
</body>
</html>`;

  return { text, html, et, subjectMeta: { shipped, dataQualityNeeded } };
}
