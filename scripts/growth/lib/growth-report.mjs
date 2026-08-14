/**
 * Admin growth-report HTML + text (YouTubeBooster-style section order).
 */
import { SITE, EXP001, EXP002, TIMEZONE } from './metric-definitions.mjs';
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

export function defaultDecision({ health, reconciliation } = {}) {
  const healthOk = health?.ok !== false;
  const reconOk = reconciliation?.ok !== false;
  return (
    'No new marketplace product change was deployed. The existing Atlanta partner hub and invite-code flow were verified in production. ' +
    'EXP-001 and EXP-002 remain active. External partner distribution is paused pending explicit recipient-level approval. ' +
    `Production is ${healthOk ? 'healthy' : 'FAILED'}, and verified external paying customers remain 0.` +
    (reconOk ? '' : ' Data quality warning is in effect.')
  );
}

function stripeStatusLines(snapshot) {
  const allow = loadStripeAllowlist();
  const configured = allow.productIds.size > 0 || allow.priceIds.size > 0 || allow.paymentLinkIds.size > 0;
  const board30 = snapshot?.scoreboard?.['30d'] || {};
  const payments = formatCell(board30.live_payments);
  const customers = formatCell(board30.unique_paying_customers);
  const revenue = formatCell(board30.revenue);
  const unattr = formatCell(board30.unattributed_live_payments);
  if (!configured) {
    return {
      configured: false,
      lines: [
        `Verified attributed payments: ${payments === 'Unavailable' ? '0' : payments}`,
        `Verified external customers: ${customers === 'Unavailable' ? '0' : customers}`,
        `Attributed revenue: ${revenue === 'Unavailable' ? '$0.00' : revenue}`,
        `Unattributed payments: ${unattr}`,
        'Attribution status: Incomplete — product allowlist not configured'
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
  shipped = false
}) {
  const et = formatEt(generatedAt || new Date());
  const generatedUtc = (generatedAt || new Date()).toISOString();
  const noteText = ascii((notes && notes.trim()) || '');
  const board7 = snapshot?.scoreboard?.['7d'] || {};
  const board30 = snapshot?.scoreboard?.['30d'] || {};
  const recon = snapshot?.reconciliation;
  const attr7 = snapshot?.experimentAttribution?.['7d'];
  const attr30 = snapshot?.experimentAttribution?.['30d'];
  const md = snapshot?.marketplaceDensity;
  const decisionText = ascii(decision || defaultDecision({ health, reconciliation: recon, shipped }));
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
  if (dataQualityNeeded) {
    t.push('2) DATA QUALITY WARNING');
    t.push('-----------------------');
    t.push('Measurement blocked for flagged metrics. Production health is separate.');
    for (const w of qualityLines) t.push(`- ${w}`);
    t.push('');
  }
  t.push('3) MARKETPLACE ACTION');
  t.push('---------------------');
  t.push('Target segment: Atlanta · TRAIN');
  t.push(`Partner hub: ${SITE.partnersHub}`);
  t.push('No new marketplace product change this run unless Decision says otherwise.');
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
  t.push(`  Evaluation: ${EXP001.evaluationWeekday} (${EXP001.evaluationDate})`);
  t.push(`  ${EXP001.evaluationNote}`);
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
  t.push('6) NEXT ACTIONS');
  t.push('---------------');
  t.push('Owner action required:');
  t.push('1. Review the replacement partner list.');
  t.push('2. Approve specific recipients and exact messages individually.');
  t.push('3. Do not approve or send another email until UTF-8 rendering is verified.');
  t.push('4. Configure the metro read token.');
  t.push('5. Configure GetTrainMate Stripe Product/Price allowlists.');
  t.push(`6. ${EXP001.evaluationNote}`);
  t.push('');
  t.push('7) PRODUCTION HEALTH');
  t.push('--------------------');
  t.push(`Overall: ${health?.ok ? 'OK' : 'FAILED'}`);
  for (const c of health?.checks || []) {
    t.push(`- ${c.name}: ${c.ok ? 'ok' : 'FAIL'}`);
  }
  t.push('');
  t.push('8) DATA SOURCES');
  t.push('---------------');
  t.push(`GA4: ${snapshot?.sources?.ga4 ?? 'unknown'}`);
  t.push(`Stripe: ${snapshot?.sources?.stripe ?? 'unknown'}`);
  t.push(`Admin CRM / metro: ${md?.status ?? snapshot?.sources?.adminCrm ?? 'unavailable'}`);
  t.push('');
  t.push('9) TECHNICAL DETAILS');
  t.push('--------------------');
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
    : '';

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
      ${qualityHtml}
      <h2 style="font-size:15px;margin:18px 0 8px;">3) Marketplace Action</h2>
      <ul style="margin:0 0 16px;padding-left:18px;font-size:13px;line-height:1.5;">
        <li>Atlanta partner hub and invite-code flow verified in production</li>
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
        <div>Evaluation: ${escapeHtml(EXP001.evaluationWeekday)}</div>
        <div>${escapeHtml(EXP001.evaluationNote)}</div>
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
      <h2 style="font-size:15px;margin:18px 0 8px;">6) Next Actions</h2>
      <p style="margin:0 0 8px;font-weight:700;font-size:13px;">Owner action required:</p>
      <ol style="margin:0;padding-left:18px;font-size:13px;line-height:1.5;">
        <li>Review the replacement partner list.</li>
        <li>Approve specific recipients and exact messages individually.</li>
        <li>Do not approve or send another email until UTF-8 rendering is verified.</li>
        <li>Configure the metro read token.</li>
        <li>Configure GetTrainMate Stripe Product/Price allowlists.</li>
      </ol>
      <h2 style="font-size:15px;margin:18px 0 8px;">7) Production Health</h2>
      <p style="margin:0 0 8px;font-size:13px;"><b>Overall:</b> ${health?.ok ? 'OK' : 'FAILED'}</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;"><tbody>${healthRows}</tbody></table>
      <h2 style="font-size:15px;margin:18px 0 8px;">8) Data Sources</h2>
      <p style="margin:0;font-size:13px;">GA4: ${escapeHtml(snapshot?.sources?.ga4 ?? 'unknown')}<br/>Stripe: ${escapeHtml(snapshot?.sources?.stripe ?? 'unknown')}<br/>Metro / Admin CRM: ${escapeHtml(md?.status ?? 'unavailable')}</p>
      <h2 style="font-size:15px;margin:18px 0 8px;color:#6b7280;">9) Technical Details</h2>
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
