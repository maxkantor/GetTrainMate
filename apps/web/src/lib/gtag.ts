/**
 * Google Analytics 4 (gtag.js) — single init, SPA-safe page_view, typed events.
 * Set VITE_GA_MEASUREMENT_ID to override; production builds default to the live GetTrainMate property.
 */

import { SITE_ORIGIN } from '@/config/site';

/** Public GA4 measurement ID for https://gettrainmate.com (same as gtag.js install snippet in GA). */
const DEFAULT_PRODUCTION_MEASUREMENT_ID = 'G-C29M8NWNY4';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const INIT_FLAG = '__GTM_GA4_INITIALIZED__';

export function getMeasurementId(): string | undefined {
  const fromEnv =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_GA_MEASUREMENT_ID;
  const trimmed = fromEnv ? String(fromEnv).trim() : '';
  if (trimmed) return trimmed;
  // Production bundle: always load gtag unless explicitly disabled via empty env in a custom setup.
  if (typeof import.meta !== 'undefined' && import.meta.env.PROD) {
    return DEFAULT_PRODUCTION_MEASUREMENT_ID;
  }
  return undefined;
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
  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title ?? document.title,
    page_location: `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`,
  });
}

export function gaEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  if (!getMeasurementId()) return;
  window.gtag('event', name, params);
}
