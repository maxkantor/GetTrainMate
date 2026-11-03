#!/usr/bin/env node
/**
 * Store Cloudflare Turnstile keys for the public contact form.
 *
 * Usage:
 *   node scripts/growth/setup-contact-turnstile.mjs --secret "0x..." --site-key "0x..."
 *
 * Writes:
 *   SSM /gettrainmate/contact/turnstile-secret (SecureString)
 *   SSM /gettrainmate/contact/turnstile-site-key (String)
 *   SSM /gettrainmate/contact/turnstile-host (String, default gettrainmate.com)
 *   apps/web/.env.local VITE_TURNSTILE_SITE_KEY (gitignored)
 *   Amplify branch env VITE_TURNSTILE_SITE_KEY when an app is found
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

function arg(name, fallback = '') {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return String(process.argv[i + 1]).trim();
  const eq = process.argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1).trim();
  return fallback;
}

function aws(args, { quiet = false } = {}) {
  const r = spawnSync('aws', args, {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || '').trim();
    throw new Error(`aws ${args[0]} ${args[1] || ''} failed: ${err.slice(0, 500)}`);
  }
  if (!quiet && r.stdout?.trim()) return r.stdout.trim();
  return r.stdout?.trim() || '';
}

function putSsm(name, value, type) {
  aws(
    ['ssm', 'put-parameter', '--name', name, '--value', value, '--type', type, '--overwrite', '--region', region],
    { quiet: true }
  );
  console.log(`OK SSM ${name} (${type})`);
}

function writeEnvLocal(siteKey) {
  const envPath = path.join(repoRoot, 'apps', 'web', '.env.local');
  const line = `VITE_TURNSTILE_SITE_KEY=${siteKey}`;
  let body = '';
  if (fs.existsSync(envPath)) body = fs.readFileSync(envPath, 'utf8');
  if (/^VITE_TURNSTILE_SITE_KEY=/m.test(body)) {
    body = body.replace(/^VITE_TURNSTILE_SITE_KEY=.*$/m, line);
  } else {
    body = body.trimEnd() + (body ? '\n' : '') + line + '\n';
  }
  fs.writeFileSync(envPath, body, 'utf8');
  console.log(`OK ${path.relative(repoRoot, envPath)}`);
}

function updateAmplify(siteKey) {
  let appId = arg('--amplify-app-id', process.env.AMPLIFY_APP_ID || '');
  const branchName = arg('--amplify-branch', process.env.AMPLIFY_BRANCH || 'main');
  if (!appId) {
    try {
      const raw = aws([
        'amplify',
        'list-apps',
        '--region',
        region,
        '--query',
        "apps[?contains(name, 'GetTrainMate') || contains(name, 'gettrainmate') || contains(name, 'trainmate')].{id:appId,name:name}",
        '--output',
        'json',
      ]);
      const apps = JSON.parse(raw || '[]');
      if (Array.isArray(apps) && apps[0]?.id) {
        appId = apps[0].id;
        console.log(`Found Amplify app ${apps[0].name} (${appId})`);
      }
    } catch (e) {
      console.warn(`Amplify list-apps skipped: ${e.message}`);
    }
  }
  if (!appId) {
    console.warn('Amplify app not found. Set VITE_TURNSTILE_SITE_KEY in Amplify Console manually.');
    return;
  }
  const branchRaw = aws([
    'amplify',
    'get-branch',
    '--app-id',
    appId,
    '--branch-name',
    branchName,
    '--region',
    region,
    '--output',
    'json',
  ]);
  const branch = JSON.parse(branchRaw);
  const env = { ...(branch.branch?.environmentVariables || {}) };
  env.VITE_TURNSTILE_SITE_KEY = siteKey;
  // AWS CLI expects key=value,key2=value2
  const pairs = Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
  aws(
    [
      'amplify',
      'update-branch',
      '--app-id',
      appId,
      '--branch-name',
      branchName,
      '--environment-variables',
      pairs,
      '--region',
      region,
    ],
    { quiet: true }
  );
  console.log(`OK Amplify ${appId}/${branchName} VITE_TURNSTILE_SITE_KEY`);
}

const secret = arg('--secret');
const siteKey = arg('--site-key') || arg('--sitekey');
const host = arg('--host', 'gettrainmate.com');

if (!secret || !siteKey) {
  console.error('Usage: node scripts/growth/setup-contact-turnstile.mjs --secret "0x..." --site-key "0x..."');
  process.exit(1);
}

console.log(`GetTrainMate Turnstile setup (${region})`);
putSsm('/gettrainmate/contact/turnstile-secret', secret, 'SecureString');
putSsm('/gettrainmate/contact/turnstile-site-key', siteKey, 'String');
putSsm('/gettrainmate/contact/turnstile-host', host, 'String');
writeEnvLocal(siteKey);
updateAmplify(siteKey);
console.log('Done. Redeploy API (SSM secret) and Amplify web (site key) to enable Turnstile.');
console.log(`Site key (public): ${siteKey}`);
