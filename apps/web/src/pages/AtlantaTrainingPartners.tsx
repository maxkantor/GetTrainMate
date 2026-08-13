import React, { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Container, List, ListItem, ListItemText, Typography } from '@mui/material';
import { PageShell } from '@/components/layout/PageShell';
import { trackEvent } from '@/utils/analytics';
import { markAtlantaLandingVisit } from '@/utils/acquisitionAttribution';

/**
 * Atlanta-focused acquisition landing (EXP-001).
 * High-intent local SEO surface — no fake density claims.
 */
export const AtlantaTrainingPartnersPage: React.FC = () => {
  useEffect(() => {
    markAtlantaLandingVisit();
    trackEvent('landing_page_view', {
      source_page: '/atlanta-training-partners',
      metro: 'Atlanta',
      segment: 'TRAIN',
      acquisition_source: 'atlanta-training-partners',
    });
  }, []);

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
          sx={{ mt: 1.5, fontSize: { xs: '1.15rem', md: '1.35rem' }, fontWeight: 600, color: 'text.primary' }}
        >
          Find a training partner in Atlanta
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2, maxWidth: 560, lineHeight: 1.7 }}>
          Looking for someone to lift with, run with, or train Hyrox / CrossFit near you? GetTrainMate
          matches active people by intent (TRAIN first), schedule, and city — starting with Atlanta.
        </Typography>

        <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          <Button
            component={RouterLink}
            to="/signup?metro=Atlanta&mode=TRAIN&src=atlanta-training-partners"
            variant="contained"
            size="large"
            onClick={() =>
              trackEvent('signup_started', {
                source_page: '/atlanta-training-partners',
                metro: 'Atlanta',
                segment: 'TRAIN',
              })
            }
          >
            Create free account
          </Button>
          <Button component={RouterLink} to="/pricing" variant="outlined" size="large">
            See pricing
          </Button>
        </Box>

        <Typography variant="h4" component="h2" sx={{ mt: 6, mb: 2, fontSize: '1.25rem', fontWeight: 700 }}>
          Built for Atlanta fitness communities
        </Typography>
        <List dense disablePadding>
          {[
            'Gyms and trainers looking for consistent partners',
            'Run clubs and recreational sports',
            'Pickleball and group training',
            'People who want TRAIN mode — not dating-first pressure',
          ].map((item) => (
            <ListItem key={item} disableGutters sx={{ py: 0.5 }}>
              <ListItemText primary={item} primaryTypographyProps={{ color: 'text.secondary' }} />
            </ListItem>
          ))}
        </List>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 4, lineHeight: 1.7 }}>
          We focus on one metro at a time so matches stay local and useful. Choose TRAIN on signup, set
          Atlanta as your city, and start Discover when your profile is ready.
        </Typography>

        <Box sx={{ mt: 4, mb: 2 }}>
          <Button
            component={RouterLink}
            to="/signup?metro=Atlanta&mode=TRAIN&src=atlanta-training-partners"
            variant="contained"
            size="large"
            onClick={() =>
              trackEvent('signup_started', {
                source_page: '/atlanta-training-partners',
                metro: 'Atlanta',
                segment: 'TRAIN',
                cta: 'bottom',
              })
            }
          >
            Join GetTrainMate in Atlanta
          </Button>
        </Box>
      </Container>
    </PageShell>
  );
};

export default AtlantaTrainingPartnersPage;
