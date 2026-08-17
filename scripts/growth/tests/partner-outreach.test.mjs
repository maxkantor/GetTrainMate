import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  MOJIBAKE_MARKERS,
  TEMPLATE_VERSION,
  assertNoMojibake,
  buildPartnerMime,
  decodeQuotedPrintable,
  escapeHtml,
  messageFingerprint,
  renderPartnerCopy
} from '../lib/partner-email.mjs';
import {
  DAILY_SEND_LIMIT,
  assertCanSend,
  isScheduledAutomation,
  isSendEnabled,
  loadApprovals
} from '../lib/partner-outreach-auth.mjs';
import { fetchMetroDensity } from '../lib/crm-metro.mjs';
import { composeGrowthEmailBody } from '../lib/growth-report.mjs';
import { buildAdminMime } from '../lib/admin-email-mime.mjs';
import { EXP001, EXP002 } from '../lib/metric-definitions.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../../..');

function sampleCopy() {
  return renderPartnerCopy({
    organizationName: 'Example Pickleball Club',
    partnerUrl: 'https://gettrainmate.com/partners/atlanta/atl-example-pickleball',
    partnerCode: 'atl-example-pickleball',
    activity: 'pickleball'
  });
}

describe('partner email UTF-8 / MIME', () => {
  it('keeps UTF-8 apostrophes and rejects mojibake markers', async () => {
    const copy = sampleCopy();
    assert.match(copy.text, /I\u2019m Max/);
    assert.match(copy.subject, /Help Example Pickleball Club members find local pickleball partners/);
    assert.doesNotMatch(copy.text, /TRAIN-mode|not dating-first|Reply to this email/);
    assertNoMojibake(copy.html);
    for (const m of MOJIBAKE_MARKERS) assert.equal(copy.html.includes(m), false);

    const raw = (await buildPartnerMime({
      to: 'partners@example.test',
      replyTo: 'partners@gettrainmate.com',
      subject: copy.subject,
      text: copy.text,
      html: copy.html
    })).toString('utf8');

    assert.match(raw, /Content-Type:\s*text\/plain;\s*charset=UTF-8/i);
    assert.match(raw, /Content-Type:\s*text\/html;\s*charset=UTF-8/i);
    assert.match(raw, /Content-Transfer-Encoding:\s*quoted-printable/i);
    assert.match(raw, /^Reply-To:.*partners@gettrainmate.com/mi);
    assert.match(raw, /\r\n/);
    assertNoMojibake(raw, 'raw');
    const decoded = decodeQuotedPrintable(raw);
    assert.match(decoded, /I\u2019m Max/);
    assert.doesNotMatch(decoded, /Weâ€™re|donâ€™t|Â/);
  });

  it('escapes HTML in organization fields', () => {
    const copy = renderPartnerCopy({
      organizationName: 'Club <script>alert(1)</script>',
      partnerUrl: 'https://gettrainmate.com/partners/atlanta/x',
      partnerCode: 'x',
      activity: 'pickleball'
    });
    assert.match(copy.html, /Club &lt;script&gt;/);
    assert.equal(copy.html.includes('<script>alert'), false);
    assert.equal(escapeHtml('<b>'), '&lt;b&gt;');
  });

  it('includes mobile-friendly markup', () => {
    const copy = sampleCopy();
    assert.match(copy.html, /max-width:560px/);
    assert.match(copy.html, /viewport/);
    assert.match(copy.html, /Open invitation page/);
    assert.doesNotMatch(copy.html, /fonts\.google|tracking\.gif|pixel/i);
  });
});

describe('partner outreach authorization', () => {
  const copy = sampleCopy();
  const intended = {
    to: 'partners@example.test',
    subject: copy.subject,
    text: copy.text,
    templateVersion: TEMPLATE_VERSION
  };

  function writeApprovals(dir, extra = {}) {
    const fp = messageFingerprint(intended);
    const file = path.join(dir, 'approvals.json');
    fs.writeFileSync(
      file,
      JSON.stringify({
        approvals: [
          {
            approvalId: 'appr-example-001',
            status: 'approved',
            recipient: 'partners@example.test',
            subject: copy.subject,
            templateVersion: TEMPLATE_VERSION,
            approvedAt: '2026-08-14T18:00:00.000Z',
            messageFingerprint: fp,
            ...extra
          }
        ]
      }),
      'utf8'
    );
    return file;
  }

  it('defaults send disabled and scheduled automation blocked', () => {
    assert.equal(isSendEnabled({}), false);
    assert.equal(isScheduledAutomation({ GROWTH_SCHEDULED_AUTOMATION: 'true' }, []), true);
    assert.equal(DAILY_SEND_LIMIT, 3);
  });

  it('preview never sends', () => {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/growth/outreach.mjs'), 'preview'], {
      encoding: 'utf8',
      cwd: ROOT
    });
    assert.equal(r.status, 0);
    const out = JSON.parse(r.stdout);
    assert.equal(out.sent, false);
  });

  it('scheduled automation never sends', () => {
    const r = spawnSync(
      process.execPath,
      [path.join(ROOT, 'scripts/growth/outreach.mjs'), 'send', '--approval-id', 'x', '--send'],
      {
        encoding: 'utf8',
        cwd: ROOT,
        env: { ...process.env, GROWTH_SCHEDULED_AUTOMATION: 'true', PARTNER_OUTREACH_SEND_ENABLED: 'true' }
      }
    );
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /scheduled_automation_blocked/);
  });

  it('legacy send script is disabled', () => {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/growth/send-atlanta-partner-outreach.mjs')], {
      encoding: 'utf8',
      cwd: ROOT
    });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /partner_outreach_send_disabled/);
  });

  it('rejects missing send flag, missing approval, mismatched recipient/version, duplicates, and daily limit', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gtm-appr-'));
    const approvalsPath = writeApprovals(dir);
    const ledgerPath = path.join(dir, 'ledger.json');
    const env = { PARTNER_OUTREACH_SEND_ENABLED: 'true' };

    assert.equal(
      assertCanSend({ env, argv: [], approvalId: 'appr-example-001', sendFlag: false, approvalsPath, ledgerPath, intended }).code,
      'missing_send_flag'
    );
    assert.equal(
      assertCanSend({
        env: {},
        argv: [],
        approvalId: 'appr-example-001',
        sendFlag: true,
        approvalsPath,
        ledgerPath,
        intended
      }).code,
      'send_disabled'
    );
    assert.equal(
      assertCanSend({ env, argv: [], approvalId: null, sendFlag: true, approvalsPath, ledgerPath, intended }).code,
      'missing_approval_id'
    );
    assert.equal(
      assertCanSend({
        env,
        argv: [],
        approvalId: 'nope',
        sendFlag: true,
        approvalsPath,
        ledgerPath,
        intended
      }).code,
      'missing_authorization_record'
    );
    assert.equal(
      assertCanSend({
        env,
        argv: [],
        approvalId: 'appr-example-001',
        sendFlag: true,
        approvalsPath,
        ledgerPath,
        intended: { ...intended, to: 'other@example.test' }
      }).code,
      'mismatched_recipient'
    );
    assert.equal(
      assertCanSend({
        env,
        argv: [],
        approvalId: 'appr-example-001',
        sendFlag: true,
        approvalsPath,
        ledgerPath,
        intended: { ...intended, templateVersion: 'old' }
      }).code,
      'mismatched_message_version'
    );

    fs.writeFileSync(
      ledgerPath,
      JSON.stringify({
        sends: [
          {
            approvalId: 'appr-example-001',
            to: intended.to,
            fingerprint: messageFingerprint(intended),
            status: 'accepted',
            at: new Date().toISOString()
          }
        ]
      }),
      'utf8'
    );
    assert.equal(
      assertCanSend({ env, argv: [], approvalId: 'appr-example-001', sendFlag: true, approvalsPath, ledgerPath, intended }).code,
      'duplicate_send'
    );

    const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'gtm-lim-'));
    const ap2 = writeApprovals(dir2);
    const led2 = path.join(dir2, 'ledger.json');
    const today = new Date().toISOString();
    fs.writeFileSync(
      led2,
      JSON.stringify({
        sends: [
          { approvalId: 'a', to: 'a@example.test', status: 'accepted', at: today },
          { approvalId: 'b', to: 'b@example.test', status: 'accepted', at: today },
          { approvalId: 'c', to: 'c@example.test', status: 'accepted', at: today }
        ]
      }),
      'utf8'
    );
    assert.equal(
      assertCanSend({ env, argv: [], approvalId: 'appr-example-001', sendFlag: true, approvalsPath: ap2, ledgerPath: led2, intended }).code,
      'daily_send_limit'
    );
  });

  it('rejects wildcard approvals', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gtm-wild-'));
    const file = path.join(dir, 'a.json');
    fs.writeFileSync(file, JSON.stringify({ approvals: [{ approvalId: 'x', approveAll: true }] }));
    assert.throws(() => loadApprovals(file));
  });
});

describe('admin growth email reply-to', () => {
  it('does not use Gmail on the Admin notify path', () => {
    const notify = fs.readFileSync(path.join(ROOT, 'scripts/growth/notify-admin-email.mjs'), 'utf8');
    const raw = fs.readFileSync(path.join(ROOT, 'scripts/growth/ses-send-raw.mjs'), 'utf8');
    assert.match(notify, /partners@gettrainmate\.com/);
    assert.doesNotMatch(notify, /gettrainmate@gmail\.com/);
    assert.match(raw, /partners@gettrainmate\.com/);
    assert.doesNotMatch(raw, /gettrainmate@gmail\.com/);
    assert.match(raw, /buildAdminMime/);
  });

  it('allows a Gmail Admin To address while forbidding Gmail From/Reply-To', async () => {
    const raw = (
      await buildAdminMime({
        fromEmail: 'hello@gettrainmate.com',
        to: 'gettrainmate@gmail.com',
        replyTo: 'partners@gettrainmate.com',
        subject: 'GetTrainMate Growth',
        text: 'Required owner approval: YES',
        html: '<p>Required owner approval: YES</p>'
      })
    ).toString('utf8');
    assert.match(raw, /To: gettrainmate@gmail.com/);
    assert.match(raw, /Reply-To: partners@gettrainmate.com/);
    await assert.rejects(
      () =>
        buildAdminMime({
          fromEmail: 'hello@gettrainmate.com',
          to: 'gettrainmate@gmail.com',
          replyTo: 'gettrainmate@gmail.com',
          subject: 'x',
          text: 'x',
          html: '<p>x</p>'
        }),
      /From\/Reply-To must not use Gmail/
    );
  });
});

describe('metro configuration', () => {
  it('returns controlled 503-style payload when token is missing', async () => {
    const prev = process.env.GROWTH_METRO_READ_TOKEN;
    const admin = process.env.GROWTH_CRM_ADMIN_TOKEN;
    delete process.env.GROWTH_METRO_READ_TOKEN;
    delete process.env.GROWTH_CRM_ADMIN_TOKEN;
    delete process.env.GROWTH_CRM_ADMIN_EMAIL;
    delete process.env.GROWTH_CRM_ADMIN_PASSWORD;
    const metro = await fetchMetroDensity();
    assert.equal(metro.status, 'unavailable');
    assert.equal(metro.cause, 'GROWTH_METRO_READ_TOKEN is not configured');
    assert.equal(metro.httpStatus, 503);
    assert.equal(metro.customerDataExposed, false);
    if (prev) process.env.GROWTH_METRO_READ_TOKEN = prev;
    if (admin) process.env.GROWTH_CRM_ADMIN_TOKEN = admin;
  });
});

describe('growth report experiments and technical details', () => {
  it('shows EXP-001 and EXP-002 dates and owner actions without duplicated notes', () => {
    const { text, html } = composeGrowthEmailBody({
      snapshot: {
        sources: { ga4: 'ok', stripe: 'ok', adminCrm: 'unavailable' },
        scoreboard: {
          '7d': {
            landings: { value: 3, available: true, unit: 'events' },
            completed_signups: { value: 0, available: true, unit: 'users' },
            completed_profiles: { value: 0, available: true, unit: 'users' },
            discover_users: { value: 0, available: true, unit: 'users' },
            connections_sent: { value: 0, available: true, unit: 'events' },
            matches_created: { value: 0, available: true, unit: 'events' },
            first_messages: { value: 0, available: true, unit: 'events' },
            live_payments: { value: 0, available: true, unit: 'payments' },
            unattributed_live_payments: { value: 2, available: true, unit: 'payments' },
            unique_paying_customers: { value: 0, available: true, unit: 'customers' },
            revenue: { value: 0, available: true, unit: 'usd' }
          },
          '30d': {
            landings: { value: 16, available: true, unit: 'events' },
            completed_signups: { value: 1, available: true, unit: 'users' },
            completed_profiles: { value: 1, available: true, unit: 'users' },
            discover_users: { value: 0, available: true, unit: 'users' },
            connections_sent: { value: 2, available: true, unit: 'events' },
            matches_created: { value: 0, available: true, unit: 'events' },
            first_messages: { value: 0, available: true, unit: 'events' },
            live_payments: { value: 0, available: true, unit: 'payments' },
            unattributed_live_payments: { value: 1, available: true, unit: 'payments' },
            unique_paying_customers: { value: 0, available: true, unit: 'customers' },
            revenue: { value: 0, available: true, unit: 'usd' }
          }
        },
        reconciliation: { ok: true, warnings: [] },
        marketplaceDensity: {
          status: 'unavailable',
          cause: 'GROWTH_METRO_READ_TOKEN is not configured',
          httpStatus: 503,
          errorCode: 'metro_token_unconfigured',
          customerDataExposed: false
        },
        experimentAttribution: {
          '30d': {
            path: '/atlanta-training-partners',
            landings: { value: 2, available: true },
            signup_starts: { value: 0, available: true },
            completed_signups: { value: 0, available: true },
            attributed_paid_conversions: { available: false, label: 'Unknown' },
            evaluationDate: '2026-08-16'
          }
        },
        partnerOutreach: {
          partnerPagesCreated: 10,
          inviteCodesCreated: 10,
          draftsPrepared: 9,
          recipientsApproved: 0,
          emailsSent: 0,
          delivered: 'Unknown'
        }
      },
      health: { ok: true, checks: [{ name: 'homepage', ok: true }] },
      experiments: [
        {
          idLine: '2026-08-12 - EXP-001 Atlanta training partners landing page',
          status: 'active',
          evalDate: '2026-08-16',
          funnelStage: 'acquisition / SEO',
          commit: '4c8612a',
          amplify: 'jobs 460-462 SUCCEED'
        },
        {
          idLine: '2026-08-13 - EXP-002 Atlanta partner invite landings',
          status: 'active',
          evalDate: '2026-08-27',
          funnelStage: 'partner acquisition infrastructure',
          commit: '8b67f80'
        }
      ],
      notes: 'short note',
      generatedAt: new Date('2026-08-14T16:00:00Z')
    });

    assert.match(text, /EXP-001 — Atlanta training-partners landing page/);
    assert.match(text, /EXP-002 — Atlanta partner hub and invite-code acquisition/);
    assert.match(text, new RegExp(EXP001.evaluationNote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(text, /Thursday, August 27, 2026/);
    assert.match(text, /Sunday, August 16, 2026/);
    assert.match(text, /Owner action required:/);
    assert.match(text, /Configure the metro read token/);
    assert.match(text, /Incomplete — product allowlist not configured/);
    assert.match(text, /Metro CRM: Unavailable/);
    assert.match(text, /Cause: GROWTH_METRO_READ_TOKEN is not configured/);
    assert.match(text, /HTTP status: 503 Configuration unavailable/);
    assert.match(text, /Customer data exposed: No/);
    assert.match(text, /Drafts prepared: 9 \(not approved, not sent\)/);
    assert.match(text, /Unattributed payments: 1/);
    assert.match(html, /EXP-001 — Atlanta training-partners landing page/);
    assert.match(html, /EXP-002 — Atlanta partner hub and invite-code acquisition/);
    assert.doesNotMatch(text, /Truth rule: Only GetTrainMate-attributed Stripe payments count as revenue[\s\S]*Truth rule:/);
    assert.doesNotMatch(html, /Never include credentials[\s\S]*Never include credentials/);
    assert.match(text, /\$0\.00/);
    assert.doesNotMatch(text, /\$19\.99/);
    assert.match(text, /1\) ACQUISITION LEAD/);
    assert.match(text, /Distribution executed:/);
    assert.match(text, /Newly attributed external customers: 0/);
    assert.match(text, /New customers acquired by the current run: 0/);
    assert.match(text, /Required owner approval: YES/);
    assert.match(text, /NOT a successful acquisition run/);
    assert.match(text, /APPROVED IG-2026-08-17/);
    assert.match(text, /Instagram @gettrainmate/);
    assert.match(html, /1\) Acquisition lead/);
    assert.match(html, /New customers acquired by the current run/);
    assert.match(html, /Looking for a consistent training partner in Atlanta/);
  });

  it('parses JSON notes into the acquisition lead and does not dump raw JSON', () => {
    const { text, html } = composeGrowthEmailBody({
      snapshot: {
        sources: { ga4: 'ok', stripe: 'ok' },
        scoreboard: { '7d': {}, '30d': { unique_paying_customers: { value: 0, available: true } } },
        reconciliation: { ok: true, warnings: [] }
      },
      health: { ok: true, checks: [] },
      experiments: [],
      notes: JSON.stringify({
        distributionExecuted: 'none - test override',
        audienceChannel: 'Instagram @gettrainmate test',
        attributedVisits: '0',
        activations: '0',
        checkoutStarts: '0',
        newlyAttributedExternalCustomers: '0',
        verifiedRevenue: '$0.00',
        requiredOwnerApproval: 'YES - test blocking',
        existingCustomers: '0',
        customersObservedInWindow: '0',
        customersCausallyAttributedToExperiment: '0',
        newCustomersAcquiredByThisRun: '0'
      }),
      generatedAt: new Date('2026-08-17T16:00:00Z')
    });
    assert.match(text, /Distribution executed: none - test override/);
    assert.match(text, /Audience\/channel: Instagram @gettrainmate test/);
    assert.match(text, /Required owner approval: YES - test blocking/);
    assert.doesNotMatch(text, /Agent notes \(sanitized\): \{/);
    assert.match(html, /none - test override/);
  });
});
