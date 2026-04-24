import React, { useEffect, useMemo } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Chip, Container, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import { trackEvent } from '@/utils/analytics';

const SECTION_LABELS: Record<string, string> = {
  train: 'Train: find training partners',
  play: 'Play: join pickup games',
  watch: 'Watch: watch games with fans',
  meet: 'Meet: meet sports fans nearby',
  vibe: 'Vibe: social hangouts',
  date: 'Date: connect with someone who shares your energy',
};

export const EventLandingPage: React.FC = () => {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['sports-event', eventId],
    queryFn: () => sportsEventLayerService.getEvent(eventId),
    enabled: !!eventId,
  });

  useEffect(() => {
    if (!data) return;
    trackEvent('event_page_view', {
      eventId: data.eventId,
      eventLabel: data.label,
      sport: data.sport,
      sourcePage: `/events/${data.eventId}`,
    });
  }, [data]);

  const title = useMemo(() => (data ? `${data.label} on GetTrainMate` : 'Event on GetTrainMate'), [data]);

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          p: { xs: 2, sm: 3 },
          mb: 3,
          background: `linear-gradient(130deg, ${(data?.themeColor || '#27318a')}22, rgba(10,12,24,0.92))`,
        }}
      >
      <Typography variant="h3" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
        {title}
      </Typography>
      {data?.bannerImageUrl ? (
        <Box
          sx={{
            mb: 2,
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <img src={data.bannerImageUrl} alt={data.label} style={{ display: 'block', width: '100%', maxHeight: 280, objectFit: 'cover' }} />
        </Box>
      ) : null}
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {(data?.description?.trim() || 'Find people to train, play, watch, meet, vibe, or date.')
          + ' GetTrainMate is an independent platform and is not affiliated with or endorsed by any league, club, federation, or event organizer.'}
      </Typography>
      {(data?.tags ?? []).length > 0 ? (
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
          {(data?.tags ?? []).slice(0, 8).map((tag) => <Chip key={tag} size="small" label={tag} />)}
        </Stack>
      ) : null}
      <Stack spacing={1.2} sx={{ mb: 3 }}>
        {(data?.activities ?? ['train', 'play', 'watch', 'meet', 'vibe', 'date']).map((activity) => (
          <Box key={activity} sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
            <Typography variant="body2">{SECTION_LABELS[activity] ?? activity}</Typography>
          </Box>
        ))}
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
        <Button variant="contained" size="large" onClick={() => navigate('/signup')}>
          {data?.ctaLabel?.trim() || 'Find People Near You'}
        </Button>
        <Button variant="outlined" size="large" component={RouterLink} to="/login">
          Log In
        </Button>
      </Stack>
      </Box>
    </Container>
  );
};
