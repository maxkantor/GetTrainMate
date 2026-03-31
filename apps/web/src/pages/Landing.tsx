import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { LoggedInActionHero } from '@/components/app/LoggedInActionHero';
import { Hero } from '@/sections/Hero';
import { SwipeDemoSection } from '@/sections/SwipeDemoSection';
import { Features } from '@/sections/Features';
import { WhoIsThisFor } from '@/sections/WhoIsThisFor';
import { Testimonials } from '@/sections/Testimonials';
import { FinalCTA } from '@/sections/FinalCTA';
import styles from '@/sections/sections.module.css';

export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuthContext();
  const { me, loading } = useMe();
  const location = useLocation();

  /** When navigating from another route (e.g. Pricing) to /#how-it-works, scroll after marketing sections mount. */
  useEffect(() => {
    if (isAuthenticated && me) return;
    if (location.pathname !== '/') return;
    if (location.hash !== '#how-it-works') return;
    const t = window.setTimeout(() => {
      document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(t);
  }, [isAuthenticated, me, location.pathname, location.hash]);

  if (isAuthenticated && loading) {
    return (
      <div
        style={{ minHeight: '45vh' }}
        aria-busy="true"
        aria-label="Loading"
      />
    );
  }

  if (isAuthenticated && me) {
    return <LoggedInActionHero />;
  }

  return (
    <>
      <Hero />
      <SwipeDemoSection />
      <div className={styles.sectionDivider} aria-hidden />
      <Features />
      <WhoIsThisFor />
      <Testimonials />
      <FinalCTA />
    </>
  );
};
