import React, { useEffect, useMemo } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Box, Button, Container, Typography } from '@mui/material';
import { PageShell } from '@/components/layout/PageShell';
import { trackEvent } from '@/utils/analytics';
import { mergeAndPersistAcquisition } from '@/utils/acquisitionAttribution';
import {
  partnerSignupPath,
  resolveAtlantaPartnerLanding,
} from '@/data/atlantaPartners';

/**
 * Reusable Atlanta TRAIN partner landing (EXP-002).
 * Unique partner invite codes — no fake density or attendance claims.
 */
export const AtlantaPartnerLandingPage: React.FC = () => {
  const { partnerCode } = useParams<{ partnerCode: string }>();
  const { partner, known } = useMemo(
    () => resolveAtlantaPartnerLanding(partnerCode),
    [partnerCode]
  );
  const signupTo = partnerSignupPath(partner.code);

  useEffect(() => {
    mergeAndPersistAcquisition({
      src: 'partner',
      partner: partner.code,
      metro: 'Atlanta',
      mode: 'TRAIN',
      experiment_id: 'EXP-002',
      utm_source: 'partner',
      utm_medium: 'invite',
      utm_campaign: partner.code,
    });
    trackEvent('landing_page_view', {
      source_page: `/partners/atlanta/${partner.code}`,
      metro: 'Atlanta',
      segment: 'TRAIN',
      acquisition_source: 'partner',
      partner_code: partner.code,
      partner_known: known ? '1' : '0',
    });
  }, [partner.code, known]);

  return (
    <PageShell variant="content" showBackLink>
      <Container maxWidth="md" disableGutters sx={{ maxWidth: '100%', px: { xs: 2, sm: 0 } }}>
        <Typography
          variant="h2"
          component="h1"
          sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, fontWeight: 800, lineHeight: 1.2 }}
        >
          GetTrainMate
        </Typography>
        <Typography
          variant="h3"
          component="p"
          sx={{ mt: 1.5, fontSize: { xs: '1.15rem', md: '1.35rem' }, fontWeight: 600 }}
        >
          {partner.displayName}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2, maxWidth: 560, lineHeight: 1.7 }}>
          {partner.blurb}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, maxWidth: 560, lineHeight: 1.7 }}>
          Invite code <strong>{partner.code}</strong> · Metro: Atlanta · Mode: TRAIN. Create a free
          account, complete your profile with Atlanta as your city, then start Discover — no fake
          match guarantees.
        </Typography>

        <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          <Button
            component={RouterLink}
            to={signupTo}
            variant="contained"
            size="large"
            onClick={() =>
              trackEvent('signup_started', {
                source_page: `/partners/atlanta/${partner.code}`,
                metro: 'Atlanta',
                segment: 'TRAIN',
                acquisition_source: 'partner',
                partner_code: partner.code,
              })
            }
          >
            Join with this invite
          </Button>
          <Button component={RouterLink} to="/atlanta-training-partners" variant="outlined" size="large">
            Atlanta overview
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 4, lineHeight: 1.7 }}>
          GetTrainMate is focusing on Atlanta TRAIN communities first so local matching stays useful.
          VIBE and DATE remain available in the app after signup.
        </Typography>
      </Container>
    </PageShell>
  );
};

export default AtlantaPartnerLandingPage;
