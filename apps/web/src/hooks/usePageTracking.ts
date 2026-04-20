import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getMeasurementId, initGa4 } from '@/lib/gtag';
import { getRouteSeo } from '@/config/seoRoutes';
import { trackEvent, trackPageView } from '@/utils/analytics';

/**
 * Module-level dedupe: avoids double page_view in React 18 StrictMode (mount → unmount → remount)
 * when location is unchanged.
 */
let lastPageViewDedupeKey = '';
const RETURN_VISIT_SENT_KEY = 'gtm_return_visit_sent';
const FIRST_VISIT_AT_KEY = 'gtm_first_visit_at';

function isAdminPath(pathname: string): boolean {
  return /^\/admin(?:\/|$)/i.test(pathname);
}

/**
 * One-time GA bootstrap + manual GA4 `page_view` on every navigation (pathname + search).
 * Mount once inside `<BrowserRouter>` (e.g. via {@link Ga4Bootstrap}).
 */
export function usePageTracking(): void {
  const location = useLocation();

  useEffect(() => {
    initGa4();
  }, []);

  useEffect(() => {
    if (!getMeasurementId()) return;
    if (isAdminPath(location.pathname)) return;

    const pathForAnalytics = `${location.pathname}${location.search}`;
    const dedupeKey = `${location.key}|${pathForAnalytics}`;
    if (dedupeKey === lastPageViewDedupeKey) return;
    lastPageViewDedupeKey = dedupeKey;

    const seo = getRouteSeo(location.pathname);
    trackPageView(pathForAnalytics, seo.title);

    const engagedKey = `gtm_user_engaged_${pathForAnalytics}`;
    const timer = window.setTimeout(() => {
      if (sessionStorage.getItem(engagedKey)) return;
      sessionStorage.setItem(engagedKey, '1');
      trackEvent('user_engaged', {
        source_page: location.pathname,
      });
    }, 5000);

    try {
      const alreadySent = sessionStorage.getItem(RETURN_VISIT_SENT_KEY) === '1';
      const hasFirstVisit = Boolean(localStorage.getItem(FIRST_VISIT_AT_KEY));
      if (!hasFirstVisit) {
        localStorage.setItem(FIRST_VISIT_AT_KEY, new Date().toISOString());
      } else if (!alreadySent) {
        sessionStorage.setItem(RETURN_VISIT_SENT_KEY, '1');
        trackEvent('return_visit', {
          source_page: location.pathname,
        });
      }
    } catch {
      // ignore storage unavailability
    }

    return () => {
      window.clearTimeout(timer);
    };
  }, [location]);
}
