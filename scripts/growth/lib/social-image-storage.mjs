/**
 * Upload generated social images to S3 (uses AWS CLI like other growth scripts).
 * social/generated/* must be publicly readable so Meta can fetch image_url.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { logSocialImageEvent } from './social-image-logger.mjs';
import { resolveMediaBucket } from './resolve-media-bucket.mjs';
import { validatePublicImageUrl } from './meta-graph.mjs';

export const DEFAULT_SOCIAL_IMAGE_BUCKET = resolveMediaBucket();

export const DEFAULT_SOCIAL_IMAGE_REGION = process.env.AWS_REGION || 'us-east-1';

export function buildSocialImageKey({ isoHyphen, uniqueId }) {
  const [y, m, d] = String(isoHyphen || '').split('-');
  const safeId = String(uniqueId || 'image').replace(/[^a-zA-Z0-9_-]/g, '-');
  return `social/generated/${y}/${m}/${d}/${safeId}.jpg`;
}

export function publicUrlForKey(key, { bucket = DEFAULT_SOCIAL_IMAGE_BUCKET, region = DEFAULT_SOCIAL_IMAGE_REGION } = {}) {
  const encoded = String(key)
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `https://${bucket}.s3.${region}.amazonaws.com/${encoded}`;
}

export function uploadSocialImageBuffer({
  buffer,
  localPath,
  key,
  bucket = resolveMediaBucket(),
  region = DEFAULT_SOCIAL_IMAGE_REGION
}) {
  let tempPath = localPath;
  let createdTemp = false;
  if (!tempPath) {
    tempPath = path.join(process.cwd(), `.social-image-${Date.now()}.jpg`);
    fs.writeFileSync(tempPath, buffer);
    createdTemp = true;
  }
  try {
    const baseArgs = [
      's3',
      'cp',
      tempPath,
      `s3://${bucket}/${key}`,
      '--content-type',
      'image/jpeg',
      '--cache-control',
      'public, max-age=31536000, immutable',
      '--region',
      region
    ];
    const r = spawnSync('aws', baseArgs, { encoding: 'utf8', stdio: 'pipe' });
    if (r.status !== 0) {
      return {
        ok: false,
        error: (r.stderr || r.stdout || 'aws s3 cp failed').slice(0, 400)
      };
    }
    const url = publicUrlForKey(key, { bucket, region });
    logSocialImageEvent('SocialImageUploaded', {
      key,
      bucket,
      region,
      bytes: buffer?.length || fs.statSync(tempPath).size
    });
    return { ok: true, key, bucket, region, url };
  } finally {
    if (createdTemp && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
}

export async function uploadAndVerifySocialImageBuffer(opts) {
  const uploaded = uploadSocialImageBuffer(opts);
  if (!uploaded.ok) return uploaded;
  const check = await validatePublicImageUrl(uploaded.url);
  if (!check.ok) {
    return {
      ok: false,
      error: `s3_not_publicly_readable:${check.reason}`,
      url: uploaded.url,
      bucket: uploaded.bucket,
      key: uploaded.key,
      mediaCheck: check
    };
  }
  return { ...uploaded, mediaCheck: check };
}

export function saveLocalSocialImage({ buffer, isoHyphen, uniqueId, outDir }) {
  const dir = outDir || path.join(process.cwd(), 'docs/growth/owned-social/generated', isoHyphen || 'samples');
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `${uniqueId || 'sample'}.jpg`;
  const localPath = path.join(dir, fileName);
  fs.writeFileSync(localPath, buffer);
  return { localPath, fileName };
}
