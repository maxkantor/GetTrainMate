/**
 * Hard fail-closed authorization for partner outreach sends.
 * Preview/validate must never import SES send.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { messageFingerprint, TEMPLATE_VERSION } from './partner-email.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_LEDGER = path.join(__dirname, '../var/partner-send-ledger.json');
export const DAILY_SEND_LIMIT = 3;

export function isSendEnabled(env = process.env) {
  return String(env.PARTNER_OUTREACH_SEND_ENABLED || '').trim() === 'true';
}

export function isScheduledAutomation(env = process.env, argv = process.argv) {
  if (String(env.GROWTH_SCHEDULED_AUTOMATION || '').toLowerCase() === 'true') return true;
  if (String(env.CURSOR_AUTOMATION || '').toLowerCase() === 'true') return true;
  if (argv.includes('--scheduled')) return true;
  return false;
}

function loadJson(filePath, fallback) {
  if (!filePath || !fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function loadApprovals(filePath) {
  const data = loadJson(filePath, { approvals: [] });
  const list = Array.isArray(data.approvals) ? data.approvals : [];
  for (const row of list) {
    if (row.approveAll || row.wildcard || row.domain) {
      throw new Error('Wildcard / domain-wide / approve-all authorizations are not allowed');
    }
  }
  return list;
}

export function loadLedger(filePath = DEFAULT_LEDGER) {
  return loadJson(filePath, { sends: [] });
}

export function saveLedger(ledger, filePath = DEFAULT_LEDGER) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(ledger, null, 2), 'utf8');
}

export function utcDay(iso = new Date().toISOString()) {
  return String(iso).slice(0, 10);
}

export function assertCanSend({
  env = process.env,
  argv = process.argv,
  approvalId,
  sendFlag,
  approvalsPath,
  ledgerPath = DEFAULT_LEDGER,
  intended
}) {
  if (isScheduledAutomation(env, argv)) {
    return { ok: false, code: 'scheduled_automation_blocked' };
  }
  if (!sendFlag) {
    return { ok: false, code: 'missing_send_flag' };
  }
  if (!isSendEnabled(env)) {
    return { ok: false, code: 'send_disabled' };
  }
  if (!approvalId) {
    return { ok: false, code: 'missing_approval_id' };
  }
  if (!approvalsPath || !fs.existsSync(approvalsPath)) {
    return { ok: false, code: 'missing_authorization_record' };
  }

  let approvals;
  try {
    approvals = loadApprovals(approvalsPath);
  } catch (e) {
    return { ok: false, code: 'invalid_authorization', error: e instanceof Error ? e.message : String(e) };
  }

  const approval = approvals.find((a) => a.approvalId === approvalId);
  if (!approval) {
    return { ok: false, code: 'missing_authorization_record' };
  }
  if (approval.status && approval.status !== 'approved') {
    return { ok: false, code: 'not_approved' };
  }
  if (!approval.recipient || !approval.subject || !approval.templateVersion || !approval.approvedAt) {
    return { ok: false, code: 'incomplete_authorization' };
  }
  if (approval.templateVersion !== (intended.templateVersion || TEMPLATE_VERSION)) {
    return { ok: false, code: 'mismatched_message_version' };
  }
  if (String(approval.recipient).trim().toLowerCase() !== String(intended.to).trim().toLowerCase()) {
    return { ok: false, code: 'mismatched_recipient' };
  }
  if (String(approval.subject) !== String(intended.subject)) {
    return { ok: false, code: 'mismatched_subject' };
  }

  const fp = messageFingerprint({
    to: intended.to,
    subject: intended.subject,
    text: intended.text,
    templateVersion: intended.templateVersion || TEMPLATE_VERSION
  });
  if (approval.messageFingerprint && approval.messageFingerprint !== fp) {
    return { ok: false, code: 'mismatched_message_version' };
  }

  const ledger = loadLedger(ledgerPath);
  const sends = Array.isArray(ledger.sends) ? ledger.sends : [];
  if (sends.some((s) => s.approvalId === approvalId || s.fingerprint === fp)) {
    return { ok: false, code: 'duplicate_send' };
  }
  if (
    sends.some(
      (s) =>
        String(s.to || '').toLowerCase() === String(intended.to).toLowerCase() &&
        s.status === 'accepted'
    )
  ) {
    return { ok: false, code: 'recipient_already_contacted' };
  }

  const today = utcDay();
  const todayCount = sends.filter((s) => s.status === 'accepted' && utcDay(s.at) === today).length;
  if (todayCount >= DAILY_SEND_LIMIT) {
    return { ok: false, code: 'daily_send_limit' };
  }

  return { ok: true, approval, fingerprint: fp, ledgerPath };
}

export function recordAcceptedSend(ledgerPath, entry) {
  const ledger = loadLedger(ledgerPath);
  ledger.sends = Array.isArray(ledger.sends) ? ledger.sends : [];
  ledger.sends.push({ ...entry, status: 'accepted', at: entry.at || new Date().toISOString() });
  saveLedger(ledger, ledgerPath);
  return ledger;
}
