#!/usr/bin/env node
/**
 * IG-2026-08-17 — publish exactly one approved owned-social post when connector is configured.
 * Never substitutes manual prospect entry or alternate captions.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPROVAL_ID = 'IG-2026-08-17';
const APPROVED_ACCOUNT = '@gettrainmate';
const APPROVED_URL =
  'https://gettrainmate.com/atlanta-training-partners?utm_source=instagram&utm_medium=organic&utm_campaign=owned-ig-2026-08-17';

const CAPTION = [
  'Looking for a consistent training partner in Atlanta?',
  '',
  'GetTrainMate is TRAIN-first (not dating-first). Create a profile, pick TRAIN, and find people who want to run, lift, or race with you.',
  '',
  `Atlanta: ${APPROVED_URL}`,
  '',
  'No guaranteed matches. You control your profile.',
].join('\n');

function readApprovalRecord() {
  const p = path.join(__dirname, '../../docs/growth/partners/OWNER-APPROVAL-REQUEST.md');
  const md = fs.readFileSync(p, 'utf8');
  if (!md.includes(APPROVAL_ID)) throw new Error(`Approval ${APPROVAL_ID} not found in OWNER-APPROVAL-REQUEST.md`);
  if (!md.includes(APPROVED_ACCOUNT)) throw new Error(`Approved account ${APPROVED_ACCOUNT} not recorded`);
  if (!md.includes(APPROVED_URL)) throw new Error('Approved tracked URL mismatch');
  return { approvalId: APPROVAL_ID, account: APPROVED_ACCOUNT, url: APPROVED_URL, caption: CAPTION };
}

async function tryPublish() {
  const token = process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN?.trim();
  const userId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim();
  if (!token || !userId) {
    return {
      status: 'blocked',
      blocker:
        'Instagram Graph API connector unavailable. Set INSTAGRAM_GRAPH_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID for @gettrainmate. Cursor cannot post without this connector.',
      approvalValidated: true,
    };
  }

  const createRes = await fetch(`https://graph.facebook.com/v21.0/${userId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ caption: CAPTION, access_token: token }),
  });
  const createBody = await createRes.json();
  if (!createRes.ok) {
    return {
      status: 'blocked',
      blocker: `Instagram media create failed: ${JSON.stringify(createBody)}`,
      approvalValidated: true,
    };
  }
  const publishRes = await fetch(`https://graph.facebook.com/v21.0/${userId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: createBody.id, access_token: token }),
  });
  const publishBody = await publishRes.json();
  if (!publishRes.ok) {
    return {
      status: 'blocked',
      blocker: `Instagram publish failed: ${JSON.stringify(publishBody)}`,
      approvalValidated: true,
    };
  }
  return {
    status: 'published',
    postId: publishBody.id,
    publishedAtUtc: new Date().toISOString(),
    postUrl: `https://www.instagram.com/${APPROVED_ACCOUNT.replace('@', '')}/`,
    approvalId: APPROVAL_ID,
  };
}

async function main() {
  const approval = readApprovalRecord();
  const result = await tryPublish();
  console.log(JSON.stringify({ ...approval, ...result }, null, 2));
  if (result.status !== 'published') process.exit(2);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
