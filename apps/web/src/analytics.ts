declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
const INIT_FLAG = '__GTM_GA4_INITIALIZED__';

export function getGaMeasurementId(): string | undefined {
  if (typeof GA_ID !== 'string') return undefined;
  const trimmed = GA_ID.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function initAnalytics(): void {
  if (typeof window === 'undefined') return;

  const measurementId = getGaMeasurementId();
  if (!measurementId) return;
  if ((window as unknown as Record<string, boolean>)[INIT_FLAG]) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    (function gtag(): void {
      window.dataLayer!.push(arguments);
    } as unknown as (...args: unknown[]) => void);

  // Required GA bootstrap events/config.
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    send_page_view: false,
  });

  // Ensure global is available for manual console tests.
  if (typeof window.gtag !== 'function') {
    window.gtag = (function gtag(): void {
      window.dataLayer!.push(arguments);
    } as unknown as (...args: unknown[]) => void);
  }

  (window as unknown as Record<string, boolean>)[INIT_FLAG] = true;
  console.log('GA initialized:', measurementId);
}
