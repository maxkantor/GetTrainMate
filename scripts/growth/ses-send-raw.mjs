/**
 * SES send-raw-email using a prebuilt MIME buffer.
 * Do not use for partner outreach except via outreach.mjs send gates.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REGION = process.env.AWS_REGION || 'us-east-1';

export function sendRawMime({ fromEmail, raw }) {
  if (!fromEmail) throw new Error('fromEmail required');
  if (!raw) throw new Error('raw required');
  const tmpDir = fs.mkdtempSync(
    path.join(process.env.TEMP || process.env.TMPDIR || '/tmp', 'gtm-ses-raw-')
  );
  const jsonPath = path.join(tmpDir, 'raw-message.json');
  try {
    const b64 = Buffer.isBuffer(raw) ? raw.toString('base64') : Buffer.from(raw).toString('base64');
    fs.writeFileSync(jsonPath, JSON.stringify({ Data: b64 }), 'utf8');
    const fileUri = `file://${jsonPath.replace(/\\/g, '/')}`;
    const r = spawnSync(
      'aws',
      [
        'ses',
        'send-raw-email',
        '--region',
        REGION,
        '--from',
        fromEmail,
        '--cli-binary-format',
        'base64',
        '--raw-message',
        fileUri
      ],
      { encoding: 'utf8' }
    );
    if (r.status !== 0) {
      throw new Error((r.stderr || r.stdout || 'SES send-raw-email failed').slice(0, 500));
    }
    let messageId = null;
    try {
      messageId = JSON.parse(r.stdout || '{}').MessageId ?? null;
    } catch {
      /* ignore */
    }
    return { ok: true, messageId };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

export async function sendRawSesEmail({
  fromName = 'GetTrainMate',
  fromEmail,
  to,
  bcc,
  replyTo = 'gettrainmate@gmail.com',
  subject,
  text,
  html
}) {
  const { buildPartnerMime } = await import('./lib/partner-email.mjs');
  const raw = await buildPartnerMime({
    fromName,
    fromEmail,
    to,
    bcc,
    replyTo,
    subject,
    text,
    html: html || `<pre>${String(text || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</pre>`
  });
  return { ...sendRawMime({ fromEmail, raw }), to };
}
