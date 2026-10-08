/**
 * Snapshot freshness helpers for growth funnel reports.
 * Never silently treat an older funnel-*.json as today's GA4 window.
 */

/** Calendar YMD in America/New_York. */
export function etYmd(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/** Inclusive GA4 complete-through day = yesterday ET. */
export function expectedGa4DataThroughYmd(now = new Date()) {
  const [y, m, d] = etYmd(now).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/**
 * @param {{ ga4DataThrough?: string, generatedAt?: string, snapshotStale?: boolean, snapshotCollectError?: string }|null} snapshot
 * @param {Date} [now]
 * @returns {{
 *   expectedThrough: string,
 *   actualThrough: string|null,
 *   fresh: boolean,
 *   stale: boolean,
 *   collectFailed: boolean,
 *   flag: string|null,
 *   note: string|null
 * }}
 */
export function assessSnapshotFreshness(snapshot, now = new Date()) {
  const expectedThrough = expectedGa4DataThroughYmd(now);
  const actualThrough = snapshot?.ga4DataThrough ? String(snapshot.ga4DataThrough).slice(0, 10) : null;
  const collectFailed = Boolean(snapshot?.snapshotCollectError) || snapshot?.snapshotStale === true;
  const dateStale = !actualThrough || actualThrough < expectedThrough;
  const stale = collectFailed || dateStale;
  const fresh = !stale && actualThrough === expectedThrough;

  let flag = null;
  let note = null;
  if (collectFailed) {
    flag = 'STALE_SNAPSHOT';
    note = `Snapshot collect failed — refusing silent reuse of older GA4 data. Expected through ${expectedThrough}; got ${actualThrough || 'none'}. ${snapshot?.snapshotCollectError || ''}`.trim();
  } else if (dateStale) {
    flag = 'STALE_GA4_DATA';
    note = `GA4 data is STALE: last complete day in snapshot is ${actualThrough || 'unknown'}; expected ${expectedThrough} (yesterday America/New_York). Do not treat this as current.`;
  }

  return {
    expectedThrough,
    actualThrough,
    fresh,
    stale,
    collectFailed,
    flag,
    note
  };
}

/**
 * Annotate a loaded snapshot so reports never look current when collect failed / date lags.
 * @param {object|null} snapshot
 * @param {{ collectError?: string, expectedStamp?: string }} [opts]
 */
export function markSnapshotStale(snapshot, opts = {}) {
  const base =
    snapshot && typeof snapshot === 'object'
      ? { ...snapshot }
      : { error: 'missing snapshot', sources: {}, scoreboard: {}, notes: [] };
  const notes = Array.isArray(base.notes) ? [...base.notes] : [];
  base.snapshotStale = true;
  if (opts.collectError) base.snapshotCollectError = String(opts.collectError).slice(0, 500);
  // Keep ga4DataThrough for the STALE banner, but never surface prior GA4 scoreboard
  // cells as if they were today's nested-window metrics.
  base.scoreboard = {};
  if (base.sources && typeof base.sources === 'object') {
    base.sources = { ...base.sources, ga4: 'stale' };
  }
  const freshness = assessSnapshotFreshness(base);
  if (freshness.note && !notes.includes(freshness.note)) notes.unshift(freshness.note);
  if (freshness.flag && !notes.some((n) => String(n).includes(freshness.flag))) {
    notes.unshift(`DATA QUALITY: ${freshness.flag}`);
  }
  base.notes = notes;
  base.snapshotFreshness = freshness;
  return base;
}
