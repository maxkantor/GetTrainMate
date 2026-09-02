/**
 * Purge generated social images older than retention window (S3 + local preview dir).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SOCIAL_IMAGE_BUCKET, DEFAULT_SOCIAL_IMAGE_REGION } from './social-image-storage.mjs';
import { logSocialImageEvent } from './social-image-logger.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_GENERATED_ROOT = path.join(__dirname, '../../../docs/growth/owned-social/generated');

export function parseDateFromSocialKey(key) {
  const m = String(key || '').match(/social\/generated\/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`);
}

export function purgeLocalGeneratedImages({ days = 30, rootDir = LOCAL_GENERATED_ROOT, now = Date.now() } = {}) {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  let deleted = 0;
  let scanned = 0;
  if (!fs.existsSync(rootDir)) {
    return { ok: true, deleted, scanned, rootDir };
  }
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(jpg|jpeg|png)$/i.test(entry.name)) continue;
      scanned += 1;
      const stat = fs.statSync(full);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(full);
        deleted += 1;
      }
    }
  };
  walk(rootDir);
  return { ok: true, deleted, scanned, rootDir };
}

export function purgeS3SocialImages({
  days = 30,
  bucket = DEFAULT_SOCIAL_IMAGE_BUCKET,
  region = DEFAULT_SOCIAL_IMAGE_REGION,
  now = Date.now()
} = {}) {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const list = spawnSync(
    'aws',
    ['s3', 'ls', `s3://${bucket}/social/generated/`, '--recursive', '--region', region],
    { encoding: 'utf8', stdio: 'pipe' }
  );
  if (list.status !== 0) {
    return {
      ok: false,
      deleted: 0,
      scanned: 0,
      error: (list.stderr || list.stdout || 'aws s3 ls failed').slice(0, 300)
    };
  }
  const keys = [];
  for (const line of (list.stdout || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    const key = parts[parts.length - 1];
    if (!key || !key.startsWith('social/generated/')) continue;
    const d = parseDateFromSocialKey(key);
    if (!d || d.getTime() >= cutoff) continue;
    keys.push(key);
  }
  let deleted = 0;
  for (const key of keys) {
    const r = spawnSync(
      'aws',
      ['s3', 'rm', `s3://${bucket}/${key}`, '--region', region],
      { encoding: 'utf8', stdio: 'pipe' }
    );
    if (r.status === 0) deleted += 1;
  }
  return { ok: true, deleted, scanned: keys.length, bucket, region, days };
}

export function purgeOldSocialImages(opts = {}) {
  const local = purgeLocalGeneratedImages(opts);
  const s3 = purgeS3SocialImages(opts);
  logSocialImageEvent('SocialImagePurgeCompleted', {
    days: opts.days ?? 30,
    localDeleted: local.deleted,
    s3Deleted: s3.deleted,
    s3Ok: s3.ok
  });
  return { local, s3 };
}
