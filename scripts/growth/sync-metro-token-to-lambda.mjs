#!/usr/bin/env node
/**
 * Sync /gettrainmate/growth/metro-read-token into API Lambda env GROWTH_METRO_READ_TOKEN.
 * Never prints the token value.
 *
 *   node scripts/growth/sync-metro-token-to-lambda.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGION = process.env.AWS_REGION || 'us-east-1';
const SSM_NAME = '/gettrainmate/growth/metro-read-token';
const DEFAULT_FN = 'GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u';

function awsJson(args) {
  const r = spawnSync('aws', args, { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  if (r.status !== 0) return { ok: false, stderr: (r.stderr || '').slice(0, 400) };
  try {
    return { ok: true, data: JSON.parse(r.stdout || '{}') };
  } catch {
    return { ok: false, stderr: 'json_parse_failed' };
  }
}

function getSsmSecure(name) {
  const r = spawnSync(
    'aws',
    [
      'ssm',
      'get-parameter',
      '--name',
      name,
      '--with-decryption',
      '--region',
      REGION,
      '--query',
      'Parameter.Value',
      '--output',
      'text'
    ],
    { encoding: 'utf8', windowsHide: true }
  );
  if (r.status !== 0) return null;
  const v = (r.stdout || '').trim();
  return !v || v === 'None' ? null : v;
}

function main() {
  const fn = process.env.GTM_API_LAMBDA_NAME || DEFAULT_FN;
  const token = getSsmSecure(SSM_NAME);
  if (!token) {
    console.error(JSON.stringify({ ok: false, error: 'ssm_metro_token_missing', name: SSM_NAME }));
    process.exit(2);
  }

  const cfg = awsJson([
    'lambda',
    'get-function-configuration',
    '--function-name',
    fn,
    '--region',
    REGION
  ]);
  if (!cfg.ok) {
    console.error(JSON.stringify({ ok: false, error: 'lambda_get_failed', detail: cfg.stderr }));
    process.exit(1);
  }

  const vars = { ...(cfg.data.Environment?.Variables || {}) };
  const previouslyPresent = Boolean(vars.GROWTH_METRO_READ_TOKEN && String(vars.GROWTH_METRO_READ_TOKEN).trim());
  vars.GROWTH_METRO_READ_TOKEN = token;

  const tmp = path.join(__dirname, 'var', `lambda-env-${process.pid}.json`);
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify({ Variables: vars }), 'utf8');

  const upd = spawnSync(
    'aws',
    [
      'lambda',
      'update-function-configuration',
      '--function-name',
      fn,
      '--region',
      REGION,
      '--environment',
      `file://${tmp.replace(/\\/g, '/')}`
    ],
    { encoding: 'utf8', windowsHide: true }
  );
  try {
    fs.unlinkSync(tmp);
  } catch {
    /* ignore */
  }

  if (upd.status !== 0) {
    console.error(
      JSON.stringify({
        ok: false,
        error: 'lambda_update_failed',
        detail: (upd.stderr || '').slice(0, 300)
      })
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify({
      ok: true,
      functionName: fn,
      envKey: 'GROWTH_METRO_READ_TOKEN',
      source: SSM_NAME,
      previouslyPresent,
      tokenLength: token.length
    })
  );
}

const invoked =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) main();
