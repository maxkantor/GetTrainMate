/**
 * Google Analytics 4 (gtag.js) — single init, SPA-safe page_view, typed events.
 * Measurement ID must come from `VITE_GA_MEASUREMENT_ID` (set in AWS Amplify env for production builds, or `apps/web/.env` locally).
 * Vite inlines it at build time — there is no hardcoded GA ID in the bundle.
 */

import { SITE_ORIGIN } from '@/config/site';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const INIT_FLAG = '__GTM_GA4_INITIALIZED__';

export function getMeasurementId(): string | undefined {
  const raw =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_GA_MEASUREMENT_ID != null
      ? String(import.meta.env.VITE_GA_MEASUREMENT_ID).trim()
      : '';
  return raw || undefined;
}

export function isGa4Enabled(): boolean {
  return Boolean(getMeasurementId() && typeof window !== 'undefined');
}

/** Load gtag.js once; call config with send_page_view: false (SPA sends page_view manually). */
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

export function gaPageView(path: string, title?: string): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  const mid = getMeasurementId();
  if (!mid) return;
  const pagePath = path.startsWith('/') ? path : `/${path}`;
  const pageLocation =
    typeof window !== 'undefined' && window.location?.href
      ? window.location.href
      : `${SITE_ORIGIN}${pagePath}`;
  window.gtag('event', 'page_view', {
    page_path: pagePath,
    page_title: title ?? (typeof document !== 'undefined' ? document.title : ''),
    page_location: pageLocation,
  });
}

export function gaEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  if (!getMeasurementId()) return;
  window.gtag('event', name, params);
}
