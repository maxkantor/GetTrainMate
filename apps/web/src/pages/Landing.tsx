import React, { useEffect } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Button, Container, Typography } from '@mui/material';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useI18n } from '@/hooks/useI18n';
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

const EN_EMOTIONAL_LINE = "Don't watch alone this year.";
const EN_SOCIAL_PROOF_LINE = 'Fans are already connecting near you.';
const EN_URGENCY_LINE = 'Limited free connections — start now.';
const EN_DEFAULT_EVENT_COPY = 'find people to train, play, watch, meet, vibe, or date';

const normalizeCopy = (value: string) => value.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();
const isSeededEnglishEventCopy = (value?: string) => {
  const normalized = normalizeCopy(value ?? '');
  return normalized.includes(EN_DEFAULT_EVENT_COPY) || normalized.includes(normalizeCopy(EN_SOCIAL_PROOF_LINE));
};

export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuthContext();
  const { locale, t } = useI18n();
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
  const crmDescription = featuredEvent?.description?.trim();
  const eventDescription = crmDescription && (locale === 'en' || !isSeededEnglishEventCopy(crmDescription))
    ? crmDescription
    : t('sports_event_layer.default_description');
  const eventCopy = normalizeCopy(`${eventDescription} ${featuredEvent?.landingHeadline ?? ''} ${featuredEvent?.ctaLabel ?? ''}`);
  const eventEmotionalLine = t('sports_event_layer.emotional_line');
  const eventSocialProofLine = t('sports_event_layer.social_proof_line');
  const eventUrgencyLine = t('sports_event_layer.urgency_line');
  const shouldShowLine = (line: string, englishLine: string) =>
    !eventCopy.includes(normalizeCopy(line)) && !eventCopy.includes(normalizeCopy(englishLine));

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
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 260px' },
              gap: { xs: 2.5, md: 4 },
              alignItems: 'center',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.4 }}>
                {featuredEvent.icon} {featuredEvent.label}
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 720, mt: 0.8 }}>
                {eventDescription}
              </Typography>
              {shouldShowLine(eventEmotionalLine, EN_EMOTIONAL_LINE) ? (
                <Typography sx={{ mt: 0.8, fontWeight: 700 }}>
                  {eventEmotionalLine}
                </Typography>
              ) : null}
              {shouldShowLine(eventSocialProofLine, EN_SOCIAL_PROOF_LINE) ? (
                <Typography color="text.secondary" sx={{ mt: 0.6, fontWeight: 600 }}>
                  {eventSocialProofLine}
                </Typography>
              ) : null}
              {shouldShowLine(eventUrgencyLine, EN_URGENCY_LINE) ? (
                <Typography color="warning.main" sx={{ mt: 0.35, fontWeight: 700 }}>
                  {eventUrgencyLine}
                </Typography>
              ) : null}
            </Box>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                width: '100%',
                maxWidth: { md: 260 },
                justifySelf: { xs: 'stretch', md: 'end' },
              }}
            >
              <Button
                variant="contained"
                component={RouterLink}
                to={`/events/${featuredEvent.eventId}`}
                size="large"
                onClick={() => {
                  window.sessionStorage.setItem('gtm_event_first_click', '1');
                  trackEvent('event_banner_click', {
                    eventId: featuredEvent.eventId,
                    eventLabel: featuredEvent.label,
                    sport: featuredEvent.sport,
                    sourcePage: '/',
                  });
                }}
                sx={{ width: '100%', minHeight: 44, whiteSpace: 'nowrap', fontWeight: 800 }}
              >
                {featuredEvent.ctaLabel?.trim() || t('sports_event_layer.primary_cta')}
              </Button>
              <Button variant="outlined" component={RouterLink} to="/signup" size="large" sx={{ width: '100%', minHeight: 44, whiteSpace: 'nowrap' }}>
                {t('sports_event_layer.secondary_cta')}
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ textAlign: { xs: 'left', md: 'center' } }}>
                {t('sports_event_layer.trust_text')}
              </Typography>
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
