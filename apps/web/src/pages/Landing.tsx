import React, { useEffect } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Button, Container, Typography } from '@mui/material';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { useActiveEvents } from '@/hooks/useActiveEvents';
import { LoggedInActionHero } from '@/components/app/LoggedInActionHero';
import { Hero } from '@/sections/Hero';
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
    !!featuredEvent;

  /** When navigating from another route (e.g. Pricing) to /#how-it-works, scroll after marketing sections mount. */
  useEffect(() => {
    if (isAuthenticated) return;
    trackEvent('landing_page_view', {
      source_page: location.pathname,
      user_status: 'guest',
    });
  }, [isAuthenticated, location.pathname]);

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
      {showEventPromo && featuredEvent ? (
        <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
          <Box
            sx={{
              borderRadius: 3,
              border: '1px solid rgba(128,128,255,0.35)',
              background: `linear-gradient(120deg, ${featuredEvent.themeColor || '#2b2c7f'}22, rgba(12,13,28,0.95)), url(${featuredEvent.bannerImageUrl || ''})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              p: { xs: 2, sm: 3 },
              display: 'flex',
              justifyContent: 'space-between',
              gap: 2,
              alignItems: { xs: 'flex-start', sm: 'center' },
              flexDirection: { xs: 'column', sm: 'row' },
            }}
          >
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.4 }}>
                {featuredEvent.icon} {featuredEvent.label}
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 720, mt: 0.8 }}>
                {featuredEvent.description?.trim() || 'Find people to train, play, watch, meet, vibe, or date.'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                component={RouterLink}
                to={`/events/${featuredEvent.eventId}`}
                onClick={() =>
                  trackEvent('event_banner_click', {
                    eventId: featuredEvent.eventId,
                    eventLabel: featuredEvent.label,
                    sport: featuredEvent.sport,
                    sourcePage: '/',
                  })
                }
              >
                {featuredEvent.landingHeadline?.trim() || 'Find People Near You'}
              </Button>
              <Button variant="contained" component={RouterLink} to="/signup">
                Start Free
              </Button>
            </Box>
          </Box>
        </Container>
      ) : null}
      <SwipeDemoSection />
      <div className={styles.sectionDivider} aria-hidden />
      <Features />
      <WhoIsThisFor />
      <Testimonials />
      <FinalCTA />
    </>
  );
};
