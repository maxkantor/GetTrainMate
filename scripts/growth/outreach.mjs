#!/usr/bin/env node
/**
 * Partner outreach CLI. Preview and validate never send.
 *
 *   node scripts/growth/outreach.mjs preview
 *   node scripts/growth/outreach.mjs validate
 *   node scripts/growth/outreach.mjs send --approval-id <id> --send
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  ACTIVITY_BY_TYPE,
  DEFAULT_FROM_EMAIL,
  DEFAULT_REPLY_TO,
  TEMPLATE_VERSION,
  buildPartnerMime,
  messageFingerprint,
  renderPartnerCopy
} from './lib/partner-email.mjs';
import { assertCanSend, isScheduledAutomation, recordAcceptedSend } from './lib/partner-outreach-auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const DEFAULT_PREVIEW = path.join(__dirname, 'fixtures/previews');
const EXAMPLE_APPROVALS = path.join(__dirname, 'config/partner-outreach-approvals.example.json');

function parseArgs(argv) {
  const out = {
    cmd: argv[0] || 'preview',
    approvalId: null,
    send: false,
    approvals: process.env.PARTNER_OUTREACH_APPROVALS_PATH || EXAMPLE_APPROVALS,
    ledger: process.env.PARTNER_OUTREACH_LEDGER_PATH || path.join(__dirname, 'var/partner-send-ledger.json'),
    previewDir: DEFAULT_PREVIEW,
    fixture: path.join(__dirname, 'fixtures/partner-org-example.json')
  };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--approval-id') out.approvalId = argv[++i];
    else if (a === '--send') out.send = true;
    else if (a === '--approvals') out.approvals = argv[++i];
    else if (a === '--ledger') out.ledger = argv[++i];
    else if (a === '--preview-dir') out.previewDir = argv[++i];
    else if (a === '--fixture') out.fixture = argv[++i];
  }
  return out;
}

function loadFixture(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function renderFromFixture(fx) {
  const activity = fx.activity || ACTIVITY_BY_TYPE[fx.communityType] || 'pickleball';
  return {
    ...fx,
    activity,
    copy: renderPartnerCopy({
      organizationName: fx.organizationName,
      partnerUrl: fx.partnerUrl,
      partnerCode: fx.partnerCode,
      activity
    })
  };
}

async function writePreviews(dir, rendered) {
  fs.mkdirSync(dir, { recursive: true });
  const base = path.join(dir, 'partner-email-example');
  fs.writeFileSync(`${base}.txt`, rendered.copy.text, 'utf8');
  fs.writeFileSync(`${base}.html`, rendered.copy.html, 'utf8');
  const mobile = rendered.copy.html.replace(
    'max-width:560px',
    'max-width:360px'
  );
  fs.writeFileSync(`${base}.mobile.html`, mobile, 'utf8');
  const mime = await buildPartnerMime({
    to: rendered.to || 'preview@example.test',
    subject: rendered.copy.subject,
    text: rendered.copy.text,
    html: rendered.copy.html
  });
  fs.writeFileSync(`${base}.eml`, mime);
  return {
    wrote: [`${base}.txt`, `${base}.html`, `${base}.mobile.html`, `${base}.eml`],
    subject: rendered.copy.subject,
    templateVersion: TEMPLATE_VERSION,
    fingerprint: messageFingerprint({
      to: rendered.to || 'preview@example.test',
      subject: rendered.copy.subject,
      text: rendered.copy.text,
      templateVersion: TEMPLATE_VERSION
    })
  };
}

function getSsm(name) {
  const r = spawnSync(
    'aws',
    ['ssm', 'get-parameter', '--name', name, '--region', process.env.AWS_REGION || 'us-east-1', '--query', 'Parameter.Value', '--output', 'text'],
    { encoding: 'utf8' }
  );
  if (r.status !== 0) return '';
  const v = (r.stdout || '').trim();
  return !v || v === 'None' ? '' : v;
}

async function cmdPreview(args) {
  const rendered = renderFromFixture(loadFixture(args.fixture));
  const result = await writePreviews(args.previewDir, rendered);
  console.log(JSON.stringify({ ok: true, sent: false, ...result }, null, 2));
}

async function cmdValidate(args) {
  const rendered = renderFromFixture(loadFixture(args.fixture));
  await buildPartnerMime({
    to: rendered.to || 'preview@example.test',
    subject: rendered.copy.subject,
    text: rendered.copy.text,
    html: rendered.copy.html
  });
  if (isScheduledAutomation()) {
    console.log(JSON.stringify({ ok: true, sent: false, scheduledAutomation: true, sendPathInvoked: false }));
    return;
  }
  const gate = assertCanSend({
    approvalId: args.approvalId || 'missing',
    sendFlag: false,
    approvalsPath: args.approvals,
    ledgerPath: args.ledger,
    intended: {
      to: rendered.to,
      subject: rendered.copy.subject,
      text: rendered.copy.text,
      templateVersion: TEMPLATE_VERSION
    }
  });
  console.log(
    JSON.stringify(
      {
        ok: true,
        sent: false,
        templateVersion: TEMPLATE_VERSION,
        subject: rendered.copy.subject,
        sendWouldBeBlocked: !gate.ok,
        blockCode: gate.code || null
      },
      null,
      2
    )
  );
}

async function cmdSend(args) {
  if (isScheduledAutomation()) {
    console.error(JSON.stringify({ ok: false, sent: false, error: 'scheduled_automation_blocked' }));
    process.exit(2);
  }
  const rendered = renderFromFixture(loadFixture(args.fixture));
  const intended = {
    to: rendered.to,
    subject: rendered.copy.subject,
    text: rendered.copy.text,
    templateVersion: TEMPLATE_VERSION
  };
  const gate = assertCanSend({
    approvalId: args.approvalId,
    sendFlag: args.send,
    approvalsPath: args.approvals,
    ledgerPath: args.ledger,
    intended
  });
  if (!gate.ok) {
    console.error(JSON.stringify({ ok: false, sent: false, error: gate.code }));
    process.exit(2);
  }

  const fromEmail = (process.env.SES_FROM_EMAIL || '').trim() || getSsm('/gettrainmate/ses-from-email') || DEFAULT_FROM_EMAIL;
  if (fromEmail !== DEFAULT_FROM_EMAIL) {
    console.error(
      JSON.stringify({
        ok: false,
        sent: false,
        error: 'from_identity_mismatch',
        configured: '(redacted)',
        expected: DEFAULT_FROM_EMAIL
      })
    );
    process.exit(2);
  }
  const replyTo = DEFAULT_REPLY_TO;
  const mime = await buildPartnerMime({
    fromEmail,
    to: intended.to,
    replyTo,
    subject: intended.subject,
    text: intended.text,
    html: rendered.copy.html
  });

  const { sendRawMime } = await import('./ses-send-raw.mjs');
  const sent = sendRawMime({ fromEmail, raw: mime });
  recordAcceptedSend(args.ledger, {
    approvalId: args.approvalId,
    to: intended.to,
    fingerprint: gate.fingerprint,
    messageId: sent.messageId,
    templateVersion: TEMPLATE_VERSION
  });
  console.log(JSON.stringify({ ok: true, sent: true, messageId: sent.messageId }, null, 2));
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args.cmd;
  try {
    if (cmd === 'preview') await cmdPreview(args);
    else if (cmd === 'validate') await cmdValidate(args);
    else if (cmd === 'send') await cmdSend(args);
    else {
      console.error(JSON.stringify({ ok: false, error: 'unknown_command' }));
      process.exit(1);
    }
  } catch (e) {
    console.error(JSON.stringify({ ok: false, sent: false, error: e instanceof Error ? e.message : String(e) }));
    process.exit(1);
  }
}

export { cmdPreview, cmdValidate, parseArgs };
