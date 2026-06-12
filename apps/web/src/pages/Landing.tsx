import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { useActiveEvents } from '@/hooks/useActiveEvents';
import { LoggedInActionHero } from '@/components/app/LoggedInActionHero';
import { Hero } from '@/sections/Hero';
import { EventPromoSection } from '@/sections/EventPromoSection';
import { SwipeDemoSection } from '@/sections/SwipeDemoSection';
import { Features } from '@/sections/Features';
import { WhoIsThisFor } from '@/sections/WhoIsThisFor';
import { Testimonials } from '@/sections/Testimonials';
import { FinalCTA } from '@/sections/FinalCTA';
import { trackEvent } from '@/utils/analytics';
import { featureFlagsService } from '@/services/featureFlagsService';
import styles from '@/sections/sections.module.css';

export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuthContext();
  const { me, loading } = useMe();
  const location = useLocation();
  const { data: featureFlags } = useQuery({
    queryKey: ['landing-feature-flags'],
    queryFn: () => featureFlagsService.getFlags(),
    staleTime: 30_000,
  });
  const { data: activeEvents } = useActiveEvents();
  const featuredEvent = (activeEvents ?? []).find((x) => x.isFeatured);
  const showEventPromo =
    !isAuthenticated &&
    featureFlagsService.isFeatureEnabled(featureFlags, 'sports_event_layer') &&
    !!featuredEvent &&
    featuredEvent.homepageVisible !== false;

  useEffect(() => {
    if (isAuthenticated) return;
    trackEvent('landing_page_view', {
      source_page: location.pathname,
      user_status: 'guest',
    });
  }, [isAuthenticated, location.pathname]);

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

  useEffect(() => {
    if (!showEventPromo || !featuredEvent) return;
    trackEvent('event_banner_view', {
      eventId: featuredEvent.eventId,
      eventLabel: featuredEvent.label,
      sport: featuredEvent.sport,
      sourcePage: '/',
    });
  }, [showEventPromo, featuredEvent]);

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
      {showEventPromo && featuredEvent ? <EventPromoSection event={featuredEvent} /> : null}
      <SwipeDemoSection />
      <div className={styles.sectionDivider} aria-hidden />
      <Features />
      <WhoIsThisFor />
      <Testimonials />
      <FinalCTA />
    </>
  );
};
