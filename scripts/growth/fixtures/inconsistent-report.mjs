/**
 * Fixture reproducing the Aug 2026 inconsistent growth report.
 * Raw GA4: signup_completed=1, sign_up=1 → naive sum = 2, email pick double = 3
 * profile_completed=1, onboarding_completed=1 → sum 2, double 3... notes said 1 vs scoreboard 2
 * request_sent=2, like_or_connection_sent=2 → scoreboard 4
 * match_created=0, match_shown=17 → naive sum 17; double with pick = 34
 */
export const inconsistentGa4Rows = {
  rows: [
    {
      dimensionValues: [{ value: 'landing_page_view' }],
      metricValues: [{ value: '16' }, { value: '12' }]
    },
    {
      dimensionValues: [{ value: 'signup_completed' }],
      metricValues: [{ value: '1' }, { value: '1' }]
    },
    {
      dimensionValues: [{ value: 'sign_up' }],
      metricValues: [{ value: '1' }, { value: '1' }]
    },
    {
      dimensionValues: [{ value: 'profile_completed' }],
      metricValues: [{ value: '1' }, { value: '1' }]
    },
    {
      dimensionValues: [{ value: 'onboarding_completed' }],
      metricValues: [{ value: '1' }, { value: '1' }]
    },
    {
      dimensionValues: [{ value: 'discover_viewed' }],
      metricValues: [{ value: '2' }, { value: '2' }]
    },
    {
      dimensionValues: [{ value: 'request_sent' }],
      metricValues: [{ value: '2' }, { value: '2' }]
    },
    {
      dimensionValues: [{ value: 'like_or_connection_sent' }],
      metricValues: [{ value: '2' }, { value: '2' }]
    },
    {
      dimensionValues: [{ value: 'match_shown' }],
      metricValues: [{ value: '17' }, { value: '5' }]
    },
    {
      dimensionValues: [{ value: 'match_created' }],
      metricValues: [{ value: '0' }, { value: '0' }]
    },
    {
      dimensionValues: [{ value: 'return_visit' }],
      metricValues: [{ value: '22' }, { value: '8' }]
    },
    {
      dimensionValues: [{ value: 'pricing_viewed' }],
      metricValues: [{ value: '1' }, { value: '1' }]
    },
    {
      dimensionValues: [{ value: 'view_pricing' }],
      metricValues: [{ value: '1' }, { value: '1' }]
    }
  ]
};

/** 7d subset — landings 3, no signups */
export const inconsistentGa4Rows7d = {
  rows: [
    {
      dimensionValues: [{ value: 'landing_page_view' }],
      metricValues: [{ value: '3' }, { value: '3' }]
    },
    {
      dimensionValues: [{ value: 'match_shown' }],
      metricValues: [{ value: '4' }, { value: '2' }]
    }
  ]
};

export const stripeFixture = {
  sessions: {
    data: [
      {
        id: 'cs_live_unattributed',
        livemode: true,
        status: 'complete',
        payment_status: 'paid',
        amount_total: 1999,
        customer: 'cus_abc',
        payment_intent: 'pi_1',
        metadata: {}
      },
      {
        id: 'cs_live_gtm',
        livemode: true,
        status: 'complete',
        payment_status: 'paid',
        amount_total: 999,
        customer: 'cus_gtm',
        payment_intent: 'pi_gtm',
        metadata: {
          gtm_source: 'gettrainmate',
          packKey: 'go',
          credits: '100',
          priceUsd: '9.99'
        }
      },
      {
        id: 'cs_test_1',
        livemode: false,
        status: 'complete',
        payment_status: 'paid',
        amount_total: 999,
        customer: 'cus_test',
        payment_intent: 'pi_test'
      }
    ]
  },
  charges: {
    data: [
      {
        id: 'ch_1',
        livemode: true,
        paid: true,
        status: 'succeeded',
        refunded: false,
        amount: 1999,
        amount_refunded: 0,
        customer: 'cus_abc',
        payment_intent: 'pi_1',
        metadata: {}
      },
      {
        id: 'ch_gtm',
        livemode: true,
        paid: true,
        status: 'succeeded',
        refunded: false,
        amount: 999,
        amount_refunded: 0,
        customer: 'cus_gtm',
        payment_intent: 'pi_gtm',
        metadata: { gtm_source: 'gettrainmate' }
      }
    ]
  }
};

/** Legacy email pick() bug: stages already summed aliases, then pick adds alias again. */
export function legacyAliasSumScoreboard(raw) {
  const get = (name, ...aliases) => {
    let total = raw[name] || 0;
    for (const a of aliases) total += raw[a] || 0;
    return total;
  };
  const stages = {
    signup_completed: get('signup_completed', 'sign_up'),
    profile_completed: get('profile_completed', 'onboarding_completed'),
    like_or_connection_sent: get('like_or_connection_sent', 'request_sent'),
    match_created: get('match_created', 'match_shown')
  };
  const pick = (...names) =>
    names.reduce((sum, n) => sum + (stages[n] ?? raw[n] ?? 0), 0);
  return {
    signups: pick('signup_completed', 'sign_up'),
    profiles: pick('profile_completed', 'onboarding_completed'),
    connections: pick('like_or_connection_sent', 'request_sent'),
    matches: pick('match_created', 'match_shown')
  };
}
