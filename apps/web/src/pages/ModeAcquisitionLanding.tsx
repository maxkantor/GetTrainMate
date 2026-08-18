import React, { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Container, List, ListItem, ListItemText, Typography } from '@mui/material';
import { PageShell } from '@/components/layout/PageShell';
import { trackEvent } from '@/utils/analytics';

export type ModeLandingCopy = {
  path: string;
  mode: 'TRAIN' | 'VIBE' | 'DATE';
  headline: string;
  subhead: string;
  body: string;
  bullets: string[];
  cta: string;
  signupQuery: string;
};

export const MODE_LANDINGS: Record<string, ModeLandingCopy> = {
  TRAIN: {
    path: '/workout-partner',
    mode: 'TRAIN',
    headline: 'Find a workout partner',
    subhead: 'Gym, running, pickleball, HYROX, cycling — TRAIN is one mode on GetTrainMate, not the whole product.',
    body: 'GetTrainMate is an international TRAIN + VIBE + DATE marketplace. Choose TRAIN if you want someone to train with in your city. Set your location, complete your profile, and open Discover. Matches are never guaranteed.',
    bullets: [
      'Workout, running, sports, and race partners',
      'Pick TRAIN so you are not mixed into dating-first results',
      'Works in any supported city — not Atlanta-only',
      'VIBE and DATE stay available if your intent changes',
    ],
    cta: 'Create a TRAIN profile',
    signupQuery: 'mode=TRAIN&src=workout-partner',
  },
  VIBE: {
    path: '/meet-people',
    mode: 'VIBE',
    headline: 'Find people to hang out with',
    subhead: 'New in town, events, coffee, concerts, weekend plans — VIBE is for social discovery.',
    body: 'VIBE is for friendship and shared interests, not a dating-only funnel. Pick VIBE, set your city, and use Discover. GetTrainMate also has TRAIN and DATE if that is what you want instead. No guaranteed hangouts.',
    bullets: [
      'People new to a city and looking for plans',
      'Events, restaurants, travel, and shared hobbies',
      'Separate from DATE unless you choose that mode',
      'Localized by your city and language — not one hardcoded market',
    ],
    cta: 'Create a VIBE profile',
    signupQuery: 'mode=VIBE&src=meet-people',
  },
  DATE: {
    path: '/active-dating',
    mode: 'DATE',
    headline: 'Meet people through shared interests',
    subhead: 'Activity-based dating is optional. DATE is one mode — never a promise of dates or relationships.',
    body: 'Choose DATE if you want romantic discovery alongside real activities. TRAIN and VIBE remain separate modes. You control your profile. GetTrainMate does not guarantee matches, dates, or outcomes.',
    bullets: [
      'Dating through sports, events, and shared interests',
      'You only see DATE when you select it',
      'International and multilingual — not a single-city product',
      'No guaranteed dates or relationships',
    ],
    cta: 'Create a DATE profile',
    signupQuery: 'mode=DATE&src=active-dating',
  },
};

export const ModeAcquisitionLanding: React.FC<{ copy: ModeLandingCopy }> = ({ copy }) => {
  useEffect(() => {
    trackEvent('landing_page_view', {
      source_page: copy.path,
      segment: copy.mode,
      acquisition_source: copy.path.replace('/', ''),
    });
  }, [copy.path, copy.mode]);

  return (
    <PageShell variant="content" showBackLink>
      <Container maxWidth="md" disableGutters sx={{ maxWidth: '100%', px: { xs: 2, sm: 0 } }}>
        <Typography variant="h2" component="h1" sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, fontWeight: 800, lineHeight: 1.2 }}>
          GetTrainMate
        </Typography>
        <Typography variant="h3" component="p" sx={{ mt: 1.5, fontSize: { xs: '1.15rem', md: '1.35rem' }, fontWeight: 600 }}>
          {copy.headline}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2, maxWidth: 600, lineHeight: 1.7 }}>
          {copy.subhead}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2, maxWidth: 600, lineHeight: 1.7 }}>
          {copy.body}
        </Typography>
        <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          <Button
            component={RouterLink}
            to={`/signup?${copy.signupQuery}`}
            variant="contained"
            size="large"
            onClick={() =>
              trackEvent('signup_started', {
                source_page: copy.path,
                segment: copy.mode,
              })
            }
          >
            {copy.cta}
          </Button>
          <Button component={RouterLink} to="/pricing" variant="outlined" size="large">
            See pricing
          </Button>
        </Box>
        <List dense disablePadding sx={{ mt: 4 }}>
          {copy.bullets.map((item) => (
            <ListItem key={item} disableGutters sx={{ py: 0.5 }}>
              <ListItemText primary={item} primaryTypographyProps={{ color: 'text.secondary' }} />
            </ListItem>
          ))}
        </List>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 4, lineHeight: 1.7 }}>
          Modes: TRAIN · VIBE · DATE. Concentrate where real conversations start — do not scatter empty profiles worldwide.
        </Typography>
      </Container>
    </PageShell>
  );
};

export const WorkoutPartnerPage: React.FC = () => <ModeAcquisitionLanding copy={MODE_LANDINGS.TRAIN} />;
export const MeetPeoplePage: React.FC = () => <ModeAcquisitionLanding copy={MODE_LANDINGS.VIBE} />;
export const ActiveDatingPage: React.FC = () => <ModeAcquisitionLanding copy={MODE_LANDINGS.DATE} />;
