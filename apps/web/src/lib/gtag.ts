/**
 * Google Analytics 4 (gtag.js) — SPA `page_path` via `gtag('config', …)` + typed events.
 * Default measurement ID matches `index.html` (G-C29M8NWNY4). Optional `VITE_GA_MEASUREMENT_ID`
 * in Amplify must be the same property if set — do not mix multiple GA4 IDs.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __GTM_GA4_HTML_INIT__?: boolean;
  }
}

const INIT_FLAG = '__GTM_GA4_INITIALIZED__';

/** Production GA4 property for gettrainmate.com (also in `index.html`). */
export const DEFAULT_GA_MEASUREMENT_ID = 'G-C29M8NWNY4';

/** Single GA4 property for production (must match `index.html` gtag snippet). */
export function getMeasurementId(): string | undefined {
  return DEFAULT_GA_MEASUREMENT_ID;
}

export function isGa4Enabled(): boolean {
  return Boolean(getMeasurementId() && typeof window !== 'undefined');
}

/**
 * Ensure gtag exists when `index.html` did not run (e.g. tests). Production uses HTML snippet + async loader.
 */
export function initGa4(): void {
  if (typeof window === 'undefined') return;
  const mid = getMeasurementId();
  if (!mid) return;
  if ((window as unknown as Record<string, boolean>)[INIT_FLAG]) return;

  if (window.__GTM_GA4_HTML_INIT__ === true && typeof window.gtag === 'function') {
    (window as unknown as Record<string, boolean>)[INIT_FLAG] = true;
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', mid, {
    send_page_view: true,
    cookie_flags: 'SameSite=None;Secure',
  });
  (window as unknown as Record<string, boolean>)[INIT_FLAG] = true;

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(mid)}`;
  document.head.appendChild(s);
}

/** SPA route changes — `gtag('config', measurement_id, { page_path })` sends page_view in GA4. */
export function gaPageView(path: string, title?: string): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  const mid = getMeasurementId();
  if (!mid) return;
  const pagePath = path.startsWith('/') ? path : `/${path}`;
  const cfg: Record<string, unknown> = {
    page_path: pagePath,
    page_title: title ?? (typeof document !== 'undefined' ? document.title : ''),
  };
  if (import.meta.env.DEV) {
    cfg.debug_mode = true;
  }
  window.gtag('config', mid, cfg);
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console -- GA validation in local dev only
    console.debug('[GA] page_view config', pagePath);
  }
}

export function gaEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  if (!getMeasurementId()) return;
  window.gtag('event', name, params);
}
