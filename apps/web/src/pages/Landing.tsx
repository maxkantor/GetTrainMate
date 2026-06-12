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
import { normalizePublicAssetUrl } from '@/utils/publicAssetUrl';
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
  const eventThemeColor = featuredEvent?.themeColor?.trim() || '#2b2c7f';
  const eventBannerImageUrl = normalizePublicAssetUrl(featuredEvent?.bannerImageUrl);
  const showEventPromo =
    !isAuthenticated &&
    featureFlagsService.isFeatureEnabled(featureFlags, 'sports_event_layer') &&
    !!featuredEvent &&
    featuredEvent.homepageVisible !== false;
  const eventHubLink = featuredEvent?.hubRoute?.trim() || '/world-cup';
  const isWorldCupPromo = featuredEvent?.eventId === 'world-cup-2026';
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
        <Container maxWidth="md" sx={{ mt: 1.5, mb: 2.5, position: 'relative' }}>
          <Box
            sx={{
              borderRadius: 3,
              border: `1px solid ${eventBannerImageUrl ? `${eventThemeColor}88` : 'rgba(128,128,255,0.35)'}`,
              background: `linear-gradient(120deg, rgba(3,5,18,0.94), rgba(8,7,28,0.76), rgba(3,5,18,0.92)), radial-gradient(720px 280px at 16% 0%, ${eventThemeColor}30, transparent 62%), url('/images/section-worldcup-bg.png') center center / cover no-repeat, linear-gradient(120deg, rgba(7,10,24,0.98), rgba(24,18,54,0.92) 48%, rgba(4,7,20,0.96))`,
              p: { xs: 2, sm: 2.5 },
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 220px' },
              gap: { xs: 2, md: 3 },
              alignItems: 'center',
              minHeight: eventBannerImageUrl ? { xs: 180, md: 150 } : undefined,
              position: 'relative',
              overflow: 'hidden',
              boxShadow: eventBannerImageUrl ? `0 18px 60px ${eventThemeColor}30` : undefined,
            }}
          >
            {eventBannerImageUrl ? (
              <>
                <Box
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    inset: -6,
                    zIndex: 0,
                    backgroundImage: `url("${eventBannerImageUrl}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center 42%',
                    opacity: 0.24,
                    filter: 'blur(1px) saturate(1.15)',
                    transform: 'scale(1.03)',
                    pointerEvents: 'none',
                  }}
                />
                <Box
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 0,
                    background: `linear-gradient(120deg, rgba(4,7,20,0.7), rgba(4,7,20,0.5)), linear-gradient(120deg, ${eventThemeColor}26, transparent)`,
                    pointerEvents: 'none',
                  }}
                />
              </>
            ) : null}
            <Box sx={{ minWidth: 0, position: 'relative', zIndex: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.4 }}>
                {featuredEvent.icon} {isWorldCupPromo ? t('event_hub.promo_home_title') : (featuredEvent.homepageHeadline || featuredEvent.label)}
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 720, mt: 0.8 }}>
                {isWorldCupPromo ? t('event_hub.promo_home_copy') : (featuredEvent.homepageSubheadline || eventDescription)}
              </Typography>
              {isWorldCupPromo ? (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                  {t('event_hub.trust_line')}
                </Typography>
              ) : featuredEvent.homepagePromoText ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
                  {featuredEvent.homepagePromoText}
                </Typography>
              ) : null}
              {!isWorldCupPromo && shouldShowLine(eventEmotionalLine, EN_EMOTIONAL_LINE) ? (
                <Typography sx={{ mt: 0.8, fontWeight: 700 }}>
                  {eventEmotionalLine}
                </Typography>
              ) : null}
              {!isWorldCupPromo && shouldShowLine(eventSocialProofLine, EN_SOCIAL_PROOF_LINE) ? (
                <Typography color="text.secondary" sx={{ mt: 0.6, fontWeight: 600 }}>
                  {eventSocialProofLine}
                </Typography>
              ) : null}
              {!isWorldCupPromo && shouldShowLine(eventUrgencyLine, EN_URGENCY_LINE) ? (
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
                position: 'relative',
                zIndex: 1,
              }}
            >
              <Button
                variant="contained"
                component={RouterLink}
                to={eventHubLink}
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
                sx={{
                  width: '100%',
                  minHeight: 44,
                  whiteSpace: 'nowrap',
                  fontWeight: 800,
                  bgcolor: eventThemeColor,
                  borderColor: eventThemeColor,
                  boxShadow: `0 0 0 1px ${eventThemeColor}55, 0 14px 34px ${eventThemeColor}44`,
                  '&:hover': {
                    bgcolor: eventThemeColor,
                    borderColor: eventThemeColor,
                    boxShadow: `0 0 0 1px ${eventThemeColor}88, 0 18px 42px ${eventThemeColor}55`,
                    filter: 'brightness(1.08)',
                  },
                }}
              >
                {featuredEvent.homepageCtaPrimary || featuredEvent.ctaLabel?.trim() || t('event_hub.cta_predict')}
              </Button>
              <Button
                variant="outlined"
                component={RouterLink}
                to={eventHubLink}
                size="large"
                sx={{
                  width: '100%',
                  minHeight: 44,
                  whiteSpace: 'nowrap',
                  borderColor: `${eventThemeColor}aa`,
                  color: 'text.primary',
                  '&:hover': {
                    borderColor: eventThemeColor,
                    bgcolor: `${eventThemeColor}18`,
                  },
                }}
              >
                {isWorldCupPromo ? t('event_hub.promo_home_cta_secondary') : (featuredEvent.homepageCtaSecondary || t('event_hub.cta_connect'))}
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
