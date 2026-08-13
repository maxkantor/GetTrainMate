#!/usr/bin/env node
/**
 * Load /gettrainmate/growth/* from SSM into process.env (for collectors).
 * Does not print values. No-op if AWS CLI / params unavailable.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REGION = process.env.AWS_REGION || 'us-east-1';
const MAP = [
  ['GA4_PROPERTY_ID', '/gettrainmate/growth/ga4-property-id', false],
  ['GOOGLE_ANALYTICS_CREDENTIALS_JSON', '/gettrainmate/growth/google-analytics-credentials-json', true],
  ['STRIPE_RESTRICTED_READ_KEY', '/gettrainmate/growth/stripe-restricted-read-key', true],
  ['GROWTH_METRO_READ_TOKEN', '/gettrainmate/growth/metro-read-token', true],
  ['GROWTH_CRM_ADMIN_EMAIL', '/gettrainmate/growth/crm-admin-email', false],
  ['GROWTH_CRM_ADMIN_PASSWORD', '/gettrainmate/growth/crm-admin-password', true],
  ['AWS_ACCESS_KEY_ID', '/gettrainmate/growth/aws-access-key-id', false],
  ['AWS_SECRET_ACCESS_KEY', '/gettrainmate/growth/aws-secret-access-key', true]
];

export function loadSsmSecretsIntoEnv() {
  const loaded = [];
  const missing = [];

  for (const [envName, ssmName, secure] of MAP) {
    if (process.env[envName]) {
      loaded.push({ env: envName, source: 'env' });
      continue;
    }
    const args = [
      'ssm',
      'get-parameter',
      '--name',
      ssmName,
      '--region',
      REGION,
      '--query',
      'Parameter.Value',
      '--output',
      'text'
    ];
    if (secure) args.splice(4, 0, '--with-decryption');
    const r = spawnSync('aws', args, { encoding: 'utf8' });
    if (r.status !== 0) {
      missing.push(envName);
      continue;
    }
    const value = (r.stdout || '').trim();
    if (!value || value === 'None') {
      missing.push(envName);
      continue;
    }
    process.env[envName] = value;
    loaded.push({ env: envName, source: 'ssm' });
  }

  return { loaded: loaded.map((x) => x.env), missing, region: REGION };
}

const invokedAsCli =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedAsCli) {
  console.log(JSON.stringify(loadSsmSecretsIntoEnv(), null, 2));
}
