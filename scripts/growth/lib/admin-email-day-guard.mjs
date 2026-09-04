/**
 * Same-day Admin growth email guard (cross-worktree).
 * Claims `growth/admin-email-sent/{isoDate}.json` in the media bucket with
 * S3 If-None-Match so only the first cloud agent may SES-send that day.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveMediaBucket } from './resolve-media-bucket.mjs';
import { GROWTH_VAR_DIR } from './growth-run-lock.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGION = process.env.AWS_REGION || 'us-east-1';

export function adminEmailSentKey(isoDate) {
  return `growth/admin-email-sent/${String(isoDate).slice(0, 10)}.json`;
}

export function localAdminEmailMarkerPath(isoDate) {
  return path.join(GROWTH_VAR_DIR, `admin-email-sent-${String(isoDate).slice(0, 10)}.json`);
}

function defaultAws(args) {
  return spawnSync('aws', args, { encoding: 'utf8', stdio: 'pipe', maxBuffer: 2 * 1024 * 1024 });
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(String(text || ''));
  } catch {
    return null;
  }
}

export function readAdminEmailDayMarker({
  isoDate,
  bucket = resolveMediaBucket(),
  region = REGION,
  aws = defaultAws
} = {}) {
  const key = adminEmailSentKey(isoDate);
  const localPath = localAdminEmailMarkerPath(isoDate);
  if (fs.existsSync(localPath)) {
    const local = parseJsonSafe(fs.readFileSync(localPath, 'utf8'));
    if (local?.isoDate) return { ok: true, source: 'local', marker: local, key, bucket };
  }

  const outFile = path.join(os.tmpdir(), `gtm-admin-email-marker-${Date.now()}.json`);
  try {
    const r = aws([
      's3api',
      'get-object',
      '--bucket',
      bucket,
      '--key',
      key,
      '--region',
      region,
      outFile
    ]);
    if (r.status !== 0) {
      const err = `${r.stderr || ''}${r.stdout || ''}`;
      if (/NoSuchKey|404|Not Found/i.test(err)) {
        return { ok: true, source: 's3', marker: null, key, bucket };
      }
      return { ok: false, error: err.slice(0, 300), key, bucket };
    }
    const marker = parseJsonSafe(fs.readFileSync(outFile, 'utf8'));
    return { ok: true, source: 's3', marker, key, bucket };
  } finally {
    try {
      fs.unlinkSync(outFile);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Atomically claim today's Admin email slot.
 * @returns {{ claimed: true, claimId, key, bucket } | { claimed: false, marker, key, bucket } | { ok: false, error }}
 */
export function claimAdminEmailDay({
  isoDate,
  claimId = `claim-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  bucket = resolveMediaBucket(),
  region = REGION,
  aws = defaultAws,
  nowIso = new Date().toISOString()
} = {}) {
  const key = adminEmailSentKey(isoDate);
  const body = {
    isoDate: String(isoDate).slice(0, 10),
    status: 'claimed',
    claimId,
    claimedAtUtc: nowIso
  };
  const tmp = path.join(os.tmpdir(), `gtm-admin-email-claim-${Date.now()}.json`);
  fs.writeFileSync(tmp, `${JSON.stringify(body, null, 2)}\n`);
  try {
    const r = aws([
      's3api',
      'put-object',
      '--bucket',
      bucket,
      '--key',
      key,
      '--body',
      tmp,
      '--content-type',
      'application/json',
      '--region',
      region,
      '--if-none-match',
      '*'
    ]);
    if (r.status === 0) {
      fs.mkdirSync(GROWTH_VAR_DIR, { recursive: true });
      fs.writeFileSync(localAdminEmailMarkerPath(isoDate), `${JSON.stringify(body, null, 2)}\n`);
      return { ok: true, claimed: true, claimId, key, bucket, marker: body };
    }
    const err = `${r.stderr || ''}${r.stdout || ''}`;
    if (/PreconditionFailed|412|IfNoneMatch|ConditionalRequestConflict/i.test(err)) {
      const existing = readAdminEmailDayMarker({ isoDate, bucket, region, aws });
      return {
        ok: true,
        claimed: false,
        key,
        bucket,
        marker: existing.marker,
        reason: 'already_sent_or_claimed'
      };
    }
    // Older CLI without If-None-Match: fall back to get-then-put (best effort)
    if (/Unknown options|Unknown parameter|if-none-match/i.test(err)) {
      const existing = readAdminEmailDayMarker({ isoDate, bucket, region, aws });
      if (existing.marker) {
        return {
          ok: true,
          claimed: false,
          key,
          bucket,
          marker: existing.marker,
          reason: 'already_sent_or_claimed'
        };
      }
      const put = aws([
        's3api',
        'put-object',
        '--bucket',
        bucket,
        '--key',
        key,
        '--body',
        tmp,
        '--content-type',
        'application/json',
        '--region',
        region
      ]);
      if (put.status === 0) {
        fs.mkdirSync(GROWTH_VAR_DIR, { recursive: true });
        fs.writeFileSync(localAdminEmailMarkerPath(isoDate), `${JSON.stringify(body, null, 2)}\n`);
        return { ok: true, claimed: true, claimId, key, bucket, marker: body, weakRace: true };
      }
      return { ok: false, error: (put.stderr || put.stdout || 'put failed').slice(0, 300), key, bucket };
    }
    return { ok: false, error: err.slice(0, 300), key, bucket };
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

export function finalizeAdminEmailDay({
  isoDate,
  claimId,
  messageId,
  subject,
  bucket = resolveMediaBucket(),
  region = REGION,
  aws = defaultAws,
  nowIso = new Date().toISOString()
} = {}) {
  const key = adminEmailSentKey(isoDate);
  const body = {
    isoDate: String(isoDate).slice(0, 10),
    status: 'sent',
    claimId,
    messageId: messageId || '',
    subject: subject || '',
    sentAtUtc: nowIso
  };
  const tmp = path.join(os.tmpdir(), `gtm-admin-email-sent-${Date.now()}.json`);
  fs.writeFileSync(tmp, `${JSON.stringify(body, null, 2)}\n`);
  try {
    const r = aws([
      's3api',
      'put-object',
      '--bucket',
      bucket,
      '--key',
      key,
      '--body',
      tmp,
      '--content-type',
      'application/json',
      '--region',
      region
    ]);
    if (r.status !== 0) {
      return { ok: false, error: (r.stderr || r.stdout || 'finalize failed').slice(0, 300) };
    }
    fs.mkdirSync(GROWTH_VAR_DIR, { recursive: true });
    fs.writeFileSync(localAdminEmailMarkerPath(isoDate), `${JSON.stringify(body, null, 2)}\n`);
    return { ok: true, marker: body, key, bucket };
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

export function releaseAdminEmailDayClaim({
  isoDate,
  bucket = resolveMediaBucket(),
  region = REGION,
  aws = defaultAws
} = {}) {
  const key = adminEmailSentKey(isoDate);
  const r = aws(['s3api', 'delete-object', '--bucket', bucket, '--key', key, '--region', region]);
  try {
    fs.unlinkSync(localAdminEmailMarkerPath(isoDate));
  } catch {
    /* ignore */
  }
  return { ok: r.status === 0, key, bucket };
}
