import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBusinessScoreboard,
  composeGrowthEmailBody,
  defaultDecision
} from '../lib/growth-report.mjs';

describe('computeBusinessScoreboard', () => {
  it('correctly calculates metrics and flags TRAFFIC when visits < 100', () => {
    const snapshot = {
      scoreboard: {
        '7d': {
          landings: { value: 44, available: true, unit: 'events' },
          sessions: { value: 50, available: true, unit: 'sessions' },
          completed_signups: { value: 0, available: true, unit: 'users' },
          completed_profiles: { value: 0, available: true, unit: 'users' },
          discover_users: { value: 0, available: true, unit: 'users' },
          unique_paying_customers: { value: 0, available: true },
          revenue: { value: 0, available: true, unit: 'usd' }
        }
      }
    };

    const sb = computeBusinessScoreboard(snapshot, { status: 'unavailable' });
    // Prefer sessions over landing events when unique users unavailable
    assert.equal(sb.qualifiedTraffic, 50);
    assert.equal(sb.totalTraffic, 50);
    assert.equal(sb.totalSessions, 50);
    assert.equal(sb.landingEvents, 44);
    assert.equal(sb.qualifiedVisitorUnit, 'sessions');
    assert.equal(sb.signups, 0);
    assert.equal(sb.completedProfiles, 0);
    assert.equal(sb.payingCustomers, 0);
    assert.equal(sb.revenue, '$0.00');
    assert.equal(sb.visitorToSignup, '0.0%');
    assert.equal(sb.signupToProfile, 'n/a (no upstream cohort)');
    assert.equal(sb.profileToInteraction, 'n/a (no upstream cohort)');
    assert.equal(sb.primaryBottleneck, 'TRAFFIC / INSUFFICIENT SAMPLE');
    assert.equal(sb.decision, 'HOLD / KEEP / COLLECT DATA');
    assert.match(sb.nextAction, /owned social|partner outreach/i);
  });

  it('evaluates SIGNUP CONVERSION bottleneck when traffic >= 100 but signups are low', () => {
    const snapshot = {
      scoreboard: {
        '7d': {
          landings: { value: 150, available: true, unit: 'events' },
          completed_signups: { value: 1, available: true, unit: 'users' },
          completed_profiles: { value: 1, available: true, unit: 'users' },
          discover_users: { value: 1, available: true, unit: 'users' },
          unique_paying_customers: { value: 0, available: true },
          revenue: { value: 0, available: true, unit: 'usd' }
        }
      }
    };

    const sb = computeBusinessScoreboard(snapshot, { status: 'unavailable' });
    assert.equal(sb.qualifiedTraffic, 150);
    assert.equal(sb.signups, 1);
    assert.equal(sb.visitorToSignup, '0.7%');
    assert.equal(sb.primaryBottleneck, 'SIGNUP CONVERSION');
    assert.equal(sb.decision, 'EVALUATE_SIGNUP_FLOW');
  });

  it('evaluates ACTIVATION bottleneck when signups exist but profiles are not completed', () => {
    const snapshot = {
      scoreboard: {
        '7d': {
          landings: { value: 200, available: true, unit: 'events' },
          completed_signups: { value: 20, available: true, unit: 'users' },
          completed_profiles: { value: 2, available: true, unit: 'users' },
          discover_users: { value: 1, available: true, unit: 'users' },
          unique_paying_customers: { value: 0, available: true },
          revenue: { value: 0, available: true, unit: 'usd' }
        }
      }
    };

    const sb = computeBusinessScoreboard(snapshot, { status: 'unavailable' });
    assert.equal(sb.qualifiedTraffic, 200);
    assert.equal(sb.signups, 20);
    assert.equal(sb.visitorToSignup, '10.0%');
    assert.equal(sb.signupToProfile, '10.0%');
    assert.equal(sb.primaryBottleneck, 'ACTIVATION');
  });

  it('evaluates MONETIZATION bottleneck when profiles and interactions exist but 0 paying customers', () => {
    const snapshot = {
      scoreboard: {
        '7d': {
          landings: { value: 250, available: true, unit: 'events' },
          completed_signups: { value: 25, available: true, unit: 'users' },
          completed_profiles: { value: 20, available: true, unit: 'users' },
          discover_users: { value: 15, available: true, unit: 'users' },
          unique_paying_customers: { value: 0, available: true },
          revenue: { value: 0, available: true, unit: 'usd' }
        }
      }
    };

    const sb = computeBusinessScoreboard(snapshot, { status: 'unavailable' });
    assert.equal(sb.primaryBottleneck, 'MONETIZATION');
  });
});

describe('report rendering with Business Scoreboard', () => {
  it('renders Business Scoreboard at top of text and HTML with targets and bottleneck', () => {
    const snapshot = {
      sources: { ga4: 'ok', stripe: 'ok' },
      scoreboard: {
        '7d': {
          landings: { value: 44, available: true, unit: 'events' },
          sessions: { value: 52, available: true, unit: 'sessions' },
          completed_signups: { value: 0, available: true, unit: 'users' },
          completed_profiles: { value: 0, available: true, unit: 'users' },
          discover_users: { value: 0, available: true, unit: 'users' },
          unique_paying_customers: { value: 0, available: true },
          revenue: { value: 0, available: true }
        },
        '30d': {
          landings: { value: 180, available: true },
          completed_profiles: { value: 21, available: true },
          unique_paying_customers: { value: 0, available: true },
          revenue: { value: 0, available: true }
        }
      },
      reconciliation: { ok: true, warnings: [] },
      marketplaceDensity: { status: 'unavailable' },
      ownedSocial: {
        mode: 'TRAIN',
        language: 'en',
        facebook: { published: true, postId: 'FB_123', campaign: 'owned-facebook-train-en-20260907' },
        instagram: { published: true, postId: 'IG_456', campaign: 'owned-instagram-train-en-20260907' },
        metaAuth: { status: 'META_VALID', authentication: 'VALID' }
      }
    };

    const { text, html } = composeGrowthEmailBody({
      snapshot,
      health: { ok: true, checks: [{ name: 'api', ok: true }] },
      experiments: [],
      generatedAt: new Date('2026-09-07T14:30:00Z')
    });

    // Plain text verification — acquisition-first report
    assert.match(text, /ARE WE GETTING CUSTOMERS\?/);
    assert.match(text, /7-DAY ACQUISITION FUNNEL/);
    assert.match(text, /External unique visitors:/);
    assert.match(text, /External sessions:/);
    assert.match(text, /Landing page view events:/);
    assert.match(text, /Signups:\s+0 \/ 10 target/);
    assert.match(text, /Paying customers:\s+0 \/ 1–3 target/);
    assert.match(text, /PRIMARY BOTTLENECK: TRAFFIC/);
    assert.match(text, /DECISION: HOLD \/ KEEP \/ COLLECT DATA/);
    assert.match(text, /MAX — ACTION REQUIRED/);

    // EXP-002 partner CRM section
    assert.match(text, /EXP-002 — Partner Outreach/);

    // Separated traffic metrics (events ≠ visitors)
    assert.match(text, /External sessions 7d:/);
    assert.match(text, /Landing page view events 7d:/);
    assert.match(text, /New external signups 7d: 0 \/ 10 target/);
    assert.match(text, /Verified external paying customers 7d: 0 \/ 1–3 target/);

    // HTML verification:
    assert.match(html, /Customer Acquisition CRM/);
    assert.match(html, /PRIMARY BOTTLENECK:/);
    assert.match(html, /Max — Action Required/);
    assert.doesNotMatch(html, /Open Approvals → APPROVE/);
    assert.doesNotMatch(text, /Initial outreach sends only via Approvals/);
  });

  it('does not tell Max to open Approvals when awaitingApproval is 0', () => {
    const { text, html } = composeGrowthEmailBody({
      snapshot: {
        sources: { ga4: 'ok', stripe: 'ok' },
        scoreboard: {
          '7d': {
            sessions: { value: 103, available: true, unit: 'sessions' },
            active_users: { value: 92, available: true, unit: 'users' },
            completed_signups: { value: 0, available: true, unit: 'users' },
            completed_profiles: { value: 0, available: true, unit: 'users' },
            discover_users: { value: 0, available: true, unit: 'users' },
            unique_paying_customers: { value: 0, available: true },
            revenue: { value: 0, available: true },
            unattributed_live_payments: { value: 1, available: true, unit: 'payments' },
          },
          '30d': {
            unique_paying_customers: { value: 0, available: true },
            revenue: { value: 0, available: true },
            unattributed_live_payments: { value: 1, available: true, unit: 'payments' },
          },
        },
        reconciliation: { ok: true, warnings: [] },
        partnerOutreach: {
          status: 'ok',
          prospects: 23,
          contacts: 13,
          needContact: 10,
          draftsPrepared: 0,
          awaitingApproval: 0,
          recipientsApproved: 0,
          emailsSent: 14,
          emailsSentToday: 0,
          emailsSent7d: 0,
          emailsSentLifetime: 14,
          partnerResponses: 0,
          interested: 0,
          partners: 1,
          partners7d: 0,
          partnersLifetime: 1,
          partnerAttributedSignups: 1,
          partnerAttributedSignups7d: 0,
          partnerAttributedSignupsLifetime: 1,
          customersAcquired: 0,
          ownerAction: 'Partner acquisition automation is operating normally. No owner action required.',
          ownerActions: [
            {
              id: 'none',
              text: 'Partner acquisition automation is operating normally. No owner action required.',
            },
          ],
          contactsAdminUrl: 'https://gettrainmate.com/admin/partner-outreach?tab=prospects',
          settings: {
            pauseAllOutreach: false,
            automaticSending: true,
            dryRun: false,
            dailyLimit: 100,
            remaining: 100,
            sesRemaining: 48000,
            deliveredTracking: 'NOT TRACKED',
            autoDiscoverContacts: true,
            sendQualifiedAutomatically: true,
          },
        },
      },
      health: { ok: true, checks: [{ name: 'api', ok: true }] },
      experiments: [],
      generatedAt: new Date('2026-09-23T14:30:00Z'),
    });

    assert.match(text, /Partner acquisition automation is operating normally/);
    assert.match(text, /Need contact:\s+10/);
    assert.match(text, /Automatic:\s+ON/);
    assert.match(text, /Dry Run:\s+OFF/);
    assert.match(text, /Daily Limit:\s+100/);
    assert.match(text, /PRIMARY BOTTLENECK: TRAFFIC \/ INSUFFICIENT SAMPLE/);
    assert.match(text, /Unattributed payment: 1 — UNKNOWN/);
    assert.doesNotMatch(text, /Discover contacts for 10 prospects/);
    assert.doesNotMatch(text, /Approvals → APPROVE/);
    assert.doesNotMatch(text, /OPEN APPROVALS/);
    assert.doesNotMatch(html, /OPEN APPROVALS/);
    assert.doesNotMatch(html, /DISCOVER CONTACTS/);
    assert.match(text, /Facebook publishing: .* \(technical success\)/);
    assert.match(text, /Attributed visits: .*acquisition/);
  });
});
