#!/usr/bin/env node
/**
 * Final acquisition report: discovery batch + funnel + Instagram status.
 */
import { fetchMetroDensity } from './lib/crm-metro.mjs';

const API =
  process.env.GROWTH_CRM_API_BASE_URL ||
  process.env.GTM_API_BASE_URL ||
  'https://goskwzjzjg.execute-api.us-east-1.amazonaws.com';

async function adminToken() {
  const direct = process.env.GROWTH_CRM_ADMIN_TOKEN?.trim();
  if (direct) return direct;
  const email = process.env.GROWTH_CRM_ADMIN_EMAIL?.trim();
  const password = process.env.GROWTH_CRM_ADMIN_PASSWORD;
  if (!email || !password) return null;
  const res = await fetch(`${API.replace(/\/$/, '')}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const body = await res.json();
  return body?.token || body?.Token || body?.sessionToken || null;
}

async function discoverySummary(token) {
  if (!token) return { status: 'unavailable', reason: 'Admin CRM credentials not configured' };
  const res = await fetch(`${API.replace(/\/$/, '')}/api/admin/partner-outreach/discovery/summary`, {
    headers: { Accept: 'application/json', 'X-Admin-Token': token },
  });
  if (!res.ok) return { status: 'unavailable', httpStatus: res.status };
  return res.json();
}

async function main() {
  const metro = await fetchMetroDensity();
  const token = await adminToken();
  const discovery = await discoverySummary(token);
  const report = {
    generatedAtUtc: new Date().toISOString(),
    marketsEvaluated: 5,
    metroCrm: metro,
    discovery,
    instagramPublicationStatus:
      'blocked — INSTAGRAM_GRAPH_ACCESS_TOKEN / INSTAGRAM_BUSINESS_ACCOUNT_ID not configured (run publish-approved-instagram.mjs)',
    attributedVisits: 'Unavailable — run after owned-social post is live or partner emails sent',
    verifiedCustomers: 0,
    remainingBlocker:
      metro.status === 'unavailable'
        ? 'Configure GROWTH_METRO_READ_TOKEN in API Lambda env (SSM /gettrainmate/growth/metro-read-token) for market-density reporting.'
        : 'Instagram connector + bounded batch approval for first partner emails (send still disabled).',
  };
  console.log(JSON.stringify(report, null, 2));
}

main();
