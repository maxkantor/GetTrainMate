#!/usr/bin/env node
/**
 * Email the Admin inbox a growth-run summary via AWS SES.
 * Uses SSM: /gettrainmate/ses-admin-email, /gettrainmate/ses-from-email
 * Admin From may be the verified SES identity (including Gmail). Partner outreach still forbids Gmail.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { sendRawSesEmail } from './ses-send-raw.mjs';

const REGION = process.env.AWS_REGION || 'us-east-1';

function getSsm(name, withDecryption = false) {
  const args = [
    'ssm',
    'get-parameter',
    '--name',
    name,
    '--region',
    REGION,
    '--query',
    'Parameter.Value',
    '--output',
    'text'
  ];
  if (withDecryption) args.splice(4, 0, '--with-decryption');
  const r = spawnSync('aws', args, { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`SSM get failed for ${name}`);
  }
  const value = (r.stdout || '').trim();
  if (!value || value === 'None') throw new Error(`SSM empty for ${name}`);
  return value;
}

function parseArgs(argv) {
  const out = { subject: null, body: null, bodyFile: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--subject') out.subject = argv[++i];
    else if (a === '--body') out.body = argv[++i];
    else if (a === '--body-file') out.bodyFile = argv[++i];
  }
  return out;
}

function firstAdminEmail(raw) {
  const first = String(raw || '')
    .split(/[,;]/)
    .map((s) => s.trim())
    .find(Boolean);
  if (!first) throw new Error('No admin email configured');
  return first;
}

export function resolveAdminFromEmail(from) {
  const v = String(from || '').trim();
  if (!v || /noreply@/i.test(v)) return 'partners@gettrainmate.com';
  return v;
}

export async function sendAdminGrowthEmail({ subject, body, htmlBody }) {
  if (!subject?.trim()) throw new Error('subject required');
  if (!body?.trim()) throw new Error('body required');

  const configuredFrom =
    (process.env.SES_FROM_EMAIL || '').trim() || getSsm('/gettrainmate/ses-from-email', false);
  const from = resolveAdminFromEmail(configuredFrom);
  const adminRaw =
    (process.env.ADMIN_EMAIL || process.env.SES_ADMIN_EMAIL || '').trim() ||
    getSsm('/gettrainmate/ses-admin-email', false);
  const to = firstAdminEmail(adminRaw);
  const sent = await sendRawSesEmail({
    fromName: 'GetTrainMate Growth',
    fromEmail: from,
    to,
    replyTo: 'partners@gettrainmate.com',
    subject,
    text: body,
    html: htmlBody
  });
  return { ok: true, to, messageId: sent.messageId, subjectSent: subject };
}

const invokedAsCli =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedAsCli) {
  const args = parseArgs(process.argv.slice(2));
  let body = args.body;
  if (args.bodyFile) {
    body = fs.readFileSync(args.bodyFile, 'utf8');
  } else if (!body && !process.stdin.isTTY) {
    body = fs.readFileSync(0, 'utf8');
  }
  try {
    const result = await sendAdminGrowthEmail({ subject: args.subject, body });
    console.log(JSON.stringify({ ok: true, messageId: result.messageId }, null, 2));
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
    process.exit(1);
  }
}
