/**
 * Partner outreach copy + MIME (UTF-8 quoted-printable).
 * Never sends mail.
 */
import { createHash } from 'node:crypto';
import { decodeQuotedPrintable, encodeQuotedPrintable } from './mime-qp.mjs';

export { decodeQuotedPrintable };

export const TEMPLATE_VERSION = 'partner-v2-2026-08-14';
export const DEFAULT_FROM_NAME = 'Max from GetTrainMate';
export const DEFAULT_FROM_EMAIL = 'partners@gettrainmate.com';
export const DEFAULT_REPLY_TO = 'partners@gettrainmate.com';
export const MOJIBAKE_MARKERS = ['Â', 'â€™', 'â€œ', 'â€', 'â†’'];

export const ACTIVITY_BY_TYPE = {
  pickleball: 'pickleball',
  run_club: 'running',
  gym_crossfit_hyrox: 'training',
  trainer: 'training',
  rec_sports: 'training',
  outdoor_club: 'training'
};

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function assertNoMojibake(s, label = 'content') {
  const text = String(s ?? '');
  for (const marker of MOJIBAKE_MARKERS) {
    if (text.includes(marker)) {
      throw new Error(`Mojibake marker ${JSON.stringify(marker)} found in ${label}`);
    }
  }
}

export function messageFingerprint({ to, subject, text, templateVersion }) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        to: String(to || '').trim().toLowerCase(),
        subject: String(subject || ''),
        text: String(text || ''),
        templateVersion: String(templateVersion || '')
      })
    )
    .digest('hex');
}

export function renderPartnerCopy({
  organizationName,
  partnerUrl,
  partnerCode,
  activity = 'pickleball'
}) {
  const org = String(organizationName || '').trim();
  const url = String(partnerUrl || '').trim();
  const code = String(partnerCode || '').trim();
  const act = String(activity || 'pickleball').trim();
  if (!org || !url || !code) throw new Error('organizationName, partnerUrl, and partnerCode are required');

  const subject = `Help ${org} members find local ${act} partners`;
  const text = `Hi ${org} team,

I\u2019m Max, the founder of GetTrainMate, an Atlanta-based platform that helps people find local partners for workouts, running, pickleball, and other activities.

I created a dedicated invitation page for your community:

${url}

Partner code: ${code}

There is no cost for your organization. If you think it would be useful, would you be open to sharing the invitation with members looking for additional local ${act} partners?

I\u2019m happy to answer any questions.

Thanks,
Max
Founder, GetTrainMate
https://gettrainmate.com/

GetTrainMate does not sell partner member lists, and participation does not guarantee a match.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:20px 24px;background:#0f172a;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
              <div style="font-size:20px;font-weight:700;letter-spacing:0.02em;">GetTrainMate</div>
              <div style="font-size:13px;opacity:0.85;margin-top:4px;">Atlanta training partners</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 8px;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:16px;line-height:1.6;">
              <p style="margin:0 0 16px;">Hi ${escapeHtml(org)} team,</p>
              <p style="margin:0 0 16px;">I\u2019m Max, the founder of GetTrainMate, an Atlanta-based platform that helps people find local partners for workouts, running, pickleball, and other activities.</p>
              <p style="margin:0 0 16px;">I created a dedicated invitation page for your community.</p>
              <p style="margin:0 0 20px;text-align:center;">
                <a href="${escapeHtml(url)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;font-weight:700;">Open invitation page</a>
              </p>
              <p style="margin:0 0 8px;font-size:14px;color:#374151;">Partner code: <strong>${escapeHtml(code)}</strong></p>
              <p style="margin:0 0 16px;font-size:13px;color:#6b7280;word-break:break-all;">${escapeHtml(url)}</p>
              <p style="margin:0 0 16px;">There is no cost for your organization. If you think it would be useful, would you be open to sharing the invitation with members looking for additional local ${escapeHtml(act)} partners?</p>
              <p style="margin:0 0 24px;">I\u2019m happy to answer any questions.</p>
              <p style="margin:0 0 4px;">Thanks,</p>
              <p style="margin:0 0 2px;"><strong>Max</strong></p>
              <p style="margin:0 0 2px;font-size:14px;color:#374151;">Founder, GetTrainMate</p>
              <p style="margin:0 0 24px;font-size:14px;"><a href="https://gettrainmate.com/" style="color:#0f172a;">https://gettrainmate.com/</a></p>
              <p style="margin:0;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">GetTrainMate does not sell partner member lists, and participation does not guarantee a match.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  assertNoMojibake(subject, 'subject');
  assertNoMojibake(text, 'text');
  assertNoMojibake(html, 'html');
  if (/TRAIN-mode|not dating-first|We don.t sell member data/i.test(text)) {
    throw new Error('Forbidden opening-pitch language');
  }
  if (/Reply to this email/i.test(text)) {
    throw new Error('Do not instruct Reply-To in the body');
  }

  return {
    subject,
    text,
    html,
    templateVersion: TEMPLATE_VERSION,
    fingerprint: messageFingerprint({ to: '', subject, text, templateVersion: TEMPLATE_VERSION })
  };
}

export async function buildPartnerMime({
  fromName = DEFAULT_FROM_NAME,
  fromEmail = DEFAULT_FROM_EMAIL,
  to,
  replyTo = DEFAULT_REPLY_TO,
  bcc,
  subject,
  text,
  html
}) {
  if (!to) throw new Error('to required');
  if (!subject?.trim()) throw new Error('subject required');
  if (!text?.trim()) throw new Error('text required');
  if (!html?.trim()) throw new Error('html required');
  assertNoMojibake(subject, 'subject');
  assertNoMojibake(text, 'text');
  assertNoMojibake(html, 'html');

  const boundary = `gtm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  const fromHeader = `${fromName} <${fromEmail}>`;
  const headers = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    bcc ? `Bcc: ${bcc}` : null,
    `Reply-To: ${replyTo}`,
    `Subject: ${encodeHeaderUtf8(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    `X-GetTrainMate-Template: ${TEMPLATE_VERSION}`
  ]
    .filter(Boolean)
    .join('\r\n');

  const rawStr = [
    headers,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    encodeQuotedPrintable(text),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    encodeQuotedPrintable(html),
    `--${boundary}--`,
    ''
  ].join('\r\n');

  if (!/Content-Type:\s*text\/plain;[^]*charset="?UTF-8"?/i.test(rawStr)) {
    throw new Error('MIME missing text/plain charset=UTF-8');
  }
  if (!/Content-Type:\s*text\/html;[^]*charset="?UTF-8"?/i.test(rawStr)) {
    throw new Error('MIME missing text/html charset=UTF-8');
  }
  if (!/Content-Transfer-Encoding:\s*quoted-printable/i.test(rawStr)) {
    throw new Error('MIME missing quoted-printable');
  }
  if (!new RegExp(`^Reply-To:.*${replyTo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'mi').test(rawStr)) {
    throw new Error('MIME missing Reply-To');
  }
  if (/gmail\.com|noreply@/i.test(rawStr)) {
    throw new Error('Partner MIME must not use Gmail or noreply');
  }
  if (!/\r\n/.test(rawStr)) {
    throw new Error('MIME missing CRLF');
  }
  assertNoMojibake(rawStr, 'raw-mime');
  if (!rawStr.includes('=E2=80=99') && text.includes('\u2019')) {
    throw new Error('UTF-8 apostrophe was not quoted-printable encoded');
  }
  return Buffer.from(rawStr, 'utf8');
}

function encodeHeaderUtf8(value) {
  const s = String(value).replace(/[\r\n]+/g, ' ');
  if (/^[\x20-\x7E]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}
