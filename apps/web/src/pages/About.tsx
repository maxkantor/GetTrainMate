import React from 'react';
import { Container, Typography, Box, Grid, Card, CardContent } from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { PageShell } from '@/components/layout/PageShell';

const founderActivities = ['Soccer / Football', 'Gym workouts', 'Pickleball', 'Fishing'];

export const AboutPage: React.FC = () => {
  const { t: _t } = useI18n();

  const stats = [
    { value: '1', label: 'Builder' },
    { value: 'Solo', label: 'Indie product' },
    { value: 'Real', label: 'Training-first' },
    { value: 'No fluff', label: 'Straight talk' },
  ];

  const values = [
    {
      title: 'Show up',
      description: 'Partners who actually train — not endless chat or flaky plans.',
    },
    {
      title: 'Inclusive',
      description: 'Any level, any sport — if you take training seriously, you belong here.',
    },
    {
      title: 'Safety & trust',
      description: 'Verified profiles and secure messaging so you can connect with confidence.',
    },
    {
      title: 'Honest product',
      description: 'Built by one person who trains — not a fake team or borrowed credibility.',
    },
  ];

  return (
    <PageShell variant="content" showBackLink>
      <Container maxWidth="lg" disableGutters sx={{ maxWidth: '100%' }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h2" component="h1" gutterBottom sx={{ fontSize: '1.75rem' }}>
            About GetTrainMate
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '640px', mx: 'auto', mt: 2 }}>
            I built this to help you find people who train like they mean it.
          </Typography>
        </Box>

        {/* Stats */}
        <Grid container spacing={4} sx={{ mb: 10 }}>
          {stats.map((stat, index) => (
            <Grid item xs={6} md={3} key={index}>
              <Card elevation={2}>
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="h3" color="primary" gutterBottom sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }}>
                    {stat.value}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {stat.label}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Story */}
        <Box sx={{ mb: 10 }}>
          <Typography variant="h4" gutterBottom>
            Why this exists
          </Typography>
          <Typography variant="body1" paragraph sx={{ mt: 2, lineHeight: 1.8 }}>
            Finding a reliable training partner is harder than it should be. I wanted something simple: match
            with people who actually show up — whether that&apos;s the gym, the pitch, or the trail.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            GetTrainMate is my answer to training alone or chasing partners who flake. It&apos;s built for
            athletes and everyday trainers who care about consistency, not hype.
          </Typography>
        </Box>

        {/* Values */}
        <Box sx={{ mb: 10 }}>
          <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
            What I care about
          </Typography>
          <Grid container spacing={4}>
            {values.map((value, index) => (
              <Grid item xs={12} md={6} key={index}>
                <Card elevation={1} sx={{ height: '100%' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom color="primary">
                      {value.title}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {value.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Founder — solo builder; page h1 above is “About GetTrainMate” */}
        <Box
          component="section"
          aria-labelledby="about-founder-heading"
          sx={{ mb: 6, display: 'flex', justifyContent: 'center' }}
        >
          <Card elevation={2} sx={{ width: '100%', maxWidth: 720 }}>
            <CardContent sx={{ p: { xs: 3, sm: 4, md: 5 }, textAlign: 'center' }}>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 2, display: 'block', mb: 1 }}>
                About GetTrainMate
              </Typography>
              <Typography
                id="about-founder-heading"
                variant="h4"
                component="h2"
                gutterBottom
                sx={{ fontSize: { xs: '1.35rem', sm: '1.5rem' } }}
              >
                Built by an athlete who actually trains
              </Typography>
              <Box sx={{ textAlign: 'left', maxWidth: 560, mx: 'auto' }}>
                <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
                  GetTrainMate was built by me — Max Kantor.
                </Typography>
                <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
                  I created this because I was tired of training alone or dealing with unreliable training partners.
                </Typography>
                <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
                  I regularly train, play soccer, hit the gym, and stay active with things like pickleball and
                  fishing. I wanted a simple way to find people who actually show up and train consistently.
                </Typography>
                <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
                  This app is built for people who take their training seriously — whether that&apos;s gym workouts,
                  running, or competitive sports.
                </Typography>
                <Typography variant="body1" sx={{ lineHeight: 1.8, mb: 3 }}>
                  No fluff. Just real people who want to train.
                </Typography>

                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
                  What I do:
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 3 }}>
                  {founderActivities.map((item) => (
                    <Typography key={item} component="li" variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      {item}
                    </Typography>
                  ))}
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75, fontStyle: 'italic' }}>
                  If you&apos;re using GetTrainMate, you&apos;re exactly the kind of person I built this for.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Container>
    </PageShell>
  );
};
