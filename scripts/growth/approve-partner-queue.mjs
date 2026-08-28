#!/usr/bin/env node
/**
 * Approve all draft partner-outreach queue items (Max owner approval).
 * Does NOT enable Lambda send — dispatch still requires PARTNER_OUTREACH_SEND_ENABLED on API.
 *
 *   GROWTH_CRM_ADMIN_EMAIL=... GROWTH_CRM_ADMIN_PASSWORD=... node scripts/growth/approve-partner-queue.mjs
 *   node scripts/growth/approve-partner-queue.mjs --dispatch   # also POST admin dispatch (if send enabled on Lambda)
 */
import { loadSsmSecretsIntoEnv } from './load-ssm-secrets-into-env.mjs';

const API = (
  process.env.GROWTH_CRM_API_BASE_URL ||
  process.env.GTM_API_BASE_URL ||
  'https://goskwzjzjg.execute-api.us-east-1.amazonaws.com'
).replace(/\/$/, '');

function parseArgs(argv) {
  return { dispatch: argv.includes('--dispatch'), dryRun: argv.includes('--dry-run') };
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
    body: JSON.stringify({ email, password })
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
      'X-Admin-Token': token
    },
    body: body ? JSON.stringify(body) : undefined
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

  const summary = await api(token, '/api/admin/partner-outreach/discovery/summary');
  const queue = await api(token, '/api/admin/partner-outreach/queue?status=draft');
  const drafts = Array.isArray(queue) ? queue : [];

  const report = {
    ok: true,
    summary,
    draftCount: drafts.length,
    approved: [],
    skipped: [],
    dryRun: args.dryRun
  };

  for (const item of drafts) {
    if (!item.recipient || !String(item.recipient).includes('@')) {
      report.skipped.push({ queueId: item.queueId, reason: 'no_verified_recipient', org: item.organizationName });
      continue;
    }
    if (args.dryRun) {
      report.approved.push({
        queueId: item.queueId,
        organizationName: item.organizationName,
        recipient: item.recipient,
        subject: item.subject,
        wouldApprove: true
      });
      continue;
    }
    const approval = await api(token, `/api/admin/partner-outreach/queue/${encodeURIComponent(item.queueId)}/approve`, {
      method: 'POST',
      body: { confirm: true }
    });
    report.approved.push({
      queueId: item.queueId,
      organizationName: item.organizationName,
      recipient: item.recipient,
      approvalId: approval.approvalId || approval.ApprovalId || null
    });
  }

  if (args.dispatch && !args.dryRun && report.approved.length) {
    report.dispatch = await api(token, '/api/admin/partner-outreach/dispatch', { method: 'POST' });
  }

  console.log(JSON.stringify(report, null, 2));
  if (!drafts.length) {
    console.error(
      JSON.stringify({
        hint: 'No draft queue items. Open Admin → Partner Outreach → Prepare draft on prospects with verified emails.'
      })
    );
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message || String(e) }));
  process.exit(1);
});
