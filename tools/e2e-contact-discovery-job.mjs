#!/usr/bin/env node
/**
 * E2E: durable contact-discovery job against live Admin API.
 * Does NOT send email. Prints progress only (no secrets).
 */
import { spawnSync } from 'node:child_process';

function ssm(name, secure = false) {
  const args = [
    'ssm',
    'get-parameter',
    '--name',
    name,
    '--region',
    'us-east-1',
    '--query',
    'Parameter.Value',
    '--output',
    'text',
  ];
  if (secure) args.splice(4, 0, '--with-decryption');
  const r = spawnSync('aws', args, { encoding: 'utf8', shell: false });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || 'ssm fail').trim());
  return String(r.stdout || '').trim();
}

const email = ssm('/gettrainmate/ses-admin-email');
const password = ssm('/gettrainmate/admin/password', true);
const API = 'https://goskwzjzjg.execute-api.us-east-1.amazonaws.com';

const login = await fetch(`${API}/api/admin/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
if (!login.ok) {
  console.error('login', login.status, await login.text());
  process.exit(1);
}
const loginBody = await login.json();
const token = loginBody.sessionToken || loginBody.token || loginBody.Token;
const headers = { 'X-Admin-Token': token, 'Content-Type': 'application/json' };

const counters0 = await (
  await fetch(`${API}/api/admin/partner-outreach/prospects/pipeline-counters`, { headers })
).json();
console.log('COUNTERS0', JSON.stringify(counters0));

const prospects = await (
  await fetch(`${API}/api/admin/partner-outreach/prospects`, { headers })
).json();
const missing = (Array.isArray(prospects) ? prospects : []).filter(
  (p) => p.website && !(p.email && String(p.email).includes('@')),
);
console.log('MISSING', missing.length);

const start = await fetch(`${API}/api/admin/partner-outreach/prospects/contact-discovery/jobs`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    filterMissingOnly: true,
    force: true,
    max: Math.min(Math.max(missing.length, 1), 13),
  }),
});
const startBody = await start.json();
console.log(
  'START',
  start.status,
  JSON.stringify({
    jobId: startBody.jobId,
    status: startBody.status,
    total: startBody.total,
    processed: startBody.processed,
    progressPct: startBody.progressPct,
    error: startBody.error,
  }),
);
if (!start.ok || !startBody.jobId) process.exit(1);

let job = startBody;
let polls = 0;
const seenPct = new Set([String(job.progressPct ?? 0)]);
while (
  !['complete', 'partial', 'failed', 'paused'].includes(String(job.status || '').toLowerCase()) &&
  polls < 100
) {
  const r = await fetch(
    `${API}/api/admin/partner-outreach/prospects/contact-discovery/jobs/${encodeURIComponent(job.jobId)}`,
    { headers },
  );
  job = await r.json();
  polls += 1;
  seenPct.add(String(job.progressPct ?? 0));
  console.log(
    'POLL',
    polls,
    job.status,
    `${job.progressPct ?? 0}%`,
    `${job.processed ?? 0}/${job.total ?? 0}`,
    `current=${job.currentProspectName || ''}`,
    `emails=${job.emailsFound ?? 0}`,
    `forms=${job.formsFound ?? 0}`,
    `review=${job.reviewRequired ?? 0}`,
    `nocontact=${job.noContact ?? 0}`,
    `err=${job.errors ?? 0}`,
  );
}

const active = await (
  await fetch(`${API}/api/admin/partner-outreach/prospects/contact-discovery/active`, { headers })
).json();
const counters1 = await (
  await fetch(`${API}/api/admin/partner-outreach/prospects/pipeline-counters`, { headers })
).json();
const queue = await (await fetch(`${API}/api/admin/partner-outreach/queue`, { headers })).json();
const drafts = (Array.isArray(queue) ? queue : []).filter(
  (q) => String(q.status).toLowerCase() === 'draft',
).length;
const sentLike = (Array.isArray(queue) ? queue : []).filter((q) =>
  ['sent', 'delivered', 'sending'].includes(String(q.status).toLowerCase()),
).length;

console.log(
  'FINAL',
  JSON.stringify({
    status: job.status,
    progressPct: job.progressPct,
    processed: job.processed,
    total: job.total,
    emailsFound: job.emailsFound,
    formsFound: job.formsFound,
    reviewRequired: job.reviewRequired,
    noContact: job.noContact,
    errors: job.errors,
    remaining: job.remaining,
    pctSteps: [...seenPct].join(','),
  }),
);
console.log('ACTIVE_AFTER', JSON.stringify({ active: active.active, status: active.status, jobId: active.jobId }));
console.log('COUNTERS1', JSON.stringify(counters1));
console.log('QUEUE', JSON.stringify({ drafts, sentLike, sentToday: counters1.sentToday }));
