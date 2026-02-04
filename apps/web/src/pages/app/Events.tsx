import React from 'react';
import { Button, Container, Paper, Typography } from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import { useI18n } from '@/hooks/useI18n';

/**
 * Events: Coming Soon until real value exists. Minimal UI, no large whitespace.
 */
export const EventsPage: React.FC = () => {
  const { t } = useI18n();

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <EventIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          Coming Soon
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Events will let you create and join training meetups. We're building it.
        </Typography>
        <Button variant="outlined" disabled>
          Create event
        </Button>
      </Paper>
    </Container>
  );
};
