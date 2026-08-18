/**
 * Growth metrics unit tests (node:test).
 * Run: node --test scripts/growth/tests/*.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  inconsistentGa4Rows,
  inconsistentGa4Rows7d,
  stripeFixture,
  legacyAliasSumScoreboard
} from '../fixtures/inconsistent-report.mjs';
import {
  aggregateGa4ByEvent,
  normalizeGa4Window,
  normalizeStripe,
  buildScoreboardRow,
  formatCell
} from '../lib/normalize-metrics.mjs';
import { loadStripeAllowlist } from '../lib/stripe-attribution.mjs';
import {
  reconcileSnapshot,
  detectAliasDoubleCount,
  applyReconciliationBlocks
} from '../lib/reconcile.mjs';
import { composeGrowthEmailBody } from '../compose-and-send-growth-email.mjs';

describe('normalizeGa4Window — no alias double-count', () => {
  it('uses signup_completed only when sign_up also present', () => {
    const byEvent = aggregateGa4ByEvent(inconsistentGa4Rows);
    const { metrics } = normalizeGa4Window(byEvent);
    assert.equal(metrics.completed_signups.value, 1);
    assert.equal(metrics.completed_signups.sourceEvent, 'signup_completed');
    assert.notEqual(metrics.completed_signups.value, 2);
    assert.notEqual(metrics.completed_signups.value, 3);
  });

  it('uses profile_completed only when onboarding_completed also present', () => {
    const byEvent = aggregateGa4ByEvent(inconsistentGa4Rows);
    const { metrics } = normalizeGa4Window(byEvent);
    assert.equal(metrics.completed_profiles.value, 1);
    assert.equal(metrics.completed_profiles.sourceEvent, 'profile_completed');
  });

  it('uses request_sent only — does not add like_or_connection_sent', () => {
    const byEvent = aggregateGa4ByEvent(inconsistentGa4Rows);
    const { metrics } = normalizeGa4Window(byEvent);
    assert.equal(metrics.connections_sent.value, 2);
    assert.notEqual(metrics.connections_sent.value, 4);
  });

  it('does not treat match_shown as matches_created', () => {
    const byEvent = aggregateGa4ByEvent(inconsistentGa4Rows);
    const { metrics } = normalizeGa4Window(byEvent);
    // match_created is 0; no fallback to match_shown
    assert.equal(metrics.matches_created.value, 0);
    assert.notEqual(metrics.matches_created.value, 17);
    assert.notEqual(metrics.matches_created.value, 34);
  });

  it('landings use landing_page_view only (not page_view)', () => {
    const byEvent = aggregateGa4ByEvent(inconsistentGa4Rows);
    const { metrics } = normalizeGa4Window(byEvent);
    assert.equal(metrics.landings.value, 16);
  });

  it('returning_users prefer totalUsers not raw event count', () => {
    const byEvent = aggregateGa4ByEvent(inconsistentGa4Rows);
    const { metrics } = normalizeGa4Window(byEvent);
    assert.equal(metrics.returning_users.value, 8);
    assert.equal(metrics.returning_users.unit, 'users');
  });
});

describe('legacy bug detection', () => {
  it('detects email pick() double-count pattern from the Aug report', () => {
    const raw = {
      signup_completed: 1,
      sign_up: 1,
      profile_completed: 1,
      onboarding_completed: 1,
      request_sent: 2,
      like_or_connection_sent: 2,
      match_created: 0,
      match_shown: 17
    };
    const legacy = legacyAliasSumScoreboard(raw);
    assert.equal(legacy.signups, 3); // (1+1)+1 email pick double-count
    assert.equal(legacy.matches, 34); // (0+17)+17
    // Profiles: stage sum (1+1)=2 then pick may add onboarding again → 3
    assert.ok(legacy.profiles >= 2);

    const det = detectAliasDoubleCount(raw, 34, 'match_created', 'match_shown');
    assert.equal(det.detected, true);
  });
});

describe('normalizeStripe', () => {
  it('excludes unattributed account-wide payments from revenue', () => {
    const s = normalizeStripe(stripeFixture);
    assert.equal(s.attributed_live_payments, 1);
    assert.equal(s.unattributed_live_payments, 1);
    assert.equal(s.test_paid_sessions, 1);
    assert.equal(s.revenue_live_usd, 9.99);
    assert.equal(s.account_wide_live_sessions, 2);
    // Baseline until reconciliationComplete
    assert.equal(s.unique_paying_customers, 0);
    assert.equal(s.unique_paying_customers_method, 'verified_business_baseline');
  });

  it('does not count unknown-attribution sessions as this app', () => {
    const s = normalizeStripe({
      sessions: {
        data: [
          {
            id: 'cs_live_2',
            livemode: true,
            status: 'complete',
            payment_status: 'paid',
            amount_total: 1999,
            customer: 'cus_x',
            payment_intent: 'pi_2',
            metadata: {}
          }
        ]
      },
      charges: { data: [] }
    });
    assert.equal(s.attributed_live_payments, 0);
    assert.equal(s.unattributed_live_payments, 1);
    assert.equal(s.revenue_live_usd, 0);
    assert.equal(s.unique_paying_customers, 0);
  });

  it('attributes gtm_source metadata and excludes owner customer ids', () => {
    const allowlist = loadStripeAllowlist();
    allowlist.excludeCustomerIds.add('cus_owner');
    allowlist.reconciliationComplete = true;
    const s = normalizeStripe(
      {
        sessions: {
          data: [
            {
              id: 'cs_a',
              livemode: true,
              status: 'complete',
              payment_status: 'paid',
              amount_total: 599,
              customer: 'cus_ext',
              payment_intent: 'pi_a',
              metadata: { gtm_source: 'gettrainmate' }
            },
            {
              id: 'cs_b',
              livemode: true,
              status: 'complete',
              payment_status: 'paid',
              amount_total: 599,
              customer: 'cus_owner',
              payment_intent: 'pi_b',
              metadata: { gtm_source: 'gettrainmate' }
            }
          ]
        },
        charges: { data: [] }
      },
      allowlist
    );
    assert.equal(s.attributed_live_payments, 1);
    assert.equal(s.revenue_live_usd, 5.99);
    assert.equal(s.unique_paying_customers, 1);
  });
});

describe('reconcileSnapshot', () => {
  it('flags 7d exceeding 30d', () => {
    const cell = (v) => ({ value: v, available: true, unit: 'events' });
    const r = reconcileSnapshot({
      scoreboard7d: { landings: cell(10), live_payments: cell(0), unique_paying_customers: { value: null, available: false }, revenue: cell(0) },
      scoreboard30d: { landings: cell(5), live_payments: cell(0), unique_paying_customers: { value: null, available: false }, revenue: cell(0) }
    });
    assert.equal(r.ok, false);
    assert.ok(r.warnings.some((w) => /7d landings/.test(w)));
  });

  it('flags unique customers > payments', () => {
    const r = reconcileSnapshot({
      scoreboard7d: {
        live_payments: { value: 1, available: true },
        unique_paying_customers: { value: 3, available: true },
        revenue: { value: 10, available: true }
      },
      scoreboard30d: {
        live_payments: { value: 1, available: true },
        unique_paying_customers: { value: 3, available: true },
        revenue: { value: 10, available: true }
      }
    });
    assert.equal(r.ok, false);
  });

  it('applyReconciliationBlocks marks Unknown', () => {
    const board = {
      landings: { value: 10, available: true, unit: 'events' }
    };
    const out = applyReconciliationBlocks(board, ['7d.landings'], '7d');
    assert.equal(out.landings.available, false);
    assert.equal(out.landings.value, null);
  });
});

describe('buildScoreboardRow + compose email', () => {
  it('corrected scoreboard cannot show doubled profiles/connections/matches', () => {
    const by30 = aggregateGa4ByEvent(inconsistentGa4Rows);
    const by7 = aggregateGa4ByEvent(inconsistentGa4Rows7d);
    const n30 = normalizeGa4Window(by30);
    const n7 = normalizeGa4Window(by7);
    const stripe = normalizeStripe(stripeFixture);
    const b30 = buildScoreboardRow(n30, stripe);
    const b7 = buildScoreboardRow(n7, normalizeStripe({ sessions: { data: [] }, charges: { data: [] } }));

    assert.equal(b30.completed_signups.value, 1);
    assert.equal(b30.completed_profiles.value, 1);
    assert.equal(b30.connections_sent.value, 2);
    assert.equal(b30.matches_created.value, 0);
    assert.notEqual(b30.matches_created.value, 34);
    assert.equal(b30.live_payments.value, 1);
    assert.equal(b30.unattributed_live_payments.value, 1);
    assert.equal(b30.unique_paying_customers.value, 0); // verified baseline until reconciliation
    assert.equal(b30.revenue.value, 9.99);

    // 7d landings <= 30d
    assert.ok(b7.landings.value <= b30.landings.value);

    const snapshot = {
      sources: { ga4: 'ok', stripe: 'ok', adminCrm: 'unavailable' },
      scoreboard: { '7d': b7, '30d': b30 },
      reconciliation: { ok: true, warnings: [] },
      marketplaceDensity: {
        status: 'unavailable',
        reason: 'test'
      },
      experimentAttribution: {
        '30d': {
          path: '/atlanta-training-partners',
          landings: { value: 0, available: true },
          signup_starts: { value: 0, available: true },
          completed_signups: { value: 0, available: true },
          landing_to_signup_start: null,
          landing_to_completed_signup: null,
          evaluationDate: '2026-08-26'
        }
      }
    };

    const { text, html } = composeGrowthEmailBody({
      snapshot,
      health: { ok: true, checks: [{ name: 'homepage', ok: true }] },
      experiments: [
        {
          idLine: '2026-08-12 - EXP-001 Atlanta training partners landing page',
          status: 'active',
          funnelStage: 'acquisition / SEO',
          targetMetro: 'Atlanta, Georgia · TRAIN',
          evalDate: '2026-08-16',
          primaryMetric: 'signup_completed from Atlanta landing',
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
      notes: 'Fixture validation',
      generatedAt: new Date('2026-08-13T16:00:00Z'),
      shipped: false
    });

    assert.match(text, /6\) DECISION/);
    assert.match(text, /1\) GETTRAINMATE GLOBAL GROWTH/);
    assert.match(text, /Newly attributed external customers/);
    assert.match(text, /America\/New_York|EDT|EST/);
    assert.match(text, /Attributed paid conversions: Unknown/);
    assert.doesNotMatch(text, /Amplify Amplify/);
    assert.doesNotMatch(html, /Amplify Amplify/);
    // Must not show doubled values
    assert.doesNotMatch(text, /\b34\b/);
    assert.doesNotMatch(html, />34</);
    assert.match(text, /Unavailable|0/); // matches_created is 0
    assert.equal(formatCell(b30.matches_created), '0');
  });

  it('does not attribute $19.99 to EXP-001 without evidence', () => {
    const by30 = aggregateGa4ByEvent(inconsistentGa4Rows);
    const n30 = normalizeGa4Window(by30);
    const stripe = normalizeStripe(stripeFixture);
    const b30 = buildScoreboardRow(n30, stripe);
    const { text } = composeGrowthEmailBody({
      snapshot: {
        sources: { ga4: 'ok', stripe: 'ok' },
        scoreboard: {
          '7d': buildScoreboardRow(normalizeGa4Window(aggregateGa4ByEvent(inconsistentGa4Rows7d)), null),
          '30d': b30
        },
        reconciliation: { ok: true, warnings: [] },
        marketplaceDensity: { status: 'unavailable' },
        experimentAttribution: {
          '30d': {
            path: '/atlanta-training-partners',
            landings: { value: 2, available: true },
            signup_starts: { value: 0, available: true },
            completed_signups: { value: 0, available: true },
            evaluationDate: '2026-08-16'
          }
        }
      },
      health: { ok: true, checks: [] },
      experiments: [
        {
          idLine: '2026-08-12 - EXP-001',
          status: 'active',
          evalDate: '2026-08-16',
          funnelStage: 'acquisition / SEO',
          commit: '4c8612a'
        }
      ],
      generatedAt: new Date('2026-08-13T16:00:00Z')
    });
    assert.match(text, /Attributed paid conversions: Unknown/);
    assert.match(text, /Attributed revenue: \$0\.00/);
    assert.doesNotMatch(text, /\$19\.99/); // unattributed must not appear as revenue
    assert.doesNotMatch(text, /\$9\.99/); // attributed-but-unreconciled amounts are not verified revenue
    assert.match(text, /Unattributed payments/i);
  });
});

describe('EXP-001 Stripe attribution', () => {
  it('returns Unknown when live payments lack acquisition metadata', async () => {
    const { attributeExp001PaidConversions } = await import('../lib/exp001-attribution.mjs');
    const result = attributeExp001PaidConversions([
      { livemode: true, payment_status: 'paid', metadata: { userId: 'u1', packKey: 'go' } }
    ]);
    assert.equal(result.available, false);
    assert.equal(result.label, 'Unknown');
  });

  it('counts EXP-001 when acquisition_source matches', async () => {
    const { attributeExp001PaidConversions } = await import('../lib/exp001-attribution.mjs');
    const result = attributeExp001PaidConversions([
      {
        metadata: {
          acquisition_source: 'atlanta-training-partners',
          experiment_id: 'EXP-001'
        }
      },
      { metadata: { acquisition_source: 'homepage' } }
    ]);
    assert.equal(result.available, true);
    assert.equal(result.value, 1);
  });

  it('does not attribute generic homepage payment as EXP-001', async () => {
    const { attributeExp001PaidConversions } = await import('../lib/exp001-attribution.mjs');
    const result = attributeExp001PaidConversions([
      { metadata: { acquisition_source: 'homepage', utm_campaign: 'brand' } }
    ]);
    assert.equal(result.available, true);
    assert.equal(result.value, 0);
  });
});
