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
    assert.equal(sb.qualifiedTraffic, 44);
    assert.equal(sb.totalTraffic, 50);
    assert.equal(sb.signups, 0);
    assert.equal(sb.completedProfiles, 0);
    assert.equal(sb.payingCustomers, 0);
    assert.equal(sb.revenue, '$0.00');
    assert.equal(sb.visitorToSignup, '0.0%');
    assert.equal(sb.signupToProfile, '0.0%');
    assert.equal(sb.profileToInteraction, '0.0%');
    assert.equal(sb.primaryBottleneck, 'TRAFFIC');
    assert.equal(sb.decision, 'HOLD / KEEP / COLLECT DATA');
    assert.match(sb.nextAction, /Daily multi-mode owned social/i);
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

  it('evaluates PAYMENT bottleneck when profiles and interactions exist but 0 paying customers', () => {
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
    assert.equal(sb.primaryBottleneck, 'PAYMENT');
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

    // Plain text verification:
    assert.match(text, /BUSINESS SCOREBOARD \(HOLD \/ COLLECT DATA PHASE\)/);
    assert.match(text, /Qualified traffic 7d:\s+44 \/ 250 target/);
    assert.match(text, /External signups 7d:\s+0 \/ 10 target/);
    assert.match(text, /Verified paying customers 7d:\s+0 \/ 1–3 target/);
    assert.match(text, /Verified revenue 7d:\s+\$0\.00/);
    assert.match(text, /Visitor -> signup conversion:\s+0\.0%/);
    assert.match(text, /Signup -> profile conversion:\s+0\.0%/);
    assert.match(text, /Profile -> interaction conversion:\s+0\.0%/);
    assert.match(text, /PRIMARY BOTTLENECK: TRAFFIC/);
    assert.match(text, /NEXT ACTION: Daily multi-mode owned social/);
    assert.match(text, /DECISION: HOLD \/ KEEP \/ COLLECT DATA/);

    // EXP-002 as Acquisition Opportunity:
    assert.match(text, /EXP-002 — Atlanta partner hub and invite-code acquisition \(Acquisition Opportunity\)/);
    assert.match(text, /ACQUISITION_OPPORTUNITY/);

    // Separated metrics in Acquisition section:
    assert.match(text, /Total traffic 7d \(all sessions\): 52/);
    assert.match(text, /Qualified campaign traffic 7d \(landing visits\): 44 \/ 250 target/);
    assert.match(text, /New external signups 7d: 0 \/ 10 target/);
    assert.match(text, /Activated users 7d \(completed profiles\): 0/);
    assert.match(text, /Verified external paying customers 7d: 0 \/ 1–3 target/);
    assert.match(text, /Funnel progression: distributed -> landing visit \(44\) -> signup \(0\) -> completed profile \(0\) -> discover/);

    // HTML verification:
    assert.match(html, /Business Scoreboard/);
    assert.match(html, /Qualified traffic 7d:/);
    assert.match(html, /44<\/b> \/ 250 target/);
    assert.match(html, /PRIMARY BOTTLENECK:/);
    assert.match(html, /HOLD \/ COLLECT DATA/);
    assert.match(html, /Acquisition Opportunity/);
  });
});
