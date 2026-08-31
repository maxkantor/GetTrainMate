#!/usr/bin/env node
/**
 * Remove duplicate partner-outreach prospects and queue items (same email per campaign).
 *
 *   node scripts/growth/dedupe-partner-outreach.mjs --dry-run
 *   node scripts/growth/dedupe-partner-outreach.mjs
 */
import { loadSsmSecretsIntoEnv } from './load-ssm-secrets-into-env.mjs';

const API = (
  process.env.GROWTH_CRM_API_BASE_URL ||
  process.env.GTM_API_BASE_URL ||
  'https://goskwzjzjg.execute-api.us-east-1.amazonaws.com'
).replace(/\/$/, '');

function parseArgs(argv) {
  return { dryRun: argv.includes('--dry-run') };
}

async function adminToken() {
  const direct = process.env.GROWTH_CRM_ADMIN_TOKEN?.trim();
  if (direct) return direct;
  const email = process.env.GROWTH_CRM_ADMIN_EMAIL?.trim();
  const password = process.env.GROWTH_CRM_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Set GROWTH_CRM_ADMIN_EMAIL + GROWTH_CRM_ADMIN_PASSWORD (or GROWTH_CRM_ADMIN_TOKEN) in env or SSM.'
    );
  }
  const res = await fetch(`${API}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Admin login failed (${res.status})`);
  const body = await res.json();
  const token = body?.token || body?.Token || body?.sessionToken || '';
  if (!token) throw new Error('Admin login succeeded but no token returned');
  return token;
}

async function api(token, path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Admin-Token': token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return json;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadSsmSecretsIntoEnv();
  const token = await adminToken();

  const preview = await api(token, '/api/admin/partner-outreach/dedupe', {
    method: 'POST',
    body: { dryRun: true },
  });

  if (args.dryRun || (preview.prospectsRemoved === 0 && preview.queueRemoved === 0)) {
    console.log(JSON.stringify({ ok: true, dryRun: true, ...preview }, null, 2));
    return;
  }

  const result = await api(token, '/api/admin/partner-outreach/dedupe', {
    method: 'POST',
    body: { dryRun: false },
  });
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message || String(e) }));
  process.exit(1);
});
