/**
 * Snapshot reconciliation before Admin email.
 * On failure: mark affected metrics Unknown; do not invent values.
 */

/**
 * @param {{ scoreboard7d: object, scoreboard30d: object, stripe7d?: object, stripe30d?: object }} input
 * @returns {{ ok: boolean, warnings: string[], blockedMetrics: string[] }}
 */
export function reconcileSnapshot({ scoreboard7d, scoreboard30d, stripe7d, stripe30d } = {}) {
  const warnings = [];
  const blockedMetrics = new Set();

  const pairs = [
    'landings',
    'completed_signups',
    'completed_profiles',
    'discover_users',
    'connections_sent',
    'matches_created',
    'first_messages',
    'returning_users',
    'pricing_views',
    'checkout_starts',
    'live_payments',
    'unique_paying_customers',
    'revenue'
  ];

  for (const key of pairs) {
    const a = scoreboard7d?.[key];
    const b = scoreboard30d?.[key];
    if (a?.available && a.value != null && a.value < 0) {
      warnings.push(`7d ${key} is negative (${a.value}).`);
      blockedMetrics.add(`7d.${key}`);
    }
    if (b?.available && b.value != null && b.value < 0) {
      warnings.push(`30d ${key} is negative (${b.value}).`);
      blockedMetrics.add(`30d.${key}`);
    }
    if (
      a?.available &&
      b?.available &&
      a.value != null &&
      b.value != null &&
      a.value > b.value
    ) {
      warnings.push(
        `7d ${key} (${a.value}) exceeds 30d ${key} (${b.value}) — impossible for nested windows.`
      );
      blockedMetrics.add(`7d.${key}`);
      blockedMetrics.add(`30d.${key}`);
    }
  }

  // Unique customers cannot exceed payments.
  for (const [label, board] of [
    ['7d', scoreboard7d],
    ['30d', scoreboard30d]
  ]) {
    const payments = board?.live_payments;
    const customers = board?.unique_paying_customers;
    if (
      payments?.available &&
      customers?.available &&
      payments.value != null &&
      customers.value != null &&
      customers.value > payments.value
    ) {
      warnings.push(
        `${label} unique paying customers (${customers.value}) exceed live payments (${payments.value}).`
      );
      blockedMetrics.add(`${label}.unique_paying_customers`);
    }
  }

  // Revenue vs payments reconciliation (soft): if payments>0 and revenue=0, warn.
  for (const [label, board, stripe] of [
    ['7d', scoreboard7d, stripe7d],
    ['30d', scoreboard30d, stripe30d]
  ]) {
    const payments = board?.live_payments?.value ?? 0;
    const revenue = board?.revenue?.value ?? 0;
    if (payments > 0 && revenue === 0 && stripe?.revenue_source === 'checkout_sessions') {
      warnings.push(
        `${label} has ${payments} live payment(s) but $0 revenue from Checkout Sessions — check Charges API / amount_total.`
      );
    }
  }

  // Detect suspiciously exact 2x patterns between raw aliases (caller may pass hints).
  return {
    ok: warnings.length === 0,
    warnings,
    blockedMetrics: [...blockedMetrics]
  };
}

/**
 * Apply blocked metrics → set available=false / value=null on a scoreboard copy.
 */
export function applyReconciliationBlocks(scoreboard, blockedMetrics, windowLabel) {
  if (!scoreboard) return scoreboard;
  const out = { ...scoreboard };
  for (const key of Object.keys(out)) {
    const full = `${windowLabel}.${key}`;
    if (blockedMetrics.includes(full)) {
      out[key] = {
        ...out[key],
        value: null,
        available: false,
        label: 'Unknown',
        method: 'blocked_by_reconciliation'
      };
    }
  }
  return out;
}

/**
 * Detect the historical double-count bug pattern in a naive alias-sum scoreboard.
 * Used by tests / fixtures.
 */
export function detectAliasDoubleCount(rawEventCounts, summedValue, primary, fallback) {
  const p = rawEventCounts[primary] || 0;
  const f = rawEventCounts[fallback] || 0;
  if (f > 0 && summedValue === p + f && p > 0) {
    return {
      detected: true,
      message: `Value ${summedValue} equals ${primary}(${p})+${fallback}(${f}) — alias sum bug.`
    };
  }
  // Email pick() after stage sum: (p+f)+f = p+2f (works even when p=0)
  if (f > 0 && summedValue === p + 2 * f) {
    return {
      detected: true,
      message: `Value ${summedValue} equals stage(${p}+${f})+fallback(${f}) — email pick() double-count bug.`
    };
  }
  return { detected: false };
}
