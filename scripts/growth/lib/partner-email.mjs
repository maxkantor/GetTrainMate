/**
 * Customer acquisition outreach copy + MIME (UTF-8 quoted-printable).
 * Brand-led only — never personal founder identity or partnership pitch.
 * Never sends mail.
 */
import { createHash } from 'node:crypto';
import { decodeQuotedPrintable, encodeQuotedPrintable } from './mime-qp.mjs';

export { decodeQuotedPrintable };

export const TEMPLATE_VERSION = 'partner-v5-2026-09-21';
export const DEFAULT_FROM_NAME = 'GetTrainMate';
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

export function containsObsoleteOutreachCopy(...parts) {
  const hay = parts.map((p) => String(p ?? '')).join('\n');
  const markers = [
    "I'm Max",
    'I’m Max',
    'Founder, GetTrainMate',
    'founder of GetTrainMate',
    'Max from GetTrainMate',
    'Partner code',
    'already have a partnership',
    'Unsubscribe from partnership emails',
    'partner member lists'
  ];
  if (markers.some((m) => hay.toLowerCase().includes(m.toLowerCase()))) return true;
  return /^Thanks,?\s*\nMax\b/im.test(hay);
}

/**
 * Brand-led acquisition copy. partnerCode is accepted for API compat but never rendered.
 */
export function renderPartnerCopy({
  organizationName,
  partnerUrl,
  partnerCode,
  activity = 'pickleball',
  market = 'your area',
  unsubscribeUrl = 'https://gettrainmate.com/email/unsubscribe',
  postalAddress = ''
}) {
  const org = String(organizationName || '').trim();
  const url = String(partnerUrl || '').trim();
  const marketLabel = String(market || 'your area').trim() || 'your area';
  const unsub = String(unsubscribeUrl || '').trim();
  const postal = String(postalAddress || '').trim();
  void partnerCode;
  void activity;
  if (!org || !url) throw new Error('organizationName and partnerUrl are required');

  const subject = `Help ${org} members find local training partners`;
  const text = `Hi ${org} team,

GetTrainMate helps people connect through workouts, sports and real-world activities — from gym training and running to pickleball, tennis and more.

We're introducing GetTrainMate to fitness communities in ${marketLabel}, and thought it could be useful for ${org}.

You can try GetTrainMate yourself or share this invitation with your members:

${url}

There is no cost to share it and no integration required.

GetTrainMate
https://gettrainmate.com/

GetTrainMate does not sell member lists, and participation does not guarantee a match.
Unsubscribe: ${unsub}
${postal}`.trimEnd();

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
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:20px 24px;background:#0f172a;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
              <div style="font-size:20px;font-weight:700;letter-spacing:0.02em;">GetTrainMate</div>
              <div style="font-size:13px;opacity:0.85;margin-top:4px;">${escapeHtml(marketLabel)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:16px;line-height:1.6;">
              <p style="margin:0 0 16px;">Hi ${escapeHtml(org)} team,</p>
              <p style="margin:0 0 16px;">GetTrainMate helps people connect through workouts, sports and real-world activities — from gym training and running to pickleball, tennis and more.</p>
              <p style="margin:0 0 16px;">We're introducing GetTrainMate to fitness communities in ${escapeHtml(marketLabel)}, and thought it could be useful for ${escapeHtml(org)}.</p>
              <p style="margin:0 0 16px;">You can try GetTrainMate yourself or share this invitation with your members:</p>
              <p style="margin:0 0 20px;text-align:center;">
                <a href="${escapeHtml(url)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;font-weight:700;">Explore GetTrainMate</a>
              </p>
              <p style="margin:0 0 16px;font-size:13px;color:#6b7280;word-break:break-all;">${escapeHtml(url)}</p>
              <p style="margin:0 0 16px;">There is no cost to share it and no integration required.</p>
              <p style="margin:0 0 4px;"><strong>GetTrainMate</strong></p>
              <p style="margin:0 0 24px;font-size:14px;"><a href="https://gettrainmate.com/" style="color:#0f172a;">https://gettrainmate.com/</a></p>
              <p style="margin:0;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">GetTrainMate does not sell member lists, and participation does not guarantee a match.<br><a href="${escapeHtml(unsub)}">Unsubscribe</a><br>${escapeHtml(postal)}</p>
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
  if (containsObsoleteOutreachCopy(subject, text, html)) {
    throw new Error('Obsolete personal/partnership outreach copy detected');
  }
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
  if (containsObsoleteOutreachCopy(subject, text, html)) {
    throw new Error('Obsolete personal/partnership outreach copy blocked');
  }

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
  return Buffer.from(rawStr, 'utf8');
}

function encodeHeaderUtf8(value) {
  const s = String(value).replace(/[\r\n]+/g, ' ');
  if (/^[\x20-\x7E]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}
