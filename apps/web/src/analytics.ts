declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
const INIT_FLAG = '__GTM_GA4_INITIALIZED__';
const SCRIPT_FLAG = '__GTM_GA4_SCRIPT_ATTACHED__';
const SCRIPT_ID = 'ga4-gtag-js';

function ensureGtagScript(measurementId: string): void {
  if (typeof document === 'undefined') return;
  if ((window as unknown as Record<string, boolean>)[SCRIPT_FLAG]) return;
  if (document.getElementById(SCRIPT_ID)) {
    (window as unknown as Record<string, boolean>)[SCRIPT_FLAG] = true;
    return;
  }

  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
  (window as unknown as Record<string, boolean>)[SCRIPT_FLAG] = true;
}

export function getGaMeasurementId(): string | undefined {
  if (typeof GA_ID !== 'string') return undefined;
  const trimmed = GA_ID.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function initAnalytics(): void {
  if (typeof window === 'undefined') return;

  const measurementId = getGaMeasurementId();
  if (!measurementId) return;
  ensureGtagScript(measurementId);

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    (function gtag(): void {
      window.dataLayer!.push(arguments);
    } as unknown as (...args: unknown[]) => void);

  if ((window as unknown as Record<string, boolean>)[INIT_FLAG]) return;

  // Required GA bootstrap events/config.
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    send_page_view: false,
  });

  (window as unknown as Record<string, boolean>)[INIT_FLAG] = true;
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console -- useful for local GA validation
    console.debug('[GA] initialized', measurementId);
  }
}
