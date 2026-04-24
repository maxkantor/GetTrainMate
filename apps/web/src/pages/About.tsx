import React, { useMemo } from 'react';
import { Container, Typography, Box, Grid, Card, CardContent } from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { PageShell } from '@/components/layout/PageShell';
import { getAboutPage } from '@/i18n/content/aboutLocales';

export const AboutPage: React.FC = () => {
  const { locale } = useI18n();
  const about = useMemo(() => getAboutPage(locale), [locale]);
  const { stats, values } = about;

  return (
    <PageShell variant="content" showBackLink>
      <Container maxWidth="lg" disableGutters sx={{ maxWidth: '100%' }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h2" component="h1" gutterBottom sx={{ fontSize: '1.75rem' }}>
            {about.hero_title}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '640px', mx: 'auto', mt: 2 }}>
            {about.hero_sub}
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
            {about.story_title}
          </Typography>
          <Typography variant="body1" paragraph sx={{ mt: 2, lineHeight: 1.8 }}>
            {about.story_p1}
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            {about.story_p2}
          </Typography>
        </Box>

        {/* Values */}
        <Box sx={{ mb: 10 }}>
          <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
            {about.values_section_title}
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
                {about.founder_kicker}
              </Typography>
              <Typography
                id="about-founder-heading"
                variant="h4"
                component="h2"
                gutterBottom
                sx={{ fontSize: { xs: '1.35rem', sm: '1.5rem' } }}
              >
                {about.founder_h2}
              </Typography>
              <Box sx={{ textAlign: 'left', maxWidth: 560, mx: 'auto' }}>
                <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
                  {about.founder_p1}
                </Typography>
                <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
                  {about.founder_p2}
                </Typography>
                <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
                  {about.founder_p3}
                </Typography>
                <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
                  {about.founder_p4}
                </Typography>
                <Typography variant="body1" sx={{ lineHeight: 1.8, mb: 3 }}>
                  {about.founder_p5}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
                  {about.founder_list_title}
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 3 }}>
                  {about.founder_activities.map((item) => (
                    <Typography key={item} component="li" variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      {item}
                    </Typography>
                  ))}
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75, fontStyle: 'italic' }}>
                  {about.founder_closing}
                </Typography>
                {about.founder_disclaimer ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                    {about.founder_disclaimer}
                  </Typography>
                ) : null}
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Container>
    </PageShell>
  );
};
