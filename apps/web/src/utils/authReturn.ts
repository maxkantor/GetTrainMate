const KEY = 'gtm_auth_return';

export function setAuthReturn(path: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(KEY, path);
}

export function getAuthReturn(fallback = '/app'): string {
  if (typeof window === 'undefined') return fallback;
  return sessionStorage.getItem(KEY) || fallback;
}

export function clearAuthReturn(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(KEY);
}

export function resolveReturnUrl(searchParams: URLSearchParams, fallback = '/app'): string {
  const fromQuery = searchParams.get('return')?.trim();
  if (fromQuery?.startsWith('/')) return fromQuery;
  return getAuthReturn(fallback);
}
