#!/usr/bin/env node
/**
 * Allow Meta (Facebook/Instagram) to fetch social post images from S3.
 * Public read is scoped to social/generated/* only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resolveMediaBucket } from './lib/resolve-media-bucket.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGION = process.env.AWS_REGION || 'us-east-1';
const bucket = resolveMediaBucket();

function run(args) {
  const r = spawnSync('aws', args, { encoding: 'utf8', stdio: 'pipe' });
  return { ok: r.status === 0, stdout: r.stdout || '', stderr: r.stderr || '' };
}

const pab = run([
  's3api',
  'get-public-access-block',
  '--bucket',
  bucket,
  '--region',
  REGION
]);
const current = pab.ok ? JSON.parse(pab.stdout).PublicAccessBlockConfiguration : null;

if (
  !current ||
  current.BlockPublicPolicy ||
  current.RestrictPublicBuckets
) {
  const setPab = run([
    's3api',
    'put-public-access-block',
    '--bucket',
    bucket,
    '--region',
    REGION,
    '--public-access-block-configuration',
    'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false'
  ]);
  if (!setPab.ok) {
    console.error(JSON.stringify({ ok: false, step: 'put-public-access-block', bucket, error: setPab.stderr.slice(0, 400) }));
    process.exit(1);
  }
}

const template = fs.readFileSync(path.join(__dirname, '../../infra/s3-social-public-read-policy.json'), 'utf8');
const policy = template.replaceAll('BUCKET_NAME', bucket);
const policyFile = path.join(process.cwd(), `.social-bucket-policy-${Date.now()}.json`);
fs.writeFileSync(policyFile, policy);
try {
  const put = run(['s3api', 'put-bucket-policy', '--bucket', bucket, '--region', REGION, '--policy', `file://${policyFile}`]);
  if (!put.ok) {
    console.error(JSON.stringify({ ok: false, step: 'put-bucket-policy', bucket, error: put.stderr.slice(0, 400) }));
    process.exit(1);
  }
} finally {
  try {
    fs.unlinkSync(policyFile);
  } catch {
    /* ignore */
  }
}

console.log(JSON.stringify({ ok: true, bucket, region: REGION, prefix: 'social/generated/*' }, null, 2));
