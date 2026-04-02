import { setChatUnreadTotal } from '@/utils/chatUnreadStore';

let previousAuthSub: string | null = null;

/**
 * Call whenever the authenticated Cognito `sub` is known (after login / session restore).
 * On user switch, clears cross-session client state that is not user-namespaced.
 */
export function syncAuthScopeToCurrentUser(currentSub: string | undefined): void {
  if (!currentSub) {
    previousAuthSub = null;
    setChatUnreadTotal(0);
    try {
      sessionStorage.removeItem('billing_plans_cache');
      sessionStorage.removeItem('credit_packs_cache');
    } catch {
      /* ignore */
    }
    return;
  }

  if (previousAuthSub !== null && previousAuthSub !== currentSub) {
    setChatUnreadTotal(0);
    window.dispatchEvent(new CustomEvent('gtm-auth-user-changed', { detail: { sub: currentSub } }));
    try {
      const drop: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith('gtm_discover_last_visit') || k.startsWith('gtm_daily_likes_')) {
          drop.push(k);
        }
      }
      drop.forEach((k) => localStorage.removeItem(k));
      sessionStorage.removeItem('billing_plans_cache');
      sessionStorage.removeItem('credit_packs_cache');
    } catch {
      /* ignore */
    }
  }

  previousAuthSub = currentSub;
}

/** Call on logout (no user). */
export function clearAuthScopeTracking(): void {
  previousAuthSub = null;
  setChatUnreadTotal(0);
}
