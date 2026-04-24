/**
 * Google Analytics 4 (gtag.js) — SPA `page_path` via `gtag('config', …)` + typed events.
 * **Measurement ID must come from `VITE_GA_MEASUREMENT_ID`** (set in Amplify → Environment variables
 * for production builds). No hardcoded ID — avoids drift from Admin / stream settings.
 */

import { getGaMeasurementId, initAnalytics } from '@/analytics';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** GA4 ID from Vite env (Amplify injects at `vite build`). Undefined if unset. */
export function getMeasurementId(): string | undefined {
  return getGaMeasurementId();
}

export function isGa4Enabled(): boolean {
  return Boolean(getMeasurementId() && typeof window !== 'undefined');
}

/**
 * Load gtag.js once and register the measurement ID. Called from {@link usePageTracking} on app boot.
 * Uses `send_page_view: false`; SPA sends page_view on each route via {@link gaPageView}.
 */
export function initGa4(): void {
  initAnalytics();
}

/** SPA route changes — explicit GA4 `page_view` event. */
export function gaPageView(path: string, title?: string): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  if (!getMeasurementId()) return;
  const pagePath = path.startsWith('/') ? path : `/${path}`;
  const payload: Record<string, unknown> = {
    page_path: pagePath,
    page_title: title ?? (typeof document !== 'undefined' ? document.title : ''),
    page_location: window.location.href,
  };
  if (import.meta.env.DEV) {
    payload.debug_mode = true;
  }
  window.gtag('event', 'page_view', payload);
  if (import.meta.env.DEV) {
    console.debug('[GA] page_view event', pagePath);
  }
}

export function gaEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  if (!getMeasurementId()) return;
  window.gtag('event', name, params);
}
