/**
 * Google Analytics 4 (gtag.js) — single init, SPA-safe page_view, typed events.
 * Measurement ID: VITE_GA_MEASUREMENT_ID (e.g. G-Z4RSKMHPQQ).
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
  const id = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GA_MEASUREMENT_ID;
  return id ? String(id).trim() : undefined;
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
