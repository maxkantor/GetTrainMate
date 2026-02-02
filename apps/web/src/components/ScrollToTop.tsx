import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Scroll to top when route changes (e.g. footer link click) */
export const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);

  return null;
};
