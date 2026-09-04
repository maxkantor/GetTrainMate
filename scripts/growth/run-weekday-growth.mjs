#!/usr/bin/env node
/**
 * Single-command weekday growth run for Cursor Automations.
 * Success = Meta publish attempted + Admin email sent (messageId) + lock released.
 * Creating a PR is NOT this script and is NOT a successful growth run.
 *
 *   node scripts/growth/run-weekday-growth.mjs
 *   node scripts/growth/run-weekday-growth.mjs --dry-run
 *   node scripts/growth/run-weekday-growth.mjs --content-id vibe-en-new-in-town
 *   node scripts/growth/run-weekday-growth.mjs --skip-social   # email only (posts already live)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { easternIsoDate } from './lib/owned-social-catalog.mjs';
import { ensureGrowthDeps } from './lib/ensure-growth-deps.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

function parseArgs(argv) {
  const out = { dryRun: false, skipSocial: false, contentId: null, notes: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--skip-social') out.skipSocial = true;
    else if (a === '--content-id') out.contentId = argv[++i] || null;
    else if (a === '--notes') out.notes = argv[++i] || '';
  }
  return out;
}

function runNode(scriptRel, args = [], { inherit = false } = {}) {
  const script = path.join(__dirname, scriptRel);
  const r = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    cwd: ROOT,
    env: process.env,
    stdio: inherit ? 'inherit' : 'pipe'
  });
  return {
    status: r.status ?? 1,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    signal: r.signal
  };
}

function tryParseJson(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    const start = t.lastIndexOf('{');
    if (start < 0) return null;
    try {
      return JSON.parse(t.slice(start));
    } catch {
      return null;
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const iso = easternIsoDate(new Date());
  const report = {
    ok: false,
    isoDate: iso,
    lockAcquired: false,
    published: false,
    facebookPostId: '',
    instagramPostId: '',
    emailSent: false,
    messageId: '',
    subject: '',
    errors: []
  };

  const lock = runNode('acquire-growth-lock.mjs');
  const lockJson = tryParseJson(lock.stdout) || tryParseJson(lock.stderr);
  if (lock.status !== 0) {
    report.errors.push(lockJson?.message || lock.stderr || lock.stdout || 'lock_failed');
    // Still attempt Admin email about blocker if possible
    const notes = JSON.stringify({
      newCustomersAcquiredByThisRun: '0',
      todaysAcquisitionAction: `Weekday runner stopped: growth lock held. ${report.errors[0]}`,
      distributionExecuted: 'NO',
      requiredOwnerApproval: 'NO'
    });
    runNode('compose-and-send-growth-email.mjs', [
      '--skip-social',
      '--notes',
      notes,
      '--decision',
      `LOCK HELD — weekday runner aborted ${iso}`
    ]);
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }
  report.lockAcquired = true;

  let publishJson = null;
  try {
    const deps = await ensureGrowthDeps();
    if (!deps.ok) {
      report.errors.push(`growth_deps_missing: ${deps.error || 'install failed'}`);
    }

    if (!args.skipSocial) {
      const pubArgs = [];
      if (args.dryRun) pubArgs.push('--dry-run');
      if (args.contentId) pubArgs.push('--content-id', args.contentId);
      const pub = runNode('publish-owned-social.mjs', pubArgs);
      publishJson = tryParseJson(pub.stdout);
      if (pub.status !== 0 && pub.status !== 2) {
        report.errors.push(pub.stderr || pub.stdout || 'publish_failed');
      }
      if (publishJson) {
        report.published = Boolean(publishJson.distributionExecuted);
        report.facebookPostId = publishJson.facebook?.postId || '';
        report.instagramPostId = publishJson.instagram?.postId || '';
        if (publishJson.connectorBlocker) report.errors.push(publishJson.connectorBlocker);
      }
    }

    const notesObj = {
      newCustomersAcquiredByThisRun: '0',
      strategyStatus: 'LOCKED',
      productChangeToday: 'NO',
      todaysAcquisitionAction: args.skipSocial
        ? 'Email-only weekday runner (--skip-social)'
        : report.published
          ? `Owned social published via run-weekday-growth.mjs (${publishJson?.contentId || 'catalog'})`
          : `Owned social attempted; publish incomplete. ${report.errors.join(' · ') || 'see Meta'}`,
      ownedSocialFacebook: report.facebookPostId ? `YES — ${report.facebookPostId}` : 'NO',
      ownedSocialInstagram: report.instagramPostId ? `YES — ${report.instagramPostId}` : 'NO',
      runner: 'run-weekday-growth.mjs'
    };
    if (args.notes) {
      try {
        Object.assign(notesObj, JSON.parse(args.notes));
      } catch {
        notesObj.extraNotes = args.notes;
      }
    }

    const emailArgs = [
      '--skip-social',
      '--notes',
      JSON.stringify(notesObj),
      '--decision',
      `Weekday runner ${iso}: publish=${report.published ? 'YES' : 'NO'} email=required`
    ];
    if (args.dryRun) emailArgs.push('--dry-run');

    // Inject ownedSocial into latest snapshot when we have post IDs
    if (report.facebookPostId || report.instagramPostId) {
      const snapDir = path.join(ROOT, 'docs/growth/snapshots');
      if (fs.existsSync(snapDir)) {
        const files = fs
          .readdirSync(snapDir)
          .filter((f) => /^funnel-\d{4}-\d{2}-\d{2}\.json$/.test(f))
          .sort();
        if (files.length) {
          // compose will collect a fresh snapshot; we pass post ids via notes and
          // also write a sidecar for compose --skip-social honesty.
          const side = path.join(__dirname, 'var', `owned-social-${iso}.json`);
          fs.mkdirSync(path.dirname(side), { recursive: true });
          fs.writeFileSync(
            side,
            JSON.stringify(
              {
                contentId: publishJson?.contentId || '',
                distributionAttempted: true,
                distributionExecuted: report.published,
                technicalDistributionResult: report.published ? 'SUCCEEDED' : 'FAILED',
                connectorHealthy: publishJson?.connectorHealthy !== false,
                connectorBlocker: publishJson?.connectorBlocker || '',
                metaAuth: publishJson?.metaAuth || { authentication: 'VALID', status: 'META_VALID' },
                facebook: publishJson?.facebook || { published: false },
                instagram: publishJson?.instagram || { published: false }
              },
              null,
              2
            )
          );
        }
      }
    }

    // Collect snapshot then attach ownedSocial before email
    const collect = runNode('collect-funnel-snapshot.mjs');
    if (collect.status !== 0) {
      report.errors.push('snapshot_failed');
    }
    const snapDir = path.join(ROOT, 'docs/growth/snapshots');
    const files = fs.existsSync(snapDir)
      ? fs.readdirSync(snapDir).filter((f) => /^funnel-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()
      : [];
    let snapPath = files.length ? path.join(snapDir, files[files.length - 1]) : null;
    if (snapPath && (report.facebookPostId || report.instagramPostId || publishJson)) {
      try {
        const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
        snap.ownedSocial = {
          contentId: publishJson?.contentId || '',
          distributionAttempted: true,
          distributionExecuted: Boolean(report.published || args.skipSocial),
          technicalDistributionResult: report.published ? 'SUCCEEDED' : args.skipSocial ? 'SKIPPED' : 'FAILED',
          connectorHealthy: publishJson?.connectorHealthy !== false,
          connectorBlocker: publishJson?.connectorBlocker || '',
          metaAuth: publishJson?.metaAuth || null,
          facebook: publishJson?.facebook || { published: Boolean(report.facebookPostId), postId: report.facebookPostId },
          instagram: publishJson?.instagram || {
            published: Boolean(report.instagramPostId),
            postId: report.instagramPostId
          }
        };
        fs.writeFileSync(snapPath, JSON.stringify(snap, null, 2));
        emailArgs.push('--snapshot', snapPath);
      } catch (e) {
        report.errors.push(`snapshot_inject: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const email = runNode('compose-and-send-growth-email.mjs', emailArgs);
    const emailJson = tryParseJson(email.stdout);
    if (email.status === 0 && emailJson?.ok && emailJson?.messageId) {
      report.emailSent = true;
      report.messageId = emailJson.messageId;
      report.subject = emailJson.subject || '';
    } else if (args.dryRun && email.status === 0) {
      report.emailSent = true;
      report.subject = 'dry-run';
    } else {
      report.errors.push(email.stderr || email.stdout || 'email_failed');
    }
  } finally {
    runNode('release-growth-lock.mjs');
  }

  report.ok = report.emailSent && (args.skipSocial || report.published || report.errors.some((e) => /META_|Meta |credentials/i.test(e)));
  // Strict: email always required; publish required unless skip-social or Meta config missing was emailed
  if (!args.skipSocial && !report.published && !report.errors.length) {
    report.ok = false;
    report.errors.push('publish_did_not_execute');
  }
  if (!report.emailSent) report.ok = false;

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
