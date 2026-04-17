import { authService } from '@/services/authService';
import { clearAuthScopeTracking } from '@/utils/authScopeReset';

let handling = false;

/** Clears Cognito session and sends the user to sign-in (e.g. after admin deletes the account or token is revoked). */
export async function handleSessionInvalid(): Promise<void> {
  if (handling || typeof window === 'undefined') return;
  handling = true;
  try {
    await authService.logout();
  } catch {
    /* signOut may fail if session already cleared */
  }
  clearAuthScopeTracking();
  const path = window.location.pathname;
  const search = window.location.search;
  const hash = window.location.hash;
  const current = `${path}${search}${hash}`;
  const loginPath = '/login';
  if (path === loginPath || path.startsWith(`${loginPath}/`)) {
    const q = new URLSearchParams(search);
    if (q.get('reason') === 'session') return;
    window.location.assign(`${loginPath}?reason=session`);
    return;
  }
  const qs = new URLSearchParams();
  qs.set('reason', 'session');
  if (current.startsWith('/') && current !== '/') qs.set('next', current);
  window.location.assign(`${loginPath}?${qs.toString()}`);
}
