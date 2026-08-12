#!/usr/bin/env node
/**
 * Email the Admin inbox a growth-run summary via AWS SES.
 * Resolves addresses from env first, then SSM (SDK, then AWS CLI fallback).
 *
 * Usage:
 *   node scripts/growth/notify-admin-email.mjs --subject "..." --body-file path.txt
 *   node scripts/growth/notify-admin-email.mjs --subject "..." --body "plain text"
 *   echo "body" | node scripts/growth/notify-admin-email.mjs --subject "..."
 *
 * Never prints secret values. Exits non-zero if send fails.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const REGION = process.env.AWS_REGION || 'us-east-1';

const SSM_FROM_PATHS = ['/gettrainmate/ses-from-email'];
const SSM_ADMIN_PATHS = ['/gettrainmate/ses-admin-email'];

function awsCredentials() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId || !secretAccessKey) return null;
  return { accessKeyId, secretAccessKey };
}

async function getSsmViaSdk(name, withDecryption = false) {
  const creds = awsCredentials();
  if (!creds) return null;
  try {
    const { SSMClient, GetParameterCommand } = await import('@aws-sdk/client-ssm');
    const client = new SSMClient({ region: REGION, credentials: creds });
    const out = await client.send(
      new GetParameterCommand({ Name: name, WithDecryption: withDecryption })
    );
    const value = out.Parameter?.Value?.trim();
    return value || null;
  } catch {
    return null;
  }
}

function getSsmViaCli(name, withDecryption = false) {
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
  if (r.status !== 0) return null;
  const value = (r.stdout || '').trim();
  return value && value !== 'None' ? value : null;
}

async function resolveFromPaths(paths) {
  for (const name of paths) {
    const viaSdk = await getSsmViaSdk(name, false);
    if (viaSdk) return viaSdk;
    const viaCli = getSsmViaCli(name, false);
    if (viaCli) return viaCli;
  }
  return null;
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

async function resolveEmailAddresses() {
  const from =
    (process.env.SES_FROM_EMAIL || process.env.SES_SENDER_EMAIL || '').trim() ||
    (await resolveFromPaths(SSM_FROM_PATHS));
  const adminRaw =
    (process.env.ADMIN_EMAIL || process.env.SES_ADMIN_EMAIL || '').trim() ||
    (await resolveFromPaths(SSM_ADMIN_PATHS));

  if (!from || !adminRaw) {
    const missing = [];
    if (!from) missing.push('SES_FROM_EMAIL (env) or /gettrainmate/ses-from-email (SSM)');
    if (!adminRaw) missing.push('ADMIN_EMAIL (env) or /gettrainmate/ses-admin-email (SSM)');
    throw new Error(
      `Growth email not configured: missing ${missing.join(' and ')}. Add Cursor Cloud Agent secrets or grant cursor-gettrainmate-growth ssm:GetParameter + ses:SendEmail.`
    );
  }

  return { from, to: firstAdminEmail(adminRaw) };
}

async function sendViaSdk({ fromSource, to, subject, body, htmlBody }) {
  const creds = awsCredentials();
  if (!creds) return null;
  try {
    const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
    const client = new SESClient({ region: REGION, credentials: creds });
    const bodyPayload = { Text: { Data: body, Charset: 'UTF-8' } };
    if (htmlBody?.trim()) {
      bodyPayload.Html = { Data: htmlBody, Charset: 'UTF-8' };
    }
    const out = await client.send(
      new SendEmailCommand({
        Source: fromSource,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: bodyPayload
        }
      })
    );
    return out.MessageId ?? null;
  } catch {
    return null;
  }
}

function sendViaCli({ fromSource, to, subject, body, htmlBody }) {
  const bodyPayload = { Text: { Data: body, Charset: 'UTF-8' } };
  if (htmlBody?.trim()) {
    bodyPayload.Html = { Data: htmlBody, Charset: 'UTF-8' };
  }

  const tmpDir = fs.mkdtempSync(
    path.join(process.env.TEMP || process.env.TMPDIR || '/tmp', 'gtm-growth-mail-')
  );
  const destPath = path.join(tmpDir, 'dest.json');
  const msgPath = path.join(tmpDir, 'msg.json');
  try {
    fs.writeFileSync(destPath, JSON.stringify({ ToAddresses: [to] }), 'utf8');
    fs.writeFileSync(
      msgPath,
      JSON.stringify({
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: bodyPayload
      }),
      'utf8'
    );

    const r = spawnSync(
      'aws',
      [
        'ses',
        'send-email',
        '--region',
        REGION,
        '--from',
        fromSource,
        '--destination',
        `file://${destPath.replace(/\\/g, '/')}`,
        '--message',
        `file://${msgPath.replace(/\\/g, '/')}`
      ],
      { encoding: 'utf8' }
    );

    if (r.status !== 0) return null;

    try {
      return JSON.parse(r.stdout || '{}').MessageId ?? null;
    } catch {
      return null;
    }
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

export async function sendAdminGrowthEmail({ subject, body, htmlBody }) {
  if (!subject?.trim()) throw new Error('subject required');
  if (!body?.trim()) throw new Error('body required');

  const { from, to } = await resolveEmailAddresses();
  const fromSource = `GetTrainMate Growth <${from}>`;

  let messageId = await sendViaSdk({ fromSource, to, subject, body, htmlBody });
  if (!messageId) {
    messageId = sendViaCli({ fromSource, to, subject, body, htmlBody });
  }
  if (!messageId) {
    throw new Error(
      'SES send failed. Confirm cursor-gettrainmate-growth has ses:SendEmail on the verified From identity and that ADMIN_EMAIL / SES_FROM_EMAIL are set.'
    );
  }

  return { ok: true, to, messageId, subjectSent: subject };
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
