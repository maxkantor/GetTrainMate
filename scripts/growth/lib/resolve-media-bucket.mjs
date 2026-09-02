/**
 * Resolve the live GetTrainMate media bucket (handles legacy typo names).
 */
import { spawnSync } from 'node:child_process';

const REGION = process.env.AWS_REGION || 'us-east-1';

const STATIC_CANDIDATES = [
  process.env.GROWTH_SOCIAL_IMAGE_BUCKET,
  process.env.MEDIA_BUCKET_NAME,
  process.env.MEDIA_BUCKET,
  'gettrainmate-media-bucket',
  'getrainmate-media-bucket',
  'gettrainmate-media-718522948657-us-east-1'
].filter(Boolean);

function bucketRank(name) {
  const n = String(name || '').toLowerCase();
  if (n === 'gettrainmate-media-bucket') return 0;
  if (n === 'getrainmate-media-bucket') return 1;
  if (n.includes('gettrainmate') && n.includes('media') && !n.includes('718522948657')) return 2;
  if (n.includes('train') && n.includes('media') && n.length < 40) return 3;
  return 10 + n.length;
}

function bucketExists(name) {
  const r = spawnSync(
    'aws',
    ['s3api', 'head-bucket', '--bucket', name, '--region', REGION],
    { encoding: 'utf8', stdio: 'pipe' }
  );
  return r.status === 0;
}

function listTrainMediaBuckets() {
  const r = spawnSync('aws', ['s3', 'ls', '--region', REGION], { encoding: 'utf8', stdio: 'pipe' });
  if (r.status !== 0) return [];
  return (r.stdout || '')
    .split('\n')
    .map((line) => line.trim().split(/\s+/).pop())
    .filter((name) => /train/i.test(name) && /media/i.test(name));
}

let cached = null;

export function resolveMediaBucket() {
  if (cached) return cached;
  const seen = new Set();
  const candidates = [];
  for (const name of [...STATIC_CANDIDATES, ...listTrainMediaBuckets()]) {
    const n = String(name || '').trim();
    if (!n || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    candidates.push(n);
  }
  candidates.sort((a, b) => bucketRank(a) - bucketRank(b) || a.localeCompare(b));
  for (const name of candidates) {
    if (bucketExists(name)) {
      cached = name;
      return name;
    }
  }
  cached = STATIC_CANDIDATES[0] || 'gettrainmate-media-bucket';
  return cached;
}
