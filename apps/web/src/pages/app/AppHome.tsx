import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Card, CardActionArea, Container, Typography } from '@mui/material';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import { useI18n } from '@/hooks/useI18n';
import { useMe } from '@/hooks/useMe';

const cardSx = {
  borderRadius: 2,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
  },
};

export const AppHomePage: React.FC = () => {
  const { t } = useI18n();
  const { me } = useMe();
  const first = me?.profile?.name?.trim()?.split(/\s+/)[0];
  const greeting = first || 'there';

  const tiles = [
    {
      to: '/app/discover',
      title: t('nav.discover'),
      subtitle: 'Find training partners near you',
      icon: <ExploreOutlinedIcon sx={{ fontSize: 32, opacity: 0.9 }} />,
    },
    {
      to: '/app/matches',
      title: t('nav.match'),
      subtitle: 'Your connections and requests',
      icon: <FavoriteBorderOutlinedIcon sx={{ fontSize: 32, opacity: 0.9 }} />,
    },
    {
      to: '/app/chat',
      title: t('nav.chat'),
      subtitle: 'Messages with matches',
      icon: <ChatBubbleOutlineOutlinedIcon sx={{ fontSize: 32, opacity: 0.9 }} />,
    },
    {
      to: '/app/events',
      title: t('nav.events'),
      subtitle: 'Train together IRL',
      icon: <EventOutlinedIcon sx={{ fontSize: 32, opacity: 0.9 }} />,
    },
    {
      to: '/app/profile',
      title: t('nav.profile'),
      subtitle: 'Photos, bio, and preferences',
      icon: <PersonOutlineOutlinedIcon sx={{ fontSize: 32, opacity: 0.9 }} />,
    },
  ];

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, sm: 5 } }}>
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.12em' }}>
        {t('header.home')}
      </Typography>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mt: 0.5, mb: 1 }}>
        Welcome back, {greeting}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 520 }}>
        Choose where to go next. You can always return here from the Home link in the header.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 2,
        }}
      >
        {tiles.map((item) => (
          <Card key={item.to} variant="outlined" sx={cardSx}>
            <CardActionArea
              component={RouterLink}
              to={item.to}
              sx={{ p: 2.5, alignItems: 'stretch', minHeight: 120 }}
            >
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <Box sx={{ color: 'primary.main', pt: 0.25 }}>{item.icon}</Box>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.subtitle}
                  </Typography>
                </Box>
              </Box>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Container>
  );
};
