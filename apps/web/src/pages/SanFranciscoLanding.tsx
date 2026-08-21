import React, { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Container, Typography } from '@mui/material';
import { PageShell } from '@/components/layout/PageShell';
import { trackEvent } from '@/utils/analytics';

/**
 * San Francisco density acquisition landing.
 * Chosen from CRM evidence (highest completed-profile metro), not Atlanta default.
 * TRAIN + VIBE + DATE — no fake density claims.
 */
export const SanFranciscoLandingPage: React.FC = () => {
  useEffect(() => {
    trackEvent('landing_page_view', {
      source_page: '/san-francisco',
      metro: 'San Francisco',
      country: 'US',
      acquisition_source: 'san-francisco',
      experiment_id: 'EXP-004',
    });
  }, []);

  return (
    <PageShell variant="content" showBackLink>
      <Container maxWidth="md" disableGutters sx={{ maxWidth: '100%', px: { xs: 2, sm: 0 } }}>
        <Typography
          variant="overline"
          component="p"
          sx={{ letterSpacing: 1.2, color: 'primary.main', fontWeight: 700 }}
        >
          San Francisco Bay Area
        </Typography>
        <Typography
          variant="h2"
          component="h1"
          sx={{ mt: 1, fontSize: { xs: '1.85rem', md: '2.4rem' }, fontWeight: 800, lineHeight: 1.15 }}
        >
          Meet active people in San Francisco
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2, maxWidth: 560, lineHeight: 1.7 }}>
          GetTrainMate is TRAIN + VIBE + DATE — find workout partners, social plans, or activity-based
          dating in the Bay Area. Free to join. Matches are never guaranteed.
        </Typography>

        <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'stretch', maxWidth: 420 }}>
          <Button
            component={RouterLink}
            to="/signup?metro=San%20Francisco&mode=TRAIN&src=san-francisco&experiment_id=EXP-004&utm_campaign=us_sf_train"
            variant="contained"
            size="large"
            onClick={() =>
              trackEvent('signup_started', {
                source_page: '/san-francisco',
                metro: 'San Francisco',
                mode: 'TRAIN',
                acquisition_source: 'san-francisco',
                experiment_id: 'EXP-004',
              })
            }
          >
            Join free — TRAIN
          </Button>
          <Button
            component={RouterLink}
            to="/signup?metro=San%20Francisco&mode=VIBE&src=san-francisco&experiment_id=EXP-004&utm_campaign=us_sf_vibe"
            variant="outlined"
            size="large"
            onClick={() =>
              trackEvent('signup_started', {
                source_page: '/san-francisco',
                metro: 'San Francisco',
                mode: 'VIBE',
                acquisition_source: 'san-francisco',
                experiment_id: 'EXP-004',
              })
            }
          >
            Join free — VIBE
          </Button>
          <Button
            component={RouterLink}
            to="/signup?metro=San%20Francisco&mode=DATE&src=san-francisco&experiment_id=EXP-004&utm_campaign=us_sf_date"
            variant="outlined"
            size="large"
            onClick={() =>
              trackEvent('signup_started', {
                source_page: '/san-francisco',
                metro: 'San Francisco',
                mode: 'DATE',
                acquisition_source: 'san-francisco',
                experiment_id: 'EXP-004',
              })
            }
          >
            Join free — DATE
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 3, maxWidth: 560, lineHeight: 1.6 }}>
          After signup: set San Francisco as your city → complete your profile → open Discover. You can
          change mode anytime.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, maxWidth: 560, lineHeight: 1.6 }}>
          Looking elsewhere?{' '}
          <RouterLink to="/workout-partner" style={{ color: 'inherit' }}>
            TRAIN worldwide
          </RouterLink>
          {' · '}
          <RouterLink to="/meet-people" style={{ color: 'inherit' }}>
            VIBE
          </RouterLink>
          {' · '}
          <RouterLink to="/active-dating" style={{ color: 'inherit' }}>
            DATE
          </RouterLink>
        </Typography>
      </Container>
    </PageShell>
  );
};
