/**
 * Admin-report MIME (UTF-8 quoted-printable).
 * Allows a Gmail To: address (owner inbox). Forbids Gmail/noreply on From and Reply-To.
 * Do not use for partner outreach — that path stays on buildPartnerMime.
 */
import { encodeQuotedPrintable } from './mime-qp.mjs';
import { assertNoMojibake } from './partner-email.mjs';

function encodeHeaderUtf8(value) {
  const s = String(value).replace(/[\r\n]+/g, ' ');
  if (/^[\x20-\x7E]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}

export async function buildAdminMime({
  fromName = 'GetTrainMate Growth',
  fromEmail,
  to,
  replyTo = 'partners@gettrainmate.com',
  bcc,
  subject,
  text,
  html
}) {
  if (!to) throw new Error('to required');
  if (!fromEmail) throw new Error('fromEmail required');
  if (!subject?.trim()) throw new Error('subject required');
  if (!text?.trim()) throw new Error('text required');
  if (!html?.trim()) throw new Error('html required');
  if (/gmail\.com|noreply@/i.test(fromEmail) || /gmail\.com|noreply@/i.test(replyTo)) {
    throw new Error('Admin MIME From/Reply-To must not use Gmail or noreply');
  }
  assertNoMojibake(subject, 'subject');
  assertNoMojibake(text, 'text');
  assertNoMojibake(html, 'html');

  const boundary = `gtmadm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const headers = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    bcc ? `Bcc: ${bcc}` : null,
    `Reply-To: ${replyTo}`,
    `Subject: ${encodeHeaderUtf8(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`
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
  return Buffer.from(rawStr, 'utf8');
}
