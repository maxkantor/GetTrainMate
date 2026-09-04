#!/usr/bin/env node
/**
 * Load growth secrets from SSM into process.env (for collectors).
 * Does not print values. Meta credentials prefer SSM over env (SSM is source of truth).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REGION = process.env.AWS_REGION || 'us-east-1';

/** Env vars that must prefer live SSM over possibly stale Cursor Environment secrets. */
const PREFER_SSM_ENV = new Set([
  'META_PAGE_ACCESS_TOKEN',
  'FACEBOOK_PAGE_ID',
  'INSTAGRAM_BUSINESS_ACCOUNT_ID',
  'INSTAGRAM_GRAPH_ACCESS_TOKEN',
  'META_APP_ID',
  'META_APP_SECRET'
]);

const MAP = [
  ['GA4_PROPERTY_ID', ['/gettrainmate/growth/ga4-property-id'], false],
  ['GOOGLE_ANALYTICS_CREDENTIALS_JSON', ['/gettrainmate/growth/google-analytics-credentials-json'], true],
  ['STRIPE_RESTRICTED_READ_KEY', ['/gettrainmate/growth/stripe-restricted-read-key'], true],
  ['GROWTH_METRO_READ_TOKEN', ['/gettrainmate/growth/metro-read-token'], true],
  ['GROWTH_CRM_ADMIN_EMAIL', ['/gettrainmate/growth/crm-admin-email'], false],
  ['GROWTH_CRM_ADMIN_PASSWORD', ['/gettrainmate/growth/crm-admin-password'], true],
  ['AWS_ACCESS_KEY_ID', ['/gettrainmate/growth/aws-access-key-id'], false],
  ['AWS_SECRET_ACCESS_KEY', ['/gettrainmate/growth/aws-secret-access-key'], true],
  ['META_PAGE_ACCESS_TOKEN', ['/gettrainmate/growth/meta-page-access-token'], true],
  ['FACEBOOK_PAGE_ID', ['/gettrainmate/growth/facebook-page-id'], false],
  ['INSTAGRAM_GRAPH_ACCESS_TOKEN', ['/gettrainmate/growth/instagram-graph-access-token'], true],
  ['INSTAGRAM_BUSINESS_ACCOUNT_ID', ['/gettrainmate/growth/instagram-business-account-id'], false],
  ['META_APP_ID', ['/gettrainmate/growth/meta-app-id'], false],
  ['META_APP_SECRET', ['/gettrainmate/growth/meta-app-secret'], true]
];

export const GROWTH_SSM_MAP = MAP;

function assertGrowthSsmName(ssmName) {
  if (!String(ssmName).startsWith('/gettrainmate/')) {
    throw new Error(`SSM path must start with /gettrainmate/: ${ssmName}`);
  }
  if (String(ssmName).startsWith('/prod/')) {
    throw new Error(`SSM path must not use /prod/: ${ssmName}`);
  }
}

/**
 * @returns {{ ok: true, value: string } | { ok: false, reason: 'not_found'|'access_denied'|'error', detail?: string }}
 */
export function readSsmParameterDetailed(ssmName, secure, { region = REGION } = {}) {
  const args = [
    'ssm',
    'get-parameter',
    '--name',
    ssmName,
    '--region',
    region,
    '--query',
    'Parameter.Value',
    '--output',
    'text'
  ];
  if (secure) args.splice(4, 0, '--with-decryption');
  const r = spawnSync('aws', args, { encoding: 'utf8' });
  const err = `${r.stderr || ''}${r.stdout || ''}`;
  if (r.status !== 0) {
    if (/AccessDenied|not authorized|UnauthorizedOperation/i.test(err)) {
      return { ok: false, reason: 'access_denied', detail: err.slice(0, 200) };
    }
    if (/ParameterNotFound|not found/i.test(err)) {
      return { ok: false, reason: 'not_found' };
    }
    return { ok: false, reason: 'error', detail: err.slice(0, 200) };
  }
  const value = (r.stdout || '').trim();
  if (!value || value === 'None') return { ok: false, reason: 'not_found' };
  return { ok: true, value };
}

function readSsmParameter(ssmName, secure) {
  const got = readSsmParameterDetailed(ssmName, secure);
  return got.ok ? got.value : null;
}

export function loadSsmSecretsIntoEnv() {
  const loaded = [];
  const missing = [];
  const diagnostics = [];
  let ssmAccessDenied = false;

  for (const [envName, ssmNames, secure] of MAP) {
    const names = Array.isArray(ssmNames) ? ssmNames : [ssmNames];
    const preferSsm = PREFER_SSM_ENV.has(envName);
    const envPresent = Boolean(process.env[envName]);

    let value = null;
    let sourcePath = null;
    let ssmStatus = 'not_requested';

    for (const ssmName of names) {
      assertGrowthSsmName(ssmName);
      // Prefer SSM for Meta credentials even when Cursor env already has a value.
      if (!preferSsm && envPresent) {
        ssmStatus = 'skipped_env_present';
        break;
      }
      const got = readSsmParameterDetailed(ssmName, secure);
      if (got.ok) {
        value = got.value;
        sourcePath = ssmName;
        ssmStatus = 'found';
        break;
      }
      if (got.reason === 'access_denied') {
        ssmAccessDenied = true;
        ssmStatus = 'access_denied';
        diagnostics.push({ env: envName, ssm: ssmName, status: 'access_denied' });
        break;
      }
      ssmStatus = got.reason || 'error';
      diagnostics.push({ env: envName, ssm: ssmName, status: ssmStatus });
    }

    if (value) {
      process.env[envName] = value;
      loaded.push({ env: envName, source: sourcePath || 'ssm' });
      continue;
    }

    if (envPresent) {
      loaded.push({ env: envName, source: 'env' });
      diagnostics.push({
        env: envName,
        ssm: names[0],
        status: preferSsm ? `env_fallback_after_${ssmStatus}` : 'env'
      });
      continue;
    }

    missing.push(envName);
  }

  const report = {
    loaded: loaded.map((x) => x.env),
    sources: Object.fromEntries(loaded.map((x) => [x.env, x.source])),
    missing,
    region: REGION,
    ssmAccessDenied,
    /** Safe diagnostics — parameter names + found/missing/denied only (never values). */
    diagnostics: diagnostics.map((d) => ({
      env: d.env,
      ssm: d.ssm,
      status: d.status
    }))
  };

  console.error(
    JSON.stringify({
      event: 'GrowthSsmLoad',
      region: REGION,
      ssmAccessDenied,
      meta: diagnostics.filter((d) => /META|FACEBOOK|INSTAGRAM/.test(d.env)),
      loadedMeta: loaded
        .filter((x) => /META|FACEBOOK|INSTAGRAM/.test(x.env))
        .map((x) => ({ env: x.env, source: x.source.startsWith('/') ? x.source : x.source }))
    })
  );

  return report;
}

export { readSsmParameter };

const invokedAsCli =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedAsCli) {
  console.log(JSON.stringify(loadSsmSecretsIntoEnv(), null, 2));
}
