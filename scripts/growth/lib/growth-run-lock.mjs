/**
 * Exclusive growth-run lock (file under scripts/growth/var/).
 * Stale after GROWTH_RUN_LOCK_STALE_MS (default 3 hours).
 * Never delete an active (non-stale) lock.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const GROWTH_VAR_DIR = path.join(__dirname, '..', 'var');
export const LOCK_PATH = path.join(GROWTH_VAR_DIR, 'growth-run.lock');
export const DEFAULT_STALE_MS = 3 * 60 * 60 * 1000;

export function staleMs(env = process.env) {
  const raw = env.GROWTH_RUN_LOCK_STALE_MS;
  if (raw == null || raw === '') return DEFAULT_STALE_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_STALE_MS;
}

function readLock() {
  if (!fs.existsSync(LOCK_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
  } catch {
    return { startedAt: 0, holder: 'unreadable', pid: null };
  }
}

/**
 * @returns {{ ok: true, lock: object } | { ok: false, reason: string, lock?: object }}
 */
export function acquireGrowthRunLock(opts = {}) {
  const now = opts.now ?? Date.now();
  const holder = opts.holder ?? `pid-${process.pid}`;
  const maxAge = opts.staleMs ?? staleMs();
  fs.mkdirSync(GROWTH_VAR_DIR, { recursive: true });

  const existing = readLock();
  if (existing?.startedAt) {
    const age = now - Number(existing.startedAt);
    if (age >= 0 && age < maxAge) {
      return {
        ok: false,
        reason: 'active_lock',
        lock: existing
      };
    }
  }

  const lock = {
    startedAt: now,
    startedAtIso: new Date(now).toISOString(),
    holder,
    pid: process.pid,
    staleAfterMs: maxAge
  };
  fs.writeFileSync(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`, { flag: 'w' });
  return { ok: true, lock };
}

/**
 * Release only if we hold the lock (or force after explicit stale reclaim).
 */
export function releaseGrowthRunLock(opts = {}) {
  const existing = readLock();
  if (!existing) return { ok: true, released: false };
  if (opts.force) {
    fs.unlinkSync(LOCK_PATH);
    return { ok: true, released: true };
  }
  if (opts.holder && existing.holder !== opts.holder && existing.pid !== process.pid) {
    return { ok: false, reason: 'not_holder', lock: existing };
  }
  fs.unlinkSync(LOCK_PATH);
  return { ok: true, released: true };
}

export function inspectGrowthRunLock(opts = {}) {
  const now = opts.now ?? Date.now();
  const maxAge = opts.staleMs ?? staleMs();
  const lock = readLock();
  if (!lock) return { exists: false, stale: false };
  const age = now - Number(lock.startedAt || 0);
  return { exists: true, stale: age < 0 || age >= maxAge, ageMs: age, lock };
}
