import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getMeasurementId, initGa4 } from '@/lib/gtag';
import { getRouteSeo } from '@/config/seoRoutes';
import { trackPageView } from '@/utils/analytics';

/**
 * Module-level dedupe: avoids double page_view in React 18 StrictMode (mount → unmount → remount)
 * when location is unchanged.
 */
let lastPageViewDedupeKey = '';

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

    const pathForAnalytics = `${location.pathname}${location.search}`;
    const dedupeKey = `${location.key}|${pathForAnalytics}`;
    if (dedupeKey === lastPageViewDedupeKey) return;
    lastPageViewDedupeKey = dedupeKey;

    const seo = getRouteSeo(location.pathname);
    trackPageView(pathForAnalytics, seo.title);
  }, [location]);
}
