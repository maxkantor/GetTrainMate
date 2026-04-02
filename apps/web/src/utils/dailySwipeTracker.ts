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
 * Client daily cap ({@link DAILY_LIKE_LIMIT}) is a soft limit: once reached, user can still Like if they
 * have credits (each Like costs 1 credit on the server). Block only when at cap and no credits left.
 */
export function canSendLikeWithDailyCap(credits: number): boolean {
  if (getDailyLikeCount() < DAILY_LIKE_LIMIT) return true;
  return credits >= 1;
}
