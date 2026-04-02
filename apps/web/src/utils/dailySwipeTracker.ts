import { DAILY_LIKE_LIMIT } from '@/config/appLimits';

export { DAILY_LIKE_LIMIT };

const KEY_PREFIX = 'gtm_daily_likes_';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Per-user + UTC day so Max and Sasha never share the same counter. */
function storageKey(userId: string | undefined): string {
  const uid = userId?.trim() || '_none';
  return `${KEY_PREFIX}${uid}_${todayKey()}`;
}

export function getDailyLikeCount(userId: string | undefined): number {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? Math.min(n, DAILY_LIKE_LIMIT * 2) : 0;
  } catch {
    return 0;
  }
}

export function incrementDailyLike(userId: string | undefined): void {
  try {
    const next = getDailyLikeCount(userId) + 1;
    localStorage.setItem(storageKey(userId), String(next));
    window.dispatchEvent(new Event('gtm-daily-swipe'));
  } catch {
    /* ignore */
  }
}

/**
 * Free users: {@link DAILY_LIKE_LIMIT} likes per UTC day (tracked locally for UX; server enforces too).
 * Users with credits &gt; 0: unlimited likes for cap purposes.
 */
export function canSendLikeWithDailyCap(credits: number, userId: string | undefined): boolean {
  if (credits > 0) return true;
  return getDailyLikeCount(userId) < DAILY_LIKE_LIMIT;
}
