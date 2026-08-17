import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  acquireGrowthRunLock,
  releaseGrowthRunLock,
  inspectGrowthRunLock,
  DEFAULT_STALE_MS
} from '../lib/growth-run-lock.mjs';

function tempLockPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gtm-lock-')), 'growth-run.lock');
}

describe('growth-run-lock', () => {
  it('acquires, blocks second holder, releases', () => {
    const lockPath = tempLockPath();
    const a = acquireGrowthRunLock({ holder: 'a', now: 1_000_000, lockPath });
    assert.equal(a.ok, true);
    const b = acquireGrowthRunLock({ holder: 'b', now: 1_000_000 + 60_000, lockPath });
    assert.equal(b.ok, false);
    assert.equal(b.reason, 'active_lock');
    const rel = releaseGrowthRunLock({ holder: 'a', lockPath });
    assert.equal(rel.ok, true);
    const c = acquireGrowthRunLock({ holder: 'c', now: 1_000_000 + 120_000, lockPath });
    assert.equal(c.ok, true);
    releaseGrowthRunLock({ force: true, lockPath });
  });

  it('treats stale lock as reclaimable', () => {
    const lockPath = tempLockPath();
    const started = 1_000_000;
    acquireGrowthRunLock({ holder: 'old', now: started, staleMs: DEFAULT_STALE_MS, lockPath });
    const inspect = inspectGrowthRunLock({
      now: started + DEFAULT_STALE_MS + 1,
      staleMs: DEFAULT_STALE_MS,
      lockPath
    });
    assert.equal(inspect.stale, true);
    const next = acquireGrowthRunLock({
      holder: 'new',
      now: started + DEFAULT_STALE_MS + 1,
      staleMs: DEFAULT_STALE_MS,
      lockPath
    });
    assert.equal(next.ok, true);
    releaseGrowthRunLock({ force: true, lockPath });
  });
});
