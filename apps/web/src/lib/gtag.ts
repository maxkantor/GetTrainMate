/**
 * Google Analytics 4 (gtag.js) — SPA `page_path` via `gtag('config', …)` + typed events.
 * **Measurement ID must come from `VITE_GA_MEASUREMENT_ID`** (set in Amplify → Environment variables
 * for production builds). No hardcoded ID — avoids drift from Admin / stream settings.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const INIT_FLAG = '__GTM_GA4_INITIALIZED__';

/** GA4 ID from Vite env (Amplify injects at `vite build`). Undefined if unset. */
export function getMeasurementId(): string | undefined {
  const v = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

export function isGa4Enabled(): boolean {
  return Boolean(getMeasurementId() && typeof window !== 'undefined');
}

/**
 * Load gtag.js once and register the measurement ID. Called from {@link usePageTracking} on app boot.
 * Uses `send_page_view: false`; SPA sends page_view on each route via {@link gaPageView}.
 */
export function initGa4(): void {
  if (typeof window === 'undefined') return;
  const mid = getMeasurementId();
  if (!mid) return;
  if ((window as unknown as Record<string, boolean>)[INIT_FLAG]) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', mid, {
    send_page_view: false,
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
