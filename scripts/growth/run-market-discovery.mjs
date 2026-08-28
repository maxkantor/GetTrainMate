#!/usr/bin/env node
/**
 * Run automated international partner discovery (no send).
 * Requires Admin CRM credentials or X-Admin-Token in env.
 */
const API =
  process.env.GROWTH_CRM_API_BASE_URL ||
  process.env.GTM_API_BASE_URL ||
  'https://goskwzjzjg.execute-api.us-east-1.amazonaws.com';

async function adminToken() {
  const direct = process.env.GROWTH_CRM_ADMIN_TOKEN?.trim();
  if (direct) return direct;
  const email = process.env.GROWTH_CRM_ADMIN_EMAIL?.trim();
  const password = process.env.GROWTH_CRM_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Set GROWTH_CRM_ADMIN_TOKEN or GROWTH_CRM_ADMIN_EMAIL + GROWTH_CRM_ADMIN_PASSWORD');
  }
  const res = await fetch(`${API.replace(/\/$/, '')}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Admin login failed (${res.status})`);
  const body = await res.json();
  return body?.token || body?.Token || body?.sessionToken || '';
}

async function main() {
  const token = await adminToken();
  const base = API.replace(/\/$/, '');
  const maxPerMarket = Number(process.env.DISCOVERY_MAX_PER_MARKET || 40);
  const seedsOnly = process.env.DISCOVERY_SEEDS_ONLY !== 'false';
  const onlyCampaignId = process.env.DISCOVERY_CAMPAIGN_ID?.trim() || undefined;
  const res = await fetch(`${base}/api/admin/partner-outreach/discover/automated`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Admin-Token': token,
    },
    body: JSON.stringify({
      prepareDrafts: true,
      maxPerMarket,
      seedsOnly,
      onlyCampaignId,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(text);
    process.exit(1);
  }
  const report = JSON.parse(text);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
