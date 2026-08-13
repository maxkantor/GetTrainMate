#!/usr/bin/env node
/**
 * Compose Admin growth-run email from finalized snapshot + health + experiment log.
 * Decision-first. America/New_York times. Canonical metrics only.
 *
 * Usage:
 *   node scripts/growth/compose-and-send-growth-email.mjs --notes "..."
 *   node scripts/growth/compose-and-send-growth-email.mjs --dry-run
 *   node scripts/growth/compose-and-send-growth-email.mjs --preview-dir docs/growth/previews
 *   node scripts/growth/compose-and-send-growth-email.mjs --test-email
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadSsmSecretsIntoEnv } from './load-ssm-secrets-into-env.mjs';
import { sendAdminGrowthEmail } from './notify-admin-email.mjs';
import { SITE, EXP001, TIMEZONE } from './lib/metric-definitions.mjs';
import { formatCell } from './lib/normalize-metrics.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const SNAP_DIR = path.join(ROOT, 'docs/growth/snapshots');
const LOG_PATH = path.join(ROOT, 'docs/growth/EXPERIMENT-LOG.md');

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

function parseArgs(argv) {
  const out = {
    notes: '',
    notesFile: null,
    snapshot: null,
    dryRun: false,
    previewDir: null,
    testEmail: false,
    decision: null,
    shipped: false
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--notes') out.notes = argv[++i] ?? '';
    else if (a === '--notes-file') out.notesFile = argv[++i];
    else if (a === '--snapshot') out.snapshot = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--preview-dir') out.previewDir = argv[++i];
    else if (a === '--test-email') out.testEmail = true;
    else if (a === '--decision') out.decision = argv[++i] ?? '';
    else if (a === '--shipped') out.shipped = true;
  }
  return out;
}

function latestSnapshotPath() {
  if (!fs.existsSync(SNAP_DIR)) return null;
  const files = fs
    .readdirSync(SNAP_DIR)
    .filter((f) => /^funnel-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  if (!files.length) return null;
  return path.join(SNAP_DIR, files[files.length - 1]);
}

function parseActiveExperiments(md) {
  const active = [];
  const re =
    /###\s+(\d{4}-\d{2}-\d{2})\s+[-\u2013\u2014]\s+(EXP-\d+[^\n]*)([\s\S]*?)(?=\n###\s+\d{4}-\d{2}-\d{2}|\n##\s+Completed|$)/g;
  let m;
  while ((m = re.exec(md))) {
    const block = m[0];
    if (!/\|\s*Status\s*\|\s*active\s*\|/i.test(block)) continue;
    const field = (name) => {
      const fm = block.match(new RegExp(`\\|\\s*${name}\\s*\\|\\s*([^|]+)\\s*\\|`, 'i'));
      return fm ? ascii(fm[1].trim()).replace(/^`+|`+$/g, '') : '';
    };
    active.push({
      idLine: ascii(`${m[1]} - ${m[2].trim()}`),
      status: field('Status'),
      funnelStage: field('Funnel stage'),
      targetMetro: field('Target metro and segment'),
      evalDate: field('Evaluation date'),
      primaryMetric: field('Primary metric'),
      hypothesis: field('Customer hypothesis') || field('Hypothesis'),
      commit: field('Commit'),
      amplify: field('Deployment status') || field('Amplify'),
      requiredSample: field('Required sample or duration')
    });
  }
  return active;
}

function runHealth() {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'check-production-health.mjs')], {
    encoding: 'utf8',
    cwd: ROOT
  });
  try {
    return JSON.parse(r.stdout || '{}');
  } catch {
    return { ok: false, checks: [], parseError: true, exit: r.status };
  }
}

function ensureSnapshot() {
  loadSsmSecretsIntoEnv();
  const r = spawnSync(process.execPath, [path.join(__dirname, 'collect-funnel-snapshot.mjs')], {
    encoding: 'utf8',
    cwd: ROOT
  });
  if (r.status !== 0) {
    return { error: (r.stderr || r.stdout || '').slice(0, 500) };
  }
  try {
    return JSON.parse(r.stdout || '{}');
  } catch {
    return { error: 'snapshot stdout not JSON' };
  }
}

function formatEt(date = new Date()) {
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

function defaultDecision({ experiments, health, reconciliation, shipped }) {
  const exp001 = experiments.find((e) => /EXP-001/i.test(e.idLine));
  const evalDate = exp001?.evalDate || EXP001.evaluationDate;
  const reconOk = reconciliation?.ok !== false;
  const healthOk = health?.ok !== false;
  if (shipped) {
    return `A change was deployed this run. See Active Experiment for details. Production health: ${healthOk ? 'OK' : 'FAILED'}. Data quality: ${reconOk ? 'OK' : 'WARNING'}.`;
  }
  return (
    `No new change was deployed. EXP-001 has been active for only a short period and does not yet have enough attributable Atlanta traffic for evaluation. ` +
    `Production is ${healthOk ? 'healthy' : 'degraded'} and data connections are ${reconOk ? 'usable' : 'flagged'}. ` +
    `The primary constraint remains qualified Atlanta acquisition. Next evaluation: ${evalDate}.`
  );
}

function subjectLine({ et, shipped, experiments, testEmail }) {
  const exp001 = experiments.find((e) => /EXP-001/i.test(e.idLine));
  const status = shipped
    ? 'Change deployed'
    : exp001
      ? 'No change deployed · EXP-001 collecting data'
      : 'No change deployed';
  const base = `GetTrainMate Growth — ${status} · ${et.dateStr}`;
  return testEmail ? `[TEST] GetTrainMate Growth Report — ${et.dateStr}` : base;
}

function scoreboardValue(cell) {
  return formatCell(cell);
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
  const decisionText = ascii(
    decision ||
      defaultDecision({
        experiments,
        health,
        reconciliation: recon,
        shipped
      })
  );

  const dataQualityNeeded = recon && recon.ok === false;
  const qualityLines = dataQualityNeeded
    ? (recon.warnings || []).map((w) => ascii(w))
    : [];

  // ---- plain text ----
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
  const n = dataQualityNeeded ? 3 : 2;
  t.push(`${n}) SCOREBOARD`);
  t.push('-------------');
  t.push('(Values are events, users, attributed payments, or external customers as labeled.)');
  t.push(
    `Window | Landings(events) | Signups | Profiles | Discover | Attributed payments | Unattributed | External customers | Attributed revenue`
  );
  t.push(
    `7d | ${scoreboardValue(board7.landings)} | ${scoreboardValue(board7.completed_signups)} | ${scoreboardValue(board7.completed_profiles)} | ${scoreboardValue(board7.discover_users)} | ${scoreboardValue(board7.live_payments)} | ${scoreboardValue(board7.unattributed_live_payments)} | ${scoreboardValue(board7.unique_paying_customers)} | ${scoreboardValue(board7.revenue)}`
  );
  t.push(
    `30d | ${scoreboardValue(board30.landings)} | ${scoreboardValue(board30.completed_signups)} | ${scoreboardValue(board30.completed_profiles)} | ${scoreboardValue(board30.discover_users)} | ${scoreboardValue(board30.live_payments)} | ${scoreboardValue(board30.unattributed_live_payments)} | ${scoreboardValue(board30.unique_paying_customers)} | ${scoreboardValue(board30.revenue)}`
  );
  t.push(
    'Note: Unattributed Stripe payments are excluded from GetTrainMate revenue (shared Stripe account). External customers use verified baseline until reconciliation completes.'
  );
  t.push('');
  t.push(`${n + 1}) ACTIVE EXPERIMENT`);
  t.push('--------------------');
  if (!experiments.length) {
    t.push('(none marked active)');
  } else {
    for (const ex of experiments) {
      t.push(`* ${ex.idLine}`);
      t.push(`  Status: ${ex.status} | Eval: ${ex.evalDate || 'n/a'} | Stage: ${ex.funnelStage || 'n/a'}`);
      if (ex.targetMetro) t.push(`  Metro/segment: ${ex.targetMetro}`);
      t.push(`  Metric: ${ex.primaryMetric || 'n/a'}`);
      if (ex.commit) t.push(`  Commit: ${SITE.repo}/commit/${ex.commit}`);
      if (ex.amplify) t.push(`  Deployment: ${ascii(ex.amplify)}`);
    }
  }
  if (attr7 || attr30) {
    t.push('');
    t.push('EXP-001 attribution (Atlanta landing only):');
    const a = attr30 || attr7;
    t.push(`  Path: ${a.path}`);
    t.push(`  30d landings: ${a.landings?.value ?? 'Unavailable'}`);
    t.push(`  30d signup starts on path: ${a.signup_starts?.value ?? 'Unavailable'}`);
    t.push(`  30d completed signups on path: ${a.completed_signups?.value ?? 'Unavailable'}`);
    t.push(
      `  Landing->signup start: ${a.landing_to_signup_start == null ? 'Unavailable' : a.landing_to_signup_start}`
    );
    t.push(
      `  Landing->completed signup: ${a.landing_to_completed_signup == null ? 'Unavailable' : a.landing_to_completed_signup}`
    );
    t.push(
      `  Attributed paid conversions: ${
        a.attributed_paid_conversions?.available
          ? a.attributed_paid_conversions.value
          : a.attributed_paid_conversions?.label || 'Unknown'
      }`
    );
    if (a.attributed_paid_conversions?.reason) {
      t.push(`  Attribution note: ${ascii(a.attributed_paid_conversions.reason)}`);
    }
    t.push(`  Evaluation date: ${a.evaluationDate}`);
  }
  if (md?.status === 'ok' && Array.isArray(md.byMetro) && md.byMetro.length) {
    t.push('');
    t.push('Marketplace density (aggregated CRM, min cohort applied):');
    for (const row of md.byMetro.slice(0, 8)) {
      t.push(
        `  ${row.metro}: profiles=${row.profiles}, completed=${row.completedProfiles}, connections=${row.connectionsSent}, matches=${row.matchesCreated}, discover=Unavailable, returning=Unavailable`
      );
    }
    if (md.suppressedMetroCount) t.push(`  Suppressed small metros: ${md.suppressedMetroCount}`);
  } else if (md?.reason) {
    t.push('');
    t.push(`Marketplace density: Unavailable — ${ascii(md.reason)}`);
  }
  t.push('');
  t.push(`${n + 2}) NEXT ACTION`);
  t.push('---------------');
  t.push('1. Keep canonical metric normalization as source of truth for all growth emails.');
  t.push(
    md?.status === 'ok'
      ? '2. Use metro aggregates to prioritize Atlanta density; suppress small cohorts.'
      : '2. Configure GROWTH_METRO_READ_TOKEN (or GROWTH_CRM_ADMIN_*) for metro CRM read — do not expand SES IAM to DynamoDB.'
  );
  t.push(`3. Continue EXP-001 until evaluation date ${EXP001.evaluationDate}.`);
  t.push('4. Do not launch a conflicting acquisition experiment on the same funnel stage.');
  t.push('Responsible: GetTrainMate Wednesday Customer Growth automation.');
  t.push('');
  t.push(`${n + 3}) PRODUCTION HEALTH`);
  t.push('----------------------');
  t.push(`Overall: ${health?.ok ? 'OK' : 'FAILED'}`);
  for (const c of health?.checks || []) {
    t.push(`- ${c.name}: ${c.ok ? 'ok' : 'FAIL'}`);
  }
  t.push('');
  t.push(`${n + 4}) DATA SOURCES`);
  t.push('----------------');
  t.push(`GA4: ${snapshot?.sources?.ga4 ?? 'unknown'}`);
  t.push(`Stripe: ${snapshot?.sources?.stripe ?? 'unknown'}`);
  t.push(`Admin CRM / metro: ${md?.status ?? snapshot?.sources?.adminCrm ?? 'unavailable'}`);
  if (md?.reason) t.push(`Metro reason: ${ascii(md.reason)}`);
  t.push('');
  t.push(`${n + 5}) TECHNICAL DETAILS`);
  t.push('---------------------');
  t.push(`Generated UTC: ${generatedUtc}`);
  t.push(`GA4 measurement: G-C29M8NWNY4`);
  t.push(`Experiment log: ${SITE.repo}/blob/main/${SITE.experimentLogPath}`);
  t.push(`Atlanta landing: ${SITE.atlanta}`);
  if (noteText) {
    t.push('Agent notes (sanitized):');
    t.push(noteText);
  }
  t.push('');
  t.push('Truth rule: Only GetTrainMate-attributed Stripe payments count as revenue. Unattributed Stripe payments are excluded. Payments != unique external customers. Verified external customers baseline is 0 until reconciliation completes.');
  t.push('Never include credentials, user records, private locations, or message content.');

  const text = t.join('\n');

  // ---- HTML ----
  const healthRows = (health?.checks || [])
    .map(
      (c) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(c.name)}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${c.ok ? 'OK' : 'FAIL'}</td></tr>`
    )
    .join('');

  const exp001 = experiments.find((e) => /EXP-001/i.test(e.idLine)) || experiments[0];
  const commitUrl = exp001?.commit ? `${SITE.repo}/commit/${exp001.commit}` : null;

  const qualityHtml = dataQualityNeeded
    ? `<h2 style="font-size:15px;margin:18px 0 8px;color:#b45309;">2) Data Quality Warning</h2>
      <div style="padding:12px;border:1px solid #f59e0b;background:#fffbeb;border-radius:8px;font-size:13px;line-height:1.45;">
        <p style="margin:0 0 8px;">Measurement blocked for flagged metrics. Production health is evaluated separately.</p>
        <ul style="margin:0;padding-left:18px;">${qualityLines.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>
      </div>`
    : '';

  const sectionOffset = dataQualityNeeded ? 1 : 0;

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
      <p style="margin:0 0 14px;font-size:13px;line-height:1.5;">
        <a href="${SITE.origin}">Homepage</a> ·
        <a href="${SITE.admin}">Admin</a> ·
        <a href="${SITE.atlanta}">Atlanta landing</a>
        ${commitUrl ? ` · <a href="${commitUrl}">Commit</a>` : ''}
        · <a href="${SITE.repo}/blob/main/${SITE.experimentLogPath}">Experiment log</a>
      </p>

      <h2 style="font-size:15px;margin:0 0 8px;">1) Decision</h2>
      <p style="margin:0 0 16px;padding:12px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;font-size:14px;line-height:1.5;">${escapeHtml(decisionText)}</p>

      ${qualityHtml}

      <h2 style="font-size:15px;margin:18px 0 8px;">${2 + sectionOffset}) Scoreboard</h2>
      <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">Attributed Stripe only. Unattributed payments (shared account / unknown product) are not GetTrainMate revenue. External customers use verified baseline (0) until reconciliation completes.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th align="left" style="padding:6px 3px;">Window</th>
            <th align="right" style="padding:6px 3px;">Landings</th>
            <th align="right" style="padding:6px 3px;">Signups</th>
            <th align="right" style="padding:6px 3px;">Profiles</th>
            <th align="right" style="padding:6px 3px;">Discover</th>
            <th align="right" style="padding:6px 3px;">Attr. pay</th>
            <th align="right" style="padding:6px 3px;">Unattrib.</th>
            <th align="right" style="padding:6px 3px;">Ext. cust.</th>
            <th align="right" style="padding:6px 3px;">Attr. rev</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:6px 3px;border-bottom:1px solid #e5e7eb;">7d</td>
            <td style="padding:6px 3px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(scoreboardValue(board7.landings))}</td>
            <td style="padding:6px 3px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(scoreboardValue(board7.completed_signups))}</td>
            <td style="padding:6px 3px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(scoreboardValue(board7.completed_profiles))}</td>
            <td style="padding:6px 3px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(scoreboardValue(board7.discover_users))}</td>
            <td style="padding:6px 3px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(scoreboardValue(board7.live_payments))}</td>
            <td style="padding:6px 3px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(scoreboardValue(board7.unattributed_live_payments))}</td>
            <td style="padding:6px 3px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(scoreboardValue(board7.unique_paying_customers))}</td>
            <td style="padding:6px 3px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(scoreboardValue(board7.revenue))}</td>
          </tr>
          <tr>
            <td style="padding:6px 3px;">30d</td>
            <td style="padding:6px 3px;text-align:right;">${escapeHtml(scoreboardValue(board30.landings))}</td>
            <td style="padding:6px 3px;text-align:right;">${escapeHtml(scoreboardValue(board30.completed_signups))}</td>
            <td style="padding:6px 3px;text-align:right;">${escapeHtml(scoreboardValue(board30.completed_profiles))}</td>
            <td style="padding:6px 3px;text-align:right;">${escapeHtml(scoreboardValue(board30.discover_users))}</td>
            <td style="padding:6px 3px;text-align:right;">${escapeHtml(scoreboardValue(board30.live_payments))}</td>
            <td style="padding:6px 3px;text-align:right;">${escapeHtml(scoreboardValue(board30.unattributed_live_payments))}</td>
            <td style="padding:6px 3px;text-align:right;">${escapeHtml(scoreboardValue(board30.unique_paying_customers))}</td>
            <td style="padding:6px 3px;text-align:right;">${escapeHtml(scoreboardValue(board30.revenue))}</td>
          </tr>
        </tbody>
      </table>
      <p style="margin:8px 0 0;font-size:11px;color:#6b7280;">Unattributed Stripe payment counts are informational only — never GetTrainMate customers or revenue. See docs/growth/STRIPE-ATTRIBUTION.md.</p>

      <h2 style="font-size:15px;margin:18px 0 8px;">${3 + sectionOffset}) Active Experiment</h2>
      ${
        exp001
          ? `<div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;font-size:13px;line-height:1.45;">
        <div style="font-weight:700;margin-bottom:6px;">${escapeHtml(exp001.idLine)}</div>
        <div><b>Status:</b> ${escapeHtml(exp001.status)} · <b>Eval:</b> ${escapeHtml(exp001.evalDate || EXP001.evaluationDate)}</div>
        <div><b>Stage:</b> ${escapeHtml(exp001.funnelStage || 'n/a')}</div>
        <div><b>Metro:</b> ${escapeHtml(exp001.targetMetro || 'Atlanta, Georgia · TRAIN')}</div>
        <div style="margin-top:8px;"><b>EXP-001 30d attributable landings:</b> ${escapeHtml(String(attr30?.landings?.value ?? 'Unavailable'))}</div>
        <div><b>Signup starts (path):</b> ${escapeHtml(String(attr30?.signup_starts?.value ?? 'Unavailable'))}</div>
        <div><b>Completed signups (path):</b> ${escapeHtml(String(attr30?.completed_signups?.value ?? 'Unavailable'))}</div>
        <div><b>Attributed paid conversions:</b> ${escapeHtml(
          attr30?.attributed_paid_conversions?.available
            ? String(attr30.attributed_paid_conversions.value)
            : attr30?.attributed_paid_conversions?.label || 'Unknown'
        )}</div>
        ${
          attr30?.attributed_paid_conversions?.reason
            ? `<div style="color:#6b7280;font-size:12px;">${escapeHtml(attr30.attributed_paid_conversions.reason)}</div>`
            : ''
        }
        ${commitUrl ? `<div style="margin-top:8px;"><a href="${commitUrl}">Commit ${escapeHtml(exp001.commit)}</a></div>` : ''}
        ${exp001.amplify ? `<div><b>Deployment:</b> ${escapeHtml(exp001.amplify)}</div>` : ''}
      </div>`
          : '<p style="color:#6b7280;">(none marked active)</p>'
      }

      ${
        md?.status === 'ok' && Array.isArray(md.byMetro) && md.byMetro.length
          ? `<h2 style="font-size:15px;margin:18px 0 8px;">Marketplace density (CRM aggregate)</h2>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#f8fafc;text-align:left;">
          <th style="padding:6px 4px;border-bottom:1px solid #e5e7eb;">Metro</th>
          <th style="padding:6px 4px;border-bottom:1px solid #e5e7eb;text-align:right;">Profiles</th>
          <th style="padding:6px 4px;border-bottom:1px solid #e5e7eb;text-align:right;">Completed</th>
          <th style="padding:6px 4px;border-bottom:1px solid #e5e7eb;text-align:right;">Connections</th>
          <th style="padding:6px 4px;border-bottom:1px solid #e5e7eb;text-align:right;">Matches</th>
        </tr></thead>
        <tbody>
          ${md.byMetro
            .slice(0, 8)
            .map(
              (row) => `<tr>
            <td style="padding:6px 4px;border-bottom:1px solid #e5e7eb;">${escapeHtml(row.metro)}</td>
            <td style="padding:6px 4px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(String(row.profiles))}</td>
            <td style="padding:6px 4px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(String(row.completedProfiles))}</td>
            <td style="padding:6px 4px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(String(row.connectionsSent))}</td>
            <td style="padding:6px 4px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(String(row.matchesCreated))}</td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>
      <p style="margin:6px 0 0;font-size:11px;color:#6b7280;">Discover/returning by metro: Unavailable. Small cohorts suppressed (min ${escapeHtml(String(md.minCohort ?? 3))}).</p>`
          : md?.reason
            ? `<p style="margin:12px 0 0;font-size:12px;color:#6b7280;">Marketplace density: Unavailable — ${escapeHtml(md.reason)}</p>`
            : ''
      }

      <h2 style="font-size:15px;margin:18px 0 8px;">${4 + sectionOffset}) Next Action</h2>
      <ol style="margin:0;padding-left:18px;font-size:13px;line-height:1.5;">
        <li>Keep canonical metric normalization as the only scoreboard source.</li>
        <li>${
          md?.status === 'ok'
            ? 'Use metro aggregates to prioritize Atlanta density; keep small cohorts suppressed.'
            : 'Configure GROWTH_METRO_READ_TOKEN (or GROWTH_CRM_ADMIN_*) for metro CRM read — do not expand SES IAM to DynamoDB.'
        }</li>
        <li>Continue EXP-001 until <b>${escapeHtml(EXP001.evaluationDate)}</b>.</li>
        <li>Do not launch a conflicting acquisition experiment.</li>
      </ol>
      <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">Responsible: GetTrainMate Wednesday Customer Growth automation.</p>

      <h2 style="font-size:15px;margin:18px 0 8px;">${5 + sectionOffset}) Production Health</h2>
      <p style="margin:0 0 8px;font-size:13px;"><b>Overall:</b> ${health?.ok ? 'OK' : 'FAILED'}</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;"><tbody>${healthRows}</tbody></table>

      <h2 style="font-size:15px;margin:18px 0 8px;">${6 + sectionOffset}) Data Sources</h2>
      <p style="margin:0;font-size:13px;line-height:1.5;">
        GA4: ${escapeHtml(snapshot?.sources?.ga4 ?? 'unknown')}<br/>
        Stripe: ${escapeHtml(snapshot?.sources?.stripe ?? 'unknown')}<br/>
        Metro / Admin CRM: ${escapeHtml(md?.status ?? 'unavailable')}
      </p>

      <h2 style="font-size:15px;margin:18px 0 8px;color:#6b7280;">${7 + sectionOffset}) Technical Details</h2>
      <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.45;">
        Generated UTC: ${escapeHtml(generatedUtc)}<br/>
        Measurement ID: G-C29M8NWNY4 (single install)<br/>
        Focus metro assumption: Atlanta, Georgia<br/>
        ${noteText ? `Notes: ${escapeHtml(noteText)}` : ''}
      </p>
      <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;">
        Truth rule: Only GetTrainMate-attributed Stripe payments count as revenue. Unattributed Stripe payments are excluded. Never confuse attributed payments with unique external customers (baseline 0 until reconciliation).
      </p>
    </div>
  </div>
</body>
</html>`;

  return { text, html, et, subjectMeta: { shipped, dataQualityNeeded } };
}

const invokedAsCli =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedAsCli) {
  const args = parseArgs(process.argv.slice(2));
  let notes = args.notes;
  if (args.notesFile) notes = fs.readFileSync(args.notesFile, 'utf8');

  // Strip internal setup noise from notes for business report.
  notes = String(notes || '')
    .split('\n')
    .filter((line) => !/aws cli|husky|npm install fails|install script/i.test(line))
    .join('\n')
    .trim();

  const health = args.snapshot ? { ok: true, checks: [] } : runHealth();
  let snapshot = null;
  let snapPath = args.snapshot;
  if (!snapPath) {
    ensureSnapshot();
    snapPath = latestSnapshotPath();
  }
  if (snapPath && fs.existsSync(snapPath)) {
    snapshot = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
  } else {
    snapshot = { error: 'missing snapshot', sources: {}, scoreboard: {}, notes: [] };
  }

  const logMd = fs.existsSync(LOG_PATH) ? fs.readFileSync(LOG_PATH, 'utf8') : '';
  const experiments = parseActiveExperiments(logMd);
  const now = new Date();
  const { text, html, et } = composeGrowthEmailBody({
    snapshot,
    health,
    experiments,
    notes,
    generatedAt: now,
    decision: args.decision,
    shipped: args.shipped
  });
  const subject = subjectLine({
    et,
    shipped: args.shipped,
    experiments,
    testEmail: args.testEmail
  });

  if (args.previewDir) {
    fs.mkdirSync(args.previewDir, { recursive: true });
    const base = path.join(args.previewDir, `growth-report-${et.isoDate}`);
    fs.writeFileSync(`${base}.txt`, text, 'utf8');
    fs.writeFileSync(`${base}.html`, html, 'utf8');
    console.log(JSON.stringify({ wrote: [`${base}.txt`, `${base}.html`], subject }, null, 2));
  }

  if (args.dryRun && !args.testEmail) {
    console.log(subject);
    console.log('--- TEXT ---');
    console.log(text);
    process.exit(0);
  }

  if (args.dryRun && args.testEmail) {
    console.log(JSON.stringify({ ok: true, dryRun: true, subject }, null, 2));
    process.exit(0);
  }

  try {
    const result = sendAdminGrowthEmail({ subject, body: text, htmlBody: html });
    console.log(
      JSON.stringify(
        {
          ok: true,
          messageId: result.messageId,
          subject,
          snapshotPath: snapPath,
          activeExperiments: experiments.map((e) => e.idLine),
          reconciliationOk: snapshot?.reconciliation?.ok ?? null
        },
        null,
        2
      )
    );
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
    process.exit(1);
  }
}
