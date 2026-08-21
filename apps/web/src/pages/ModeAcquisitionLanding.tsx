import React, { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Container, Typography } from '@mui/material';
import { PageShell } from '@/components/layout/PageShell';
import { trackEvent } from '@/utils/analytics';

export type ModeLandingCopy = {
  path: string;
  mode: 'TRAIN' | 'VIBE' | 'DATE';
  eyebrow: string;
  headline: string;
  subhead: string;
  bullets: string[];
  afterJoin: string;
  cta: string;
  signupQuery: string;
  freeLine: string;
};

export const MODE_LANDINGS: Record<string, ModeLandingCopy> = {
  TRAIN: {
    path: '/workout-partner',
    mode: 'TRAIN',
    eyebrow: 'TRAIN mode',
    headline: 'Find people who actually want to train.',
    subhead:
      'Gym sessions, runs, pickleball, HYROX, cycling — match with workout partners who share your pace and schedule.',
    bullets: [
      'Filter for training intent — not dating-first results',
      'Set your city, open Discover, and start connecting',
      'Works in any supported city worldwide',
    ],
    afterJoin: 'After signup: pick TRAIN → set location → complete profile → Discover.',
    cta: 'Join free — find training partners',
    signupQuery: 'mode=TRAIN&src=workout-partner',
    freeLine: 'Free to create an account. Credits unlock chats when you are ready.',
  },
  VIBE: {
    path: '/meet-people',
    mode: 'VIBE',
    eyebrow: 'VIBE mode',
    headline: 'Meet active people you actually click with.',
    subhead:
      'New in town, weekend plans, events, coffee, concerts — find friends for real-life hangouts, not endless scrolling.',
    bullets: [
      'Social discovery for friendship and shared interests',
      'Separate from DATE unless you choose that mode',
      'Localized by your city and language',
    ],
    afterJoin: 'After signup: pick VIBE → set location → complete profile → Discover.',
    cta: 'Join free — meet people',
    signupQuery: 'mode=VIBE&src=meet-people',
    freeLine: 'Free to create an account. Credits unlock chats when you are ready.',
  },
  DATE: {
    path: '/active-dating',
    mode: 'DATE',
    eyebrow: 'DATE mode',
    headline: 'Meet someone who wants to do more than swipe.',
    subhead:
      'Activity-based dating for people who bond over sports, events, and shared interests — optional, never guaranteed.',
    bullets: [
      'Romantic discovery alongside real activities',
      'You only see DATE when you select it',
      'TRAIN and VIBE stay separate if that is what you want',
    ],
    afterJoin: 'After signup: pick DATE → set location → complete profile → Discover.',
    cta: 'Join free — start dating',
    signupQuery: 'mode=DATE&src=active-dating',
    freeLine: 'Free to create an account. Credits unlock chats when you are ready.',
  },
};

const OTHER_MODES: Record<string, { label: string; path: string }[]> = {
  TRAIN: [
    { label: 'VIBE — meet people', path: '/meet-people' },
    { label: 'DATE — active dating', path: '/active-dating' },
  ],
  VIBE: [
    { label: 'TRAIN — workout partners', path: '/workout-partner' },
    { label: 'DATE — active dating', path: '/active-dating' },
  ],
  DATE: [
    { label: 'TRAIN — workout partners', path: '/workout-partner' },
    { label: 'VIBE — meet people', path: '/meet-people' },
  ],
};

export const ModeAcquisitionLanding: React.FC<{ copy: ModeLandingCopy }> = ({ copy }) => {
  useEffect(() => {
    trackEvent('landing_page_view', {
      source_page: copy.path,
      segment: copy.mode,
      acquisition_source: copy.path.replace('/', ''),
      mode: copy.mode,
    });
  }, [copy.path, copy.mode]);

  return (
    <PageShell variant="content" showBackLink>
      <Container maxWidth="md" disableGutters sx={{ maxWidth: '100%', px: { xs: 2, sm: 0 } }}>
        <Typography
          variant="overline"
          component="p"
          sx={{ letterSpacing: 1.2, color: 'primary.main', fontWeight: 700 }}
        >
          {copy.eyebrow}
        </Typography>
        <Typography
          variant="h2"
          component="h1"
          sx={{ mt: 1, fontSize: { xs: '1.85rem', md: '2.4rem' }, fontWeight: 800, lineHeight: 1.15 }}
        >
          {copy.headline}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2, maxWidth: 560, lineHeight: 1.7 }}>
          {copy.subhead}
        </Typography>

        <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
          <Button
            component={RouterLink}
            to={`/signup?${copy.signupQuery}`}
            variant="contained"
            size="large"
            onClick={() =>
              trackEvent('signup_started', {
                source_page: copy.path,
                segment: copy.mode,
                mode: copy.mode,
                acquisition_source: copy.path.replace('/', ''),
              })
            }
          >
            {copy.cta}
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, lineHeight: 1.5 }}>
            {copy.freeLine}
          </Typography>
        </Box>

        <Box component="ul" sx={{ mt: 3.5, pl: 2.25, m: 0, maxWidth: 560 }}>
          {copy.bullets.map((item) => (
            <Box
              component="li"
              key={item}
              sx={{ color: 'text.secondary', py: 0.4, lineHeight: 1.6, fontSize: '0.95rem' }}
            >
              {item}
            </Box>
          ))}
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 3, maxWidth: 560, lineHeight: 1.6 }}>
          {copy.afterJoin}
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 4, lineHeight: 1.7 }}>
          Looking for something else?{' '}
          {OTHER_MODES[copy.mode].map((link, i) => (
            <React.Fragment key={link.path}>
              {i > 0 ? ' · ' : null}
              <RouterLink to={link.path} style={{ color: 'inherit' }}>
                {link.label}
              </RouterLink>
            </React.Fragment>
          ))}
        </Typography>
      </Container>
    </PageShell>
  );
};

export const WorkoutPartnerPage: React.FC = () => <ModeAcquisitionLanding copy={MODE_LANDINGS.TRAIN} />;
export const MeetPeoplePage: React.FC = () => <ModeAcquisitionLanding copy={MODE_LANDINGS.VIBE} />;
export const ActiveDatingPage: React.FC = () => <ModeAcquisitionLanding copy={MODE_LANDINGS.DATE} />;
