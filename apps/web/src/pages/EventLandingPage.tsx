import React, { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
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
      <Typography variant="h3" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Find people to train, play, watch, meet, vibe, or date around {data?.label ?? 'this event'}.
      </Typography>
      <Stack spacing={1.2} sx={{ mb: 3 }}>
        {(data?.activities ?? ['train', 'play', 'watch', 'meet', 'vibe', 'date']).map((activity) => (
          <Box key={activity} sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
            <Typography variant="body2">{SECTION_LABELS[activity] ?? activity}</Typography>
          </Box>
        ))}
      </Stack>
      <Button variant="contained" size="large" onClick={() => navigate('/signup')}>
        Start Connecting
      </Button>
      <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 3 }}>
        GetTrainMate is an independent platform and is not affiliated with or endorsed by any league, club, federation, or event organizer.
      </Typography>
    </Container>
  );
};
