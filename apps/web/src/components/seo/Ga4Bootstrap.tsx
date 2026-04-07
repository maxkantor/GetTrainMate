import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackSpaPageView } from '@/utils/analytics';
import { getMeasurementId, initGa4 } from '@/lib/gtag';
import { getRouteSeo } from '@/config/seoRoutes';

/**
 * One-time GA4 script load + SPA page_view on route changes (no double-count with send_page_view: false).
 */
export const Ga4Bootstrap: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    initGa4();
  }, []);

  useEffect(() => {
    if (!getMeasurementId()) return;
    const seo = getRouteSeo(pathname);
    trackSpaPageView(pathname, seo.title);
  }, [pathname]);

  return null;
};
