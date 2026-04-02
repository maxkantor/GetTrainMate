import { DAILY_LIKE_LIMIT } from '@/config/appLimits';

export { DAILY_LIKE_LIMIT };

const KEY_PREFIX = 'gtm_daily_likes_';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function storageKey(): string {
  return `${KEY_PREFIX}${todayKey()}`;
}

export function getDailyLikeCount(): number {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? Math.min(n, DAILY_LIKE_LIMIT * 2) : 0;
  } catch {
    return 0;
  }
}

export function incrementDailyLike(): void {
  try {
    const next = getDailyLikeCount() + 1;
    localStorage.setItem(storageKey(), String(next));
    window.dispatchEvent(new Event('gtm-daily-swipe'));
  } catch {
    /* ignore */
  }
}

/**
 * Free users: {@link DAILY_LIKE_LIMIT} likes per UTC day (tracked locally for UX; server enforces too).
 * Users with credits &gt; 0: unlimited likes (no per-like charge on the API).
 */
export function canSendLikeWithDailyCap(credits: number): boolean {
  if (credits > 0) return true;
  return getDailyLikeCount() < DAILY_LIKE_LIMIT;
}
