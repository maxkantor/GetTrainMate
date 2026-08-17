import React, { useEffect } from 'react';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import { Box, Button, Container, Typography } from '@mui/material';
import { PageShell } from '@/components/layout/PageShell';
import { trackEvent } from '@/utils/analytics';
import { markReferralLandingVisit } from '@/utils/acquisitionAttribution';
import { buildReferralSignupPath, isValidReferralCode } from '@/utils/referralInvite';

/**
 * EXP-003 user-initiated referral landing.
 * Metro comes from the share URL (referrer city) — never force Atlanta.
 * Language (i18n) is independent of market.
 */
export const AtlantaReferralLandingPage: React.FC = () => {
  const { refCode } = useParams<{ refCode?: string }>();
  const [searchParams] = useSearchParams();
  const code = isValidReferralCode(refCode) ? String(refCode) : '';
  const metro = String(searchParams.get('metro') || '').trim();
  const mode = String(searchParams.get('mode') || 'TRAIN').trim().toUpperCase() || 'TRAIN';
  const hasMarket = Boolean(metro);

  useEffect(() => {
    markReferralLandingVisit(code || undefined, { metro: metro || undefined, mode });
    trackEvent('landing_page_view', {
      source_page: code ? `/invite/${code}` : '/invite',
      metro: metro || undefined,
      segment: mode,
      acquisition_source: 'referral',
      experiment_id: 'EXP-003',
    });
  }, [code, metro, mode]);

  const signupTo = code
    ? buildReferralSignupPath(code, { city: metro, mode })
    : `/signup?${new URLSearchParams({
        mode,
        src: 'referral',
        experiment_id: 'EXP-003',
        ...(metro ? { metro } : {}),
      }).toString()}`;

  const headline = hasMarket ? `You were invited to train in ${metro}` : 'You were invited to GetTrainMate';
  const body = hasMarket
    ? `Create a free profile, choose ${mode}, set your city to ${metro} if that is your market, and start Discover. No guaranteed matches. You control your profile. We do not message your contacts for you.`
    : `Create a free profile, choose TRAIN, VIBE, or DATE, select your city, and start Discover. No guaranteed matches. You control your profile. We do not message your contacts for you.`;

  return (
    <PageShell variant="content" showBackLink>
      <Container maxWidth="md" disableGutters sx={{ maxWidth: '100%', px: { xs: 2, sm: 0 } }}>
        <Typography
          variant="h2"
          component="h1"
          sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, fontWeight: 800, lineHeight: 1.2 }}
        >
          {headline}
        </Typography>
        <Typography
          variant="h3"
          component="p"
          sx={{ mt: 1.5, fontSize: { xs: '1.15rem', md: '1.35rem' }, fontWeight: 600 }}
        >
          Find a local partner on GetTrainMate — TRAIN, VIBE, and DATE stay available after signup.
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2, maxWidth: 560, lineHeight: 1.7 }}>
          {body}
        </Typography>
        {!hasMarket ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, maxWidth: 560, lineHeight: 1.7 }}>
            Choose your city on the next screen. Language and location are independent settings.
          </Typography>
        ) : null}
        <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          <Button
            component={RouterLink}
            to={signupTo}
            variant="contained"
            size="large"
            onClick={() =>
              trackEvent('signup_started', {
                source_page: code ? `/invite/${code}` : '/invite',
                metro: metro || undefined,
                segment: mode,
                acquisition_source: 'referral',
                experiment_id: 'EXP-003',
              })
            }
          >
            Create free account
          </Button>
        </Box>
      </Container>
    </PageShell>
  );
};
