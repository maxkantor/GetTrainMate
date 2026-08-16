#!/usr/bin/env node
import { releaseGrowthRunLock, LOCK_PATH } from './lib/growth-run-lock.mjs';

const force = process.argv.includes('--force');
const holder = process.env.GROWTH_RUN_HOLDER || undefined;
const result = releaseGrowthRunLock({ force, holder });
if (!result.ok) {
  console.error(JSON.stringify({ ok: false, ...result, lockPath: LOCK_PATH }));
  process.exit(2);
}
console.log(JSON.stringify({ ok: true, lockPath: LOCK_PATH, ...result }));
