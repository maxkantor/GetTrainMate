import React, { useEffect } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Box, Button, Container, Typography } from '@mui/material';
import { PageShell } from '@/components/layout/PageShell';
import { trackEvent } from '@/utils/analytics';
import { markReferralLandingVisit } from '@/utils/acquisitionAttribution';
import { buildReferralSignupPath, isValidReferralCode } from '@/utils/referralInvite';

/**
 * EXP-003 Atlanta TRAIN referral landing.
 * Distinct from EXP-001 SEO landing and EXP-002 partner invite codes.
 * Does not resolve or display the referring user.
 */
export const AtlantaReferralLandingPage: React.FC = () => {
  const { refCode } = useParams<{ refCode?: string }>();
  const code = isValidReferralCode(refCode) ? String(refCode) : '';

  useEffect(() => {
    markReferralLandingVisit(code || undefined);
    trackEvent('landing_page_view', {
      source_page: code ? `/invite/${code}` : '/invite',
      metro: 'Atlanta',
      segment: 'TRAIN',
      acquisition_source: 'referral',
      experiment_id: 'EXP-003',
    });
  }, [code]);

  const signupTo = code
    ? buildReferralSignupPath(code)
    : '/signup?metro=Atlanta&mode=TRAIN&src=referral&experiment_id=EXP-003';

  return (
    <PageShell variant="content" showBackLink>
      <Container maxWidth="md" disableGutters sx={{ maxWidth: '100%', px: { xs: 2, sm: 0 } }}>
        <Typography
          variant="h2"
          component="h1"
          sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, fontWeight: 800, lineHeight: 1.2 }}
        >
          You were invited to train in Atlanta
        </Typography>
        <Typography
          variant="h3"
          component="p"
          sx={{ mt: 1.5, fontSize: { xs: '1.15rem', md: '1.35rem' }, fontWeight: 600 }}
        >
          Find a training partner on GetTrainMate — TRAIN-first, not dating-first.
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2, maxWidth: 560, lineHeight: 1.7 }}>
          Create a free profile, choose TRAIN, set your city to Atlanta, and start Discover. No guaranteed
          matches. You control your profile. We do not message your contacts for you.
        </Typography>
        <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          <Button
            component={RouterLink}
            to={signupTo}
            variant="contained"
            size="large"
            onClick={() =>
              trackEvent('signup_started', {
                source_page: code ? `/invite/${code}` : '/invite',
                metro: 'Atlanta',
                segment: 'TRAIN',
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
