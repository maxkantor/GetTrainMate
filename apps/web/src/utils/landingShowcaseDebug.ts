/**
 * Opt-in client logs for landing hero / swipe photos (no full presigned URLs).
 * Enable: sessionStorage.setItem('gtmDebugLandingShowcase', '1') then reload.
 * Disable: sessionStorage.removeItem('gtmDebugLandingShowcase')
 */
export function landingShowcaseDebugEnabled(): boolean {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem('gtmDebugLandingShowcase') === '1';
  } catch {
    return false;
  }
}

export function logLandingShowcase(...args: unknown[]): void {
  if (!landingShowcaseDebugEnabled()) return;
  console.warn('[GTM landing-showcase]', ...args);
}

/** Redact query string (presigned sig) for logs. */
export function redactUrlForLog(url: string | undefined | null): string {
  const u = (url || '').trim();
  if (!u) return '(empty)';
  try {
    const parsed = new URL(u);
    parsed.search = parsed.search ? '?…' : '';
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return u.length > 80 ? `${u.slice(0, 40)}…` : u;
  }
}
