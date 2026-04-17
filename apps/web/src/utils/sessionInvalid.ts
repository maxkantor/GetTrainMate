import { authService } from '@/services/authService';
import { clearAuthScopeTracking } from '@/utils/authScopeReset';
import { clearAmplifyAuthStorageKeys } from '@/utils/clearAmplifyWebKeys';

let redirectScheduled = false;

/** Clears Cognito session and sends the user to sign-in (e.g. after admin deletes the account or token is revoked). */
export async function handleSessionInvalid(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await authService.logout();
  } catch {
    /* signOut may fail if session already cleared */
  }
  clearAmplifyAuthStorageKeys();
  clearAuthScopeTracking();
  const path = window.location.pathname;
  const search = window.location.search;
  const hash = window.location.hash;
  const current = `${path}${search}${hash}`;
  const loginPath = '/login';
  if (path === loginPath || path.startsWith(`${loginPath}/`)) {
    const q = new URLSearchParams(search);
    if (q.get('reason') === 'session') return;
  }
  if (redirectScheduled) return;
  redirectScheduled = true;

  if (path === loginPath || path.startsWith(`${loginPath}/`)) {
    window.location.replace(`${loginPath}?reason=session`);
    return;
  }
  const qs = new URLSearchParams();
  qs.set('reason', 'session');
  if (current.startsWith('/') && current !== '/') qs.set('next', current);
  window.location.replace(`${loginPath}?${qs.toString()}`);
}
