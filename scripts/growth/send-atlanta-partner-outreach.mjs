#!/usr/bin/env node
/**
 * Send EXP-002 Atlanta partner outreach via SES.
 * From: verified site identity (SSM /gettrainmate/ses-from-email)
 * Reply-To: gettrainmate@gmail.com
 * BCC: Admin inbox
 *
 * Usage: node scripts/growth/send-atlanta-partner-outreach.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REGION = process.env.AWS_REGION || 'us-east-1';
const REPLY_TO = 'gettrainmate@gmail.com';

function getSsm(name) {
  const r = spawnSync(
    'aws',
    [
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
    ],
    { encoding: 'utf8' }
  );
  if (r.status !== 0) throw new Error(`SSM get failed for ${name}`);
  const value = (r.stdout || '').trim();
  if (!value || value === 'None') throw new Error(`SSM empty for ${name}`);
  return value;
}

function firstEmail(raw) {
  const first = String(raw || '')
    .split(/[,;]/)
    .map((s) => s.trim())
    .find(Boolean);
  if (!first) throw new Error('No email');
  return first;
}

function sendEmail({ from, to, bcc, subject, body }) {
  const tmpDir = fs.mkdtempSync(
    path.join(process.env.TEMP || process.env.TMPDIR || '/tmp', 'gtm-partner-mail-')
  );
  const destPath = path.join(tmpDir, 'dest.json');
  const msgPath = path.join(tmpDir, 'msg.json');
  try {
    const dest = { ToAddresses: [to] };
    if (bcc) dest.BccAddresses = [bcc];
    fs.writeFileSync(destPath, JSON.stringify(dest), 'utf8');
    fs.writeFileSync(
      msgPath,
      JSON.stringify({
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Text: { Data: body, Charset: 'UTF-8' } }
      }),
      'utf8'
    );
    const destUri = `file://${destPath.replace(/\\/g, '/')}`;
    const msgUri = `file://${msgPath.replace(/\\/g, '/')}`;
    const r = spawnSync(
      'aws',
      [
        'ses',
        'send-email',
        '--region',
        REGION,
        '--from',
        `GetTrainMate <${from}>`,
        '--reply-to',
        REPLY_TO,
        '--destination',
        destUri,
        '--message',
        msgUri
      ],
      { encoding: 'utf8' }
    );
    if (r.status !== 0) {
      throw new Error((r.stderr || r.stdout || '').slice(0, 500));
    }
    let messageId = null;
    try {
      messageId = JSON.parse(r.stdout || '{}').MessageId ?? null;
    } catch {
      /* ignore */
    }
    return { ok: true, to, messageId };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

const MESSAGES = [
  {
    code: 'atl-track-club',
    to: 'membership@atlantatrackclub.org',
    subject: 'Training-partner invite for Atlanta runners (GetTrainMate)',
    body: `Hi Atlanta Track Club team — I’m Max with GetTrainMate (gettrainmate.com). We’re helping Atlanta athletes find TRAIN-mode partners (not dating-first). We built a private invite for your community:
https://gettrainmate.com/partners/atlanta/atl-track-club
Code: atl-track-club. Members keep control of profiles; we never sell member data. Happy to share aggregated signup stats only. Would you be open to sharing this with interested runners?

Reply to this email (gettrainmate@gmail.com) anytime.
Max
GetTrainMate`
  },
  {
    code: 'atl-fleet-feet',
    to: 'joe@fleetfeetatlanta.com',
    subject: 'Invite link for Atlanta runners looking for training partners',
    body: `Hi Fleet Feet Atlanta — GetTrainMate matches people who want consistent training partners in Atlanta. Here’s a Fleet Feet–tagged invite (no obligation):
https://gettrainmate.com/partners/atlanta/atl-fleet-feet
We can report only aggregated joins from that link. Interested in a short pilot with your running groups?

Reply to this email (gettrainmate@gmail.com) anytime.
Max
GetTrainMate`
  },
  {
    code: 'atl-pickleball',
    to: 'info@atlantapickleballclub.com',
    subject: 'Training-partner invite for Atlanta pickleball players (GetTrainMate)',
    body: `Hi Atlanta Pickleball Club team — I’m Max with GetTrainMate (gettrainmate.com). We’re helping Atlanta athletes find TRAIN-mode partners (not dating-first). Invite for your community:
https://gettrainmate.com/partners/atlanta/atl-pickleball
Code: atl-pickleball. We don’t sell member data or promise matches. Would you be open to sharing this with players looking for extra hitting partners?

Reply to this email (gettrainmate@gmail.com) anytime.
Max
GetTrainMate`
  },
  {
    code: 'atl-hyrox-crossfit',
    to: 'info@eliteedgeatl.com',
    subject: 'Partner invite for HYROX / CrossFit athletes in Atlanta',
    body: `Hi Elite Edge team — GetTrainMate is TRAIN-first for Atlanta. Invite tagged for your HYROX community:
https://gettrainmate.com/partners/atlanta/atl-hyrox-crossfit
Code: atl-hyrox-crossfit. Aggregated signup stats only — no private member data. Open to a short pilot with athletes looking for a race-prep partner?

Reply to this email (gettrainmate@gmail.com) anytime.
Max
GetTrainMate`
  },
  {
    code: 'atl-tri-club',
    to: 'info@atlantatriclub.com',
    subject: 'Training-partner invite for Atlanta Tri Club members',
    body: `Hi Atlanta Triathlon Club — GetTrainMate helps Atlanta athletes find swim/bike/run training partners. Your invite:
https://gettrainmate.com/partners/atlanta/atl-tri-club
Code: atl-tri-club. No fake profiles and no match guarantees. OK if I send a one-paragraph blurb for your newsletter?

Reply to this email (gettrainmate@gmail.com) anytime.
Max
GetTrainMate`
  },
  {
    code: 'atl-softball-rec',
    to: 'havefun@atlantasportandsocialclub.com',
    subject: 'Training-partner invite for Atlanta rec-league players',
    body: `Hi JAM Sports Atlanta — GetTrainMate helps rec-league athletes find extra training partners in Atlanta (TRAIN mode). Invite:
https://gettrainmate.com/partners/atlanta/atl-softball-rec
Code: atl-softball-rec. Aggregated joins only; no member data sharing. Open to sharing with free agents looking for more consistent training?

Reply to this email (gettrainmate@gmail.com) anytime.
Max
GetTrainMate`
  },
  {
    code: 'atl-outdoor-club',
    to: 'info@atlantaoutdoorclub.com',
    subject: 'Partner invite for Atlanta Outdoor Club members who want training buddies',
    body: `Hi Atlanta Outdoor Club — GetTrainMate is TRAIN-first for Atlanta trail/park partners. Invite:
https://gettrainmate.com/partners/atlanta/atl-outdoor-club
Code: atl-outdoor-club. No guaranteed matches. May I share a short blurb for trip leaders or the newsletter?

Reply to this email (gettrainmate@gmail.com) anytime.
Max
GetTrainMate`
  }
];

const from = getSsm('/gettrainmate/ses-from-email');
const bcc = firstEmail(getSsm('/gettrainmate/ses-admin-email'));
const results = [];
for (const m of MESSAGES) {
  try {
    const sent = sendEmail({ from, to: m.to, bcc, subject: m.subject, body: m.body });
    results.push({ code: m.code, ...sent });
    console.log(JSON.stringify({ code: m.code, ok: true, messageId: sent.messageId }));
  } catch (e) {
    results.push({
      code: m.code,
      ok: false,
      to: m.to,
      error: e instanceof Error ? e.message : String(e)
    });
    console.error(JSON.stringify({ code: m.code, ok: false, error: e instanceof Error ? e.message : String(e) }));
  }
}
console.log(JSON.stringify({ summary: results }, null, 2));
if (results.some((r) => !r.ok)) process.exit(1);
