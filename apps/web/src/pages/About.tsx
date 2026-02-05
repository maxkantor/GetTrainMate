import React from 'react';
import { Container, Typography, Box, Grid, Card, CardContent } from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { SecondaryPageLayout } from '@/components/layout/SecondaryPageLayout';

export const AboutPage: React.FC = () => {
  const { t: _t } = useI18n();

  const stats = [
    { value: '10,000+', label: 'Active Athletes' },
    { value: '50,000+', label: 'Training Sessions' },
    { value: '100+', label: 'Cities Worldwide' },
    { value: '4.8/5', label: 'User Rating' },
  ];

  const team = [
    { name: 'Sarah Johnson', role: 'CEO & Co-Founder', bio: 'Former Olympic athlete with 10+ years in fitness tech' },
    { name: 'Mike Chen', role: 'CTO & Co-Founder', bio: 'AI/ML expert passionate about community building' },
    { name: 'Emma Davis', role: 'Head of Product', bio: 'UX designer and marathon runner' },
  ];

  const values = [
    { title: 'Community First', description: 'We believe in the power of training together and supporting each other' },
    { title: 'Inclusivity', description: 'Everyone deserves a training partner, regardless of skill level or background' },
    { title: 'Safety & Trust', description: 'Verified profiles and secure communication to keep our community safe' },
    { title: 'Innovation', description: 'Using cutting-edge AI to create the perfect matches' },
  ];

  return (
    <SecondaryPageLayout variant="content" showBackLink>
      <Container maxWidth="lg" disableGutters sx={{ maxWidth: '100%' }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h2" component="h1" gutterBottom sx={{ fontSize: '1.75rem' }}>
            About GetTrainMate
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '640px', mx: 'auto', mt: 2 }}>
            We're on a mission to make fitness more accessible, enjoyable, and effective by connecting people who train together.
          </Typography>
        </Box>

        {/* Stats */}
        <Grid container spacing={4} sx={{ mb: 10 }}>
          {stats.map((stat, index) => (
            <Grid item xs={6} md={3} key={index}>
              <Card elevation={2}>
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="h3" color="primary" gutterBottom>
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
            Our Story
          </Typography>
          <Typography variant="body1" paragraph sx={{ mt: 2, lineHeight: 1.8 }}>
            GetTrainMate was born out of a simple observation: people who work out with partners are more likely to stick to their fitness goals, push themselves harder, and actually enjoy the process. Yet finding the right training partner has always been challenging.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            In 2024, our founders—a former Olympic athlete and an AI engineer—came together with a vision: to use technology to solve this age-old problem. By combining machine learning with deep insights into human motivation and fitness psychology, we created an intelligent matching system that goes beyond simple location-based matching.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Today, GetTrainMate serves thousands of athletes across 100+ cities worldwide. From marathon runners finding pace partners to CrossFit enthusiasts discovering workout buddies, we're helping people achieve their fitness dreams together.
          </Typography>
        </Box>

        {/* Values */}
        <Box sx={{ mb: 10 }}>
          <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
            Our Values
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

        {/* Team */}
        <Box sx={{ mb: 6 }}>
          <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
            Meet the Team
          </Typography>
          <Grid container spacing={4}>
            {team.map((member, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card elevation={2}>
                  <CardContent sx={{ textAlign: 'center', p: 4 }}>
                    <Box
                      sx={{
                        width: 120,
                        height: 120,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '2.5rem',
                        fontWeight: 'bold',
                        mx: 'auto',
                        mb: 2,
                      }}
                    >
                      {member.name.charAt(0)}
                    </Box>
                    <Typography variant="h6" gutterBottom>
                      {member.name}
                    </Typography>
                    <Typography variant="body2" color="primary" gutterBottom>
                      {member.role}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                      {member.bio}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Container>
    </SecondaryPageLayout>
  );
};
