import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assessSnapshotFreshness,
  etYmd,
  expectedGa4DataThroughYmd,
  markSnapshotStale
} from '../lib/snapshot-freshness.mjs';

describe('snapshot-freshness', () => {
  it('expectedGa4DataThroughYmd is yesterday ET', () => {
    // Fixed instant: 2026-10-08 15:00 UTC = still Oct 8 morning ET
    const now = new Date('2026-10-08T15:00:00.000Z');
    assert.equal(etYmd(now), '2026-10-08');
    assert.equal(expectedGa4DataThroughYmd(now), '2026-10-07');
  });

  it('flags stale when ga4DataThrough lags expected yesterday', () => {
    const now = new Date('2026-10-08T15:00:00.000Z');
    const r = assessSnapshotFreshness(
      { ga4DataThrough: '2026-10-04', generatedAt: '2026-10-05T14:30:00.000Z' },
      now
    );
    assert.equal(r.stale, true);
    assert.equal(r.fresh, false);
    assert.equal(r.flag, 'STALE_GA4_DATA');
    assert.equal(r.expectedThrough, '2026-10-07');
    assert.equal(r.actualThrough, '2026-10-04');
    assert.match(r.note, /STALE/);
  });

  it('is fresh when ga4DataThrough matches expected yesterday', () => {
    const now = new Date('2026-10-08T15:00:00.000Z');
    const r = assessSnapshotFreshness({ ga4DataThrough: '2026-10-07' }, now);
    assert.equal(r.fresh, true);
    assert.equal(r.stale, false);
    assert.equal(r.flag, null);
  });

  it('markSnapshotStale refuses silent reuse by setting snapshotStale + note', () => {
    const marked = markSnapshotStale(
      {
        ga4DataThrough: '2026-10-04',
        notes: [],
        sources: { ga4: 'ok' },
        scoreboard: {
          '7d': { pricing_views: { value: 3, available: true } },
          '30d': { pricing_views: { value: 2, available: true } }
        }
      },
      { collectError: 'stamp is not defined' }
    );
    assert.equal(marked.snapshotStale, true);
    assert.match(marked.snapshotCollectError, /stamp is not defined/);
    assert.ok(marked.notes.some((n) => /STALE|collect failed/i.test(n)));
    assert.equal(marked.snapshotFreshness.stale, true);
    assert.deepEqual(marked.scoreboard, {});
    assert.equal(marked.sources.ga4, 'stale');
    assert.equal(marked.ga4DataThrough, '2026-10-04');
  });

  it('never treats missing ga4DataThrough as fresh', () => {
    const now = new Date('2026-10-08T15:00:00.000Z');
    const r = assessSnapshotFreshness({ scoreboard: {} }, now);
    assert.equal(r.stale, true);
    assert.equal(r.actualThrough, null);
  });
});
