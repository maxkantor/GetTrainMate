import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  acquireGrowthRunLock,
  releaseGrowthRunLock,
  inspectGrowthRunLock,
  LOCK_PATH,
  DEFAULT_STALE_MS
} from '../lib/growth-run-lock.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('growth-run-lock', () => {
  it('acquires, blocks second holder, releases', () => {
    try {
      fs.unlinkSync(LOCK_PATH);
    } catch {
      /* none */
    }
    const a = acquireGrowthRunLock({ holder: 'a', now: 1_000_000 });
    assert.equal(a.ok, true);
    const b = acquireGrowthRunLock({ holder: 'b', now: 1_000_000 + 60_000 });
    assert.equal(b.ok, false);
    assert.equal(b.reason, 'active_lock');
    const rel = releaseGrowthRunLock({ holder: 'a' });
    assert.equal(rel.ok, true);
    const c = acquireGrowthRunLock({ holder: 'c', now: 1_000_000 + 120_000 });
    assert.equal(c.ok, true);
    releaseGrowthRunLock({ force: true });
  });

  it('treats stale lock as reclaimable', () => {
    try {
      fs.unlinkSync(LOCK_PATH);
    } catch {
      /* none */
    }
    const started = 1_000_000;
    acquireGrowthRunLock({ holder: 'old', now: started, staleMs: DEFAULT_STALE_MS });
    const inspect = inspectGrowthRunLock({
      now: started + DEFAULT_STALE_MS + 1,
      staleMs: DEFAULT_STALE_MS
    });
    assert.equal(inspect.stale, true);
    const next = acquireGrowthRunLock({
      holder: 'new',
      now: started + DEFAULT_STALE_MS + 1,
      staleMs: DEFAULT_STALE_MS
    });
    assert.equal(next.ok, true);
    releaseGrowthRunLock({ force: true });
  });
});
