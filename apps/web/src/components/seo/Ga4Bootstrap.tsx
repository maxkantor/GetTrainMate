import React from 'react';
import { usePageTracking } from '@/hooks/usePageTracking';

/**
 * Mount once under `<BrowserRouter>`: loads gtag.js once, disables auto page_view, sends manual
 * `page_view` on each navigation (pathname + search). See {@link usePageTracking}.
 */
export const Ga4Bootstrap: React.FC = () => {
  usePageTracking();
  return null;
};
