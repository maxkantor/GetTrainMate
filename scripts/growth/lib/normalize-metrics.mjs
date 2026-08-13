/**
 * Normalize GA4 + Stripe raw payloads into canonical growth metrics.
 * Never sums duplicate instrumentation aliases.
 */
import { CANONICAL_METRICS } from './metric-definitions.mjs';

/**
 * Aggregate GA4 runReport rows keyed by eventName.
 * Expects dimensions: [eventName] and metrics: [eventCount, totalUsers].
 * If channel is also present, eventCount is summed; totalUsers is NOT summed
 * (would double-count) — instead we take max or leave as event-only.
 */
export function aggregateGa4ByEvent(ga4Report, { hasChannelDimension = false } = {}) {
  const byEvent = {};
  for (const row of ga4Report?.rows ?? []) {
    const name = row.dimensionValues?.[0]?.value ?? 'unknown';
    const eventCount = Number(row.metricValues?.[0]?.value ?? 0);
    const totalUsers = Number(row.metricValues?.[1]?.value ?? 0);
    if (!byEvent[name]) {
      byEvent[name] = { eventCount: 0, totalUsers: null, rows: 0 };
    }
    byEvent[name].eventCount += eventCount;
    byEvent[name].rows += 1;
    if (!hasChannelDimension) {
      byEvent[name].totalUsers = (byEvent[name].totalUsers ?? 0) + totalUsers;
    } else {
      // Channel breakdown: totalUsers cannot be summed safely across channels.
      byEvent[name].totalUsers = null;
    }
  }
  return byEvent;
}

/**
 * Resolve one canonical metric from aggregated event map.
 * @param {object} byEvent
 * @param {string} metricKey
 * @param {{ assumeZeroIfAbsent?: boolean }} [opts] When GA4 responded successfully, missing events are 0 not Unavailable.
 */
export function resolveCanonicalMetric(byEvent, metricKey, opts = {}) {
  const assumeZeroIfAbsent = opts.assumeZeroIfAbsent !== false;
  const def = CANONICAL_METRICS[metricKey];
  if (!def) {
    return {
      value: null,
      unit: 'unknown',
      sourceEvent: null,
      method: 'missing_definition',
      available: false
    };
  }

  const candidates = [def.primary, ...(def.fallbacks || [])];
  let chosen = null;
  for (const name of candidates) {
    const row = byEvent[name];
    if (row && row.eventCount > 0) {
      chosen = name;
      break;
    }
  }

  if (!chosen) {
    if (byEvent[def.primary] || assumeZeroIfAbsent) {
      return {
        value: 0,
        unit: def.kind === 'users' ? 'users' : 'events',
        sourceEvent: def.primary,
        method: byEvent[def.primary] ? 'primary_zero' : 'absent_as_zero',
        available: true,
        kind: def.kind
      };
    }
    return {
      value: null,
      unit: def.kind === 'users' ? 'users' : 'events',
      sourceEvent: def.primary,
      method: 'event_absent',
      available: false,
      kind: def.kind
    };
  }

  const row = byEvent[chosen];
  const usedFallback = chosen !== def.primary;
  let value = row.eventCount;
  let unit = 'events';
  let method = usedFallback ? 'fallback_event_count' : 'primary_event_count';

  if (def.preferUsers && row.totalUsers != null && Number.isFinite(row.totalUsers)) {
    value = row.totalUsers;
    unit = 'users';
    method = usedFallback ? 'fallback_total_users' : 'primary_total_users';
  } else if (def.kind === 'users') {
    unit = 'events';
    method = usedFallback ? 'fallback_event_count_as_proxy' : 'event_count_not_unique_users';
  }

  return {
    value,
    unit,
    sourceEvent: chosen,
    method,
    available: true,
    kind: def.kind,
    usedFallback
  };
}

export function normalizeGa4Window(byEvent, opts = {}) {
  const metrics = {};
  const warnings = [];
  for (const key of Object.keys(CANONICAL_METRICS)) {
    metrics[key] = resolveCanonicalMetric(byEvent, key, opts);
    const m = metrics[key];
    if (m.usedFallback) {
      warnings.push(
        `${key}: used fallback event "${m.sourceEvent}" because primary was absent.`
      );
    }
    if (m.kind === 'users' && m.unit === 'events' && m.available && m.value > 0) {
      warnings.push(
        `${key}: reported as event count (unique users unavailable from GA4 response).`
      );
    }
  }

  for (const [key, def] of Object.entries(CANONICAL_METRICS)) {
    for (const fb of def.fallbacks || []) {
      const p = byEvent[def.primary]?.eventCount ?? 0;
      const f = byEvent[fb]?.eventCount ?? 0;
      if (p > 0 && f > 0) {
        warnings.push(
          `${key}: both "${def.primary}" (${p}) and "${fb}" (${f}) present — counted primary only (no sum).`
        );
      }
    }
  }

  return {
    metrics,
    warnings,
    rawEventCounts: Object.fromEntries(
      Object.entries(byEvent).map(([k, v]) => [k, v.eventCount])
    )
  };
}

/**
 * Summarize Stripe Checkout Sessions + Charges into live payments / customers / revenue.
 * Excludes test mode, failed, refunded charges.
 */
export function normalizeStripe({ sessions, charges } = {}) {
  const warnings = [];
  const sessionList = sessions?.data ?? [];
  const chargeList = charges?.data ?? [];

  const liveSessions = sessionList.filter(
    (s) => s.livemode === true && s.payment_status === 'paid' && s.status === 'complete'
  );
  const testSessions = sessionList.filter(
    (s) => s.livemode === false && s.payment_status === 'paid'
  );

  const liveCharges = chargeList.filter(
    (c) => c.livemode === true && c.paid === true && c.status === 'succeeded' && !c.refunded
  );

  // Prefer charge amounts (authoritative); fall back to session amount_total.
  let revenueCents = liveCharges.reduce((sum, c) => sum + (c.amount || 0) - (c.amount_refunded || 0), 0);
  let revenueSource = 'charges';
  if (liveCharges.length === 0 && liveSessions.length > 0) {
    revenueCents = liveSessions.reduce((sum, s) => sum + (s.amount_total || 0), 0);
    revenueSource = 'checkout_sessions';
    if (revenueCents === 0) {
      warnings.push('Live paid Checkout Sessions present but amount_total is 0; revenue Unknown without Charges.');
    }
  }

  // Prefer Charges for payment count when available (Checkout Sessions often duplicate the same PI).
  const livePayments =
    liveCharges.length > 0
      ? new Set(liveCharges.map((c) => String(c.payment_intent || c.id))).size
      : liveSessions.length;

  // Unique customers from customer field when present.
  const customerIds = new Set();
  let customersMissing = 0;
  for (const c of liveCharges) {
    if (c.customer) customerIds.add(String(c.customer));
    else customersMissing += 1;
  }
  for (const s of liveSessions) {
    if (s.customer) customerIds.add(String(s.customer));
    else if (!liveCharges.length) customersMissing += 1;
  }

  let uniquePayingCustomers = null;
  let uniqueCustomersAvailable = false;
  if (customerIds.size > 0) {
    uniquePayingCustomers = customerIds.size;
    uniqueCustomersAvailable = true;
    if (customersMissing > 0) {
      warnings.push(
        `${customersMissing} live payment(s) lack Stripe customer id — unique customer count may be understated.`
      );
    }
  } else if (livePayments > 0) {
    warnings.push('Stripe customer ids unavailable — unique paying customers Unknown.');
  }

  if (testSessions.length > 0) {
    warnings.push(`${testSessions.length} test-mode paid session(s) excluded from live totals.`);
  }

  return {
    live_payments: livePayments,
    unique_paying_customers: uniquePayingCustomers,
    unique_paying_customers_available: uniqueCustomersAvailable,
    revenue_live_usd: revenueCents / 100,
    revenue_source: revenueSource,
    test_paid_sessions: testSessions.length,
    live_checkout_sessions: liveSessions.length,
    live_succeeded_charges: liveCharges.length,
    live_paid_sessions: liveSessions,
    warnings
  };
}

/**
 * Build scoreboard row for a window from normalized GA4 + Stripe.
 */
export function buildScoreboardRow(ga4Norm, stripeNorm) {
  const g = ga4Norm?.metrics ?? {};
  const cell = (key) => {
    const m = g[key];
    if (!m || !m.available) {
      return { value: null, unit: m?.unit ?? 'unknown', label: 'Unavailable', available: false };
    }
    return {
      value: m.value,
      unit: m.unit,
      label: m.unit === 'users' ? 'users' : 'events',
      available: true,
      sourceEvent: m.sourceEvent,
      method: m.method
    };
  };

  return {
    landings: cell('landings'),
    completed_signups: cell('completed_signups'),
    completed_profiles: cell('completed_profiles'),
    discover_users: cell('discover_users'),
    connections_sent: cell('connections_sent'),
    matches_created: cell('matches_created'),
    first_messages: cell('first_messages'),
    returning_users: cell('returning_users'),
    pricing_views: cell('pricing_views'),
    checkout_starts: cell('checkout_starts'),
    live_payments: {
      value: stripeNorm?.live_payments ?? null,
      unit: 'payments',
      label: 'payments',
      available: stripeNorm != null,
      method: 'stripe_live'
    },
    unique_paying_customers: {
      value: stripeNorm?.unique_paying_customers_available
        ? stripeNorm.unique_paying_customers
        : null,
      unit: 'customers',
      label: 'customers',
      available: Boolean(stripeNorm?.unique_paying_customers_available),
      method: stripeNorm?.unique_paying_customers_available
        ? 'stripe_customer_dedupe'
        : 'unavailable'
    },
    revenue: {
      value: stripeNorm != null ? stripeNorm.revenue_live_usd : null,
      unit: 'usd',
      label: 'usd',
      available: stripeNorm != null,
      method: stripeNorm?.revenue_source ?? 'stripe'
    }
  };
}

/** Format a scoreboard cell for display. */
export function formatCell(cell) {
  if (!cell || !cell.available || cell.value == null) return 'Unavailable';
  if (cell.unit === 'usd') return `$${Number(cell.value).toFixed(2)}`;
  return String(cell.value);
}
