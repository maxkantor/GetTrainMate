#!/usr/bin/env node
/**
 * Compose Admin growth-run email from finalized snapshot + health + experiment log.
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
import { SITE } from './lib/metric-definitions.mjs';
import { composeGrowthEmailBody, defaultDecision } from './lib/growth-report.mjs';

export { composeGrowthEmailBody, defaultDecision };

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

function parseArgs(argv) {
  const out = {
    notes: '',
    notesFile: null,
    snapshot: null,
    dryRun: false,
    previewDir: null,
    testEmail: false,
    decision: null,
    shipped: false,
    skipSocial: false
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
    else if (a === '--skip-social') out.skipSocial = true;
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

export function parseActiveExperiments(md) {
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

function runOwnedSocial(dryRun) {
  const r = spawnSync(
    process.execPath,
    [path.join(__dirname, 'publish-owned-social.mjs'), ...(dryRun ? ['--dry-run'] : [])],
    { encoding: 'utf8', cwd: ROOT }
  );
  try {
    return JSON.parse(r.stdout || '{}');
  } catch {
    return {
      connectorHealthy: false,
      connectorBlocker: (r.stderr || r.stdout || 'owned-social stdout was not JSON').slice(0, 400),
      facebook: { published: false },
      instagram: { published: false }
    };
  }
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

function gitSha() {
  const r = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8', cwd: ROOT });
  return (r.stdout || '').trim() || '';
}

function subjectLine({ et, testEmail, subject }) {
  if (testEmail) return `[TEST] ${subject}`;
  return subject;
}

const invokedAsCli =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedAsCli) {
  const args = parseArgs(process.argv.slice(2));
  let notes = args.notes;
  if (args.notesFile) notes = fs.readFileSync(args.notesFile, 'utf8');

  notes = String(notes || '')
    .split('\n')
    .filter((line) => !/aws cli|husky|npm install fails|install script/i.test(line))
    .join('\n')
    .trim();

  const health = runHealth();
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

  if (!args.skipSocial) {
    snapshot.ownedSocial = runOwnedSocial(args.dryRun);
  }

  const logMd = fs.existsSync(LOG_PATH) ? fs.readFileSync(LOG_PATH, 'utf8') : '';
  const experiments = parseActiveExperiments(logMd);
  const now = new Date();
  const { text, html, et, subject: composedSubject } = composeGrowthEmailBody({
    snapshot,
    health,
    experiments,
    notes,
    generatedAt: now,
    decision: args.decision,
    shipped: args.shipped,
    commitSha: gitSha()
  });
  const subject = subjectLine({ et, testEmail: args.testEmail, subject: composedSubject });

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
    const result = await sendAdminGrowthEmail({ subject, body: text, htmlBody: html });
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
