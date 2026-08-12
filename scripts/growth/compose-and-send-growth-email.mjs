#!/usr/bin/env node
/**
 * Compose a full Admin growth-run email from snapshot + health + experiment log, then send via SES.
 *
 * Usage:
 *   node scripts/growth/compose-and-send-growth-email.mjs
 *   node scripts/growth/compose-and-send-growth-email.mjs --notes "No ship; Atlanta density still low."
 *   node scripts/growth/compose-and-send-growth-email.mjs --dry-run
 *
 * REQUIRED after every automation run (including no-op weeks).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadSsmSecretsIntoEnv } from './load-ssm-secrets-into-env.mjs';
import { sendAdminGrowthEmail } from './notify-admin-email.mjs';

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
  const out = { notes: '', notesFile: null, snapshot: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--notes') out.notes = argv[++i] ?? '';
    else if (a === '--notes-file') out.notesFile = argv[++i];
    else if (a === '--snapshot') out.snapshot = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
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

function sumEvents(ga4) {
  const byEvent = {};
  for (const row of ga4?.rows ?? []) {
    const ev = row.dimensionValues?.[0]?.value ?? 'unknown';
    const count = Number(row.metricValues?.[0]?.value ?? 0);
    byEvent[ev] = (byEvent[ev] || 0) + count;
  }
  return byEvent;
}

function topEvents(byEvent, n = 12) {
  return Object.entries(byEvent)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
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
      return fm ? ascii(fm[1].trim()) : '';
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
      amplify: field('Amplify') || field('Deployment status')
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

function funnelKpis(w, funnelSummary) {
  const stages = funnelSummary?.stages ?? {};
  const events = sumEvents(w?.ga4);
  const pick = (name, ...aliases) => {
    let total = stages[name] ?? events[name] ?? 0;
    for (const a of aliases) total += stages[a] ?? events[a] ?? 0;
    return total;
  };
  return {
    landing: pick('landing_page_view', 'page_view'),
    signupStarted: pick('signup_started'),
    signupCompleted: pick('signup_completed', 'sign_up'),
    profileCompleted: pick('profile_completed', 'onboarding_completed'),
    discover: pick('discover_started', 'discover_viewed', 'match_search_clicked'),
    connections: pick('like_or_connection_sent', 'request_sent'),
    matches: pick('match_created', 'match_shown'),
    messages: pick('first_message_sent', 'chat_started'),
    returnVisit: pick('return_visit'),
    pricing: pick('pricing_viewed', 'view_pricing'),
    checkout: pick('checkout_started', 'begin_checkout'),
    purchase: pick('verified_purchase', 'purchase'),
    livePaid: w?.stripe?.livePaidSessions ?? null,
    liveRevenue: Number(w?.stripe?.revenueLiveUsd || 0)
  };
}

function formatMetroBlock(snapshot) {
  const lines = [];
  const md = snapshot?.marketplaceDensity;
  if (md?.assumptionMetro) {
    lines.push(`Assumption metro: ${ascii(md.assumptionMetro)}`);
  }
  if (md?.byMetro && Object.keys(md.byMetro).length) {
    lines.push('GA4 metro signals (aggregated):');
    for (const [metro, count] of Object.entries(md.byMetro).sort((a, b) => b[1] - a[1])) {
      lines.push(`  - ${metro}: ${count}`);
    }
  } else {
    lines.push('Metro data: unavailable in snapshot (wire customEvent:metro or use Admin CRM).');
  }
  return lines;
}

export function composeGrowthEmailBody({ snapshot, health, experiments, notes, generatedAt }) {
  const date = (generatedAt || new Date()).toISOString().slice(0, 10);
  const generated = (generatedAt || new Date()).toISOString();
  const noteText = ascii((notes && notes.trim()) || '(none - measure-only / no-op run)');

  const w7 = snapshot?.windows?.['7d'];
  const w30 = snapshot?.windows?.['30d'];
  const fs7 = snapshot?.funnelSummary?.['7d'];
  const fs30 = snapshot?.funnelSummary?.['30d'];
  const k7 = funnelKpis(w7, fs7);
  const k30 = funnelKpis(w30, fs30);

  const t = [];
  t.push('GetTrainMate - Growth run summary');
  t.push('================================');
  t.push(`Date: ${date}`);
  t.push(`Generated (UTC): ${generated}`);
  t.push('Site: https://gettrainmate.com/');
  t.push('Admin: https://gettrainmate.com/admin');
  t.push('GA4: G-C29M8NWNY4 (single install preserved)');
  t.push('');
  t.push('1) AGENT NOTES');
  t.push('--------------');
  t.push(noteText);
  t.push('');
  t.push('2) PRODUCTION HEALTH');
  t.push('--------------------');
  if (health?.checks?.length) {
    t.push(`Overall: ${health.ok ? 'OK' : 'FAILED'}`);
    for (const c of health.checks) {
      t.push(`- ${c.name}: ${c.ok ? 'ok' : 'FAIL'}`);
    }
  } else {
    t.push('(health check unavailable)');
  }
  t.push('');
  t.push('3) DATA SOURCES');
  t.push('---------------');
  t.push(`GA4: ${snapshot?.sources?.ga4 ?? 'unknown'}`);
  t.push(`Stripe: ${snapshot?.sources?.stripe ?? 'unknown'}`);
  t.push(`Admin CRM: ${snapshot?.sources?.adminCrm ?? 'not_queried'}`);
  if (snapshot?.notes?.length) {
    t.push('Notes:');
    for (const n of snapshot.notes) t.push(`  - ${ascii(n)}`);
  }
  t.push('');
  t.push('4) FUNNEL SCOREBOARD (7d / 30d)');
  t.push('--------------------------------');
  t.push(
    `Landing: ${k7.landing} / ${k30.landing} | Signup start: ${k7.signupStarted} / ${k30.signupStarted} | Signup done: ${k7.signupCompleted} / ${k30.signupCompleted}`
  );
  t.push(
    `Profile done: ${k7.profileCompleted} / ${k30.profileCompleted} | Discover: ${k7.discover} / ${k30.discover} | Connections: ${k7.connections} / ${k30.connections}`
  );
  t.push(
    `Matches: ${k7.matches} / ${k30.matches} | First msg: ${k7.messages} / ${k30.messages} | Return: ${k7.returnVisit} / ${k30.returnVisit}`
  );
  t.push(
    `Pricing: ${k7.pricing} / ${k30.pricing} | Checkout: ${k7.checkout} / ${k30.checkout} | Purchase (GA4): ${k7.purchase} / ${k30.purchase}`
  );
  t.push(
    `Stripe live paid: ${k7.livePaid ?? '?'} / ${k30.livePaid ?? '?'} | Revenue: $${k7.liveRevenue.toFixed(2)} / $${k30.liveRevenue.toFixed(2)}`
  );
  t.push('');
  t.push('5) MARKETPLACE DENSITY');
  t.push('----------------------');
  t.push(...formatMetroBlock(snapshot));
  t.push('');
  t.push('6) ACTIVE EXPERIMENTS');
  t.push('---------------------');
  if (!experiments.length) {
    t.push('(none marked active)');
  } else {
    for (const ex of experiments) {
      t.push(`* ${ex.idLine}`);
      t.push(`  Status: ${ex.status} | Eval: ${ex.evalDate || 'n/a'} | Stage: ${ex.funnelStage || 'n/a'}`);
      if (ex.targetMetro) t.push(`  Metro/segment: ${ex.targetMetro}`);
      t.push(`  Metric: ${ex.primaryMetric || 'n/a'}`);
      if (ex.commit || ex.amplify) {
        t.push(`  Ship: commit ${ex.commit || 'n/a'}; deploy ${ex.amplify || 'n/a'}`);
      }
      t.push('');
    }
  }
  t.push('7) GA4 TOP EVENTS (7d)');
  t.push('----------------------');
  if (!w7?.ga4) {
    t.push('(GA4 rows unavailable)');
  } else {
    for (const [name, count] of topEvents(sumEvents(w7.ga4), 15)) {
      t.push(`  - ${name}: ${count}`);
    }
  }
  t.push('');
  t.push('8) ROLLBACK');
  t.push('-----------');
  t.push('Revert the experiment commit on main and push; Amplify redeploys automatically.');
  t.push('Record failure cause in docs/growth/EXPERIMENT-LOG.md.');
  t.push('');
  t.push('Truth rule: verified Stripe live payments are the revenue source of truth.');
  t.push('Never include credentials, user records, private locations, or message content in this email.');

  const text = t.join('\n');

  const healthRows = (health?.checks || [])
    .map(
      (c) =>
        `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">${escapeHtml(c.name)}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;">${c.ok ? 'OK' : 'FAIL'}</td></tr>`
    )
    .join('');

  const expHtml = experiments.length
    ? experiments
        .map(
          (ex) => `
      <div style="margin:0 0 14px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;">
        <div style="font-weight:700;margin-bottom:6px;">${escapeHtml(ex.idLine)}</div>
        <div style="font-size:13px;line-height:1.45;color:#374151;">
          <div><b>Status:</b> ${escapeHtml(ex.status)} &nbsp;|&nbsp; <b>Eval:</b> ${escapeHtml(ex.evalDate || 'n/a')}</div>
          <div><b>Stage:</b> ${escapeHtml(ex.funnelStage || 'n/a')}</div>
          ${ex.targetMetro ? `<div><b>Metro:</b> ${escapeHtml(ex.targetMetro)}</div>` : ''}
          <div><b>Metric:</b> ${escapeHtml(ex.primaryMetric || 'n/a')}</div>
        </div>
      </div>`
        )
        .join('')
    : '<p style="color:#6b7280;">(none marked active)</p>';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>GetTrainMate Growth run</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Segoe UI,Arial,sans-serif;color:#111827;">
  <div style="max-width:640px;margin:24px auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
    <div style="padding:18px 20px;background:#0f172a;color:#fff;">
      <div style="font-size:18px;font-weight:700;">GetTrainMate - Growth run</div>
      <div style="font-size:13px;opacity:0.85;margin-top:4px;">${escapeHtml(date)} · UTC ${escapeHtml(generated)}</div>
    </div>
    <div style="padding:18px 20px;">
      <p style="margin:0 0 12px;font-size:13px;">
        <a href="https://gettrainmate.com/">Site</a> ·
        <a href="https://gettrainmate.com/admin">Admin</a>
      </p>
      <h2 style="font-size:15px;margin:18px 0 8px;">Agent notes</h2>
      <pre style="margin:0;padding:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;white-space:pre-wrap;font-size:13px;line-height:1.45;">${escapeHtml(noteText)}</pre>
      <h2 style="font-size:15px;margin:18px 0 8px;">Funnel (7d / 30d)</h2>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr><td style="padding:4px 8px;">Signup completed</td><td style="padding:4px 8px;text-align:right;">${k7.signupCompleted} / ${k30.signupCompleted}</td></tr>
        <tr><td style="padding:4px 8px;">Discover</td><td style="padding:4px 8px;text-align:right;">${k7.discover} / ${k30.discover}</td></tr>
        <tr><td style="padding:4px 8px;">Matches</td><td style="padding:4px 8px;text-align:right;">${k7.matches} / ${k30.matches}</td></tr>
        <tr><td style="padding:4px 8px;">Stripe live paid</td><td style="padding:4px 8px;text-align:right;">${k7.livePaid ?? '?'} / ${k30.livePaid ?? '?'} ($${k7.liveRevenue.toFixed(2)} / $${k30.liveRevenue.toFixed(2)})</td></tr>
      </table>
      <h2 style="font-size:15px;margin:18px 0 8px;">Production health</h2>
      <p style="margin:0 0 8px;font-size:13px;"><b>Overall:</b> ${health?.ok ? 'OK' : 'FAILED'}</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;"><tbody>${healthRows}</tbody></table>
      <h2 style="font-size:15px;margin:18px 0 8px;">Active experiments</h2>
      ${expHtml}
    </div>
  </div>
</body>
</html>`;

  return { text, html };
}

const invokedAsCli =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedAsCli) {
  (async () => {
    const args = parseArgs(process.argv.slice(2));
    let notes = args.notes;
    if (args.notesFile) notes = fs.readFileSync(args.notesFile, 'utf8');

    const health = runHealth();
    const collectMeta = ensureSnapshot();
    const snapPath = args.snapshot || latestSnapshotPath();
    let snapshot = null;
    if (snapPath && fs.existsSync(snapPath)) {
      snapshot = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
    } else if (collectMeta?.error) {
      snapshot = { error: collectMeta.error, sources: {}, notes: [collectMeta.error] };
    }

    const logMd = fs.existsSync(LOG_PATH) ? fs.readFileSync(LOG_PATH, 'utf8') : '';
    const experiments = parseActiveExperiments(logMd);
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const timeEt = now.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const { text, html } = composeGrowthEmailBody({
      snapshot,
      health,
      experiments,
      notes,
      generatedAt: now
    });
    const subject = `[GetTrainMate] Growth run ${date} ${timeEt} ET`;

    if (args.dryRun) {
      console.log(subject);
      console.log('--- TEXT ---');
      console.log(text);
      process.exit(0);
    }

    try {
      const result = await sendAdminGrowthEmail({ subject, body: text, htmlBody: html });
      console.log(
        JSON.stringify(
          {
            ok: true,
            messageId: result.messageId,
            subject: result.subjectSent ?? subject,
            snapshotPath: snapPath,
            activeExperiments: experiments.map((e) => e.idLine)
          },
          null,
          2
        )
      );
    } catch (e) {
      console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
      process.exit(1);
    }
  })();
}
