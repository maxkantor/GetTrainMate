#!/usr/bin/env node
import { acquireGrowthRunLock, LOCK_PATH } from './lib/growth-run-lock.mjs';

const holder = process.env.GROWTH_RUN_HOLDER || `cursor-${process.pid}`;
const result = acquireGrowthRunLock({ holder });
if (!result.ok) {
  console.error(
    JSON.stringify({
      ok: false,
      error: 'growth_run_lock_held',
      message: 'Another non-stale growth run holds the lock. Stop. Never delete or bypass an active lock.',
      lockPath: LOCK_PATH,
      lock: result.lock
    })
  );
  process.exit(2);
}
console.log(JSON.stringify({ ok: true, lockPath: LOCK_PATH, lock: result.lock }));
