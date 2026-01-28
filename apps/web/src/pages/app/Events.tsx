import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Typography,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  TextField,
  MenuItem,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { eventService, EventResponse, CreateEventRequest } from '@/services/eventService';
import { authService } from '@/services/authService';
import { handleApiError, isNetworkError } from '@/utils/apiErrorHandler';

const SPORTS = [
  'Running', 'Cycling', 'Swimming', 'Tennis', 'Basketball', 'Soccer',
  'Volleyball', 'Gym', 'Yoga', 'Hiking', 'Climbing', 'CrossFit',
  'Hyrox', 'Pickleball', 'Fishing', 'Boxing', 'MMA', 'Dancing',
  'Golf', 'Skiing', 'Surfing', 'Rowing', 'Paddleboarding', 'Rock Climbing',
  'Martial Arts', 'Pilates', 'Barre', 'HIIT', 'Powerlifting', 'Weightlifting',
  'Rugby', 'Baseball', 'Softball', 'Badminton', 'Squash', 'Racquetball',
  'Table Tennis', 'Archery', 'Kayaking', 'Canoeing', 'Triathlon', 'Ultramarathon',
];

const LEVELS = ['beginner', 'intermediate', 'advanced', 'pro'];

export const EventsPage: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthContext();

  const [events, setEvents] = useState<EventResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openCreateDialog, setOpenCreateDialog] = useState(false);

  const [formData, setFormData] = useState<CreateEventRequest>({
    title: '',
    description: '',
    sport: '',
    city: '',
    eventDate: '',
    skillLevel: 'beginner',
    maxParticipants: 10,
  });

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError('');
      const token = await authService.getJWT();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const data = await eventService.getEvents(token, 100);
      setEvents(data);
    } catch (err: any) {
      console.error('Error loading events:', err);
      const apiError = handleApiError(err);
      if (isNetworkError(err) || apiError.isCorsError) {
        setError('Unable to connect to the API. Please check your connection and try again.');
      } else {
        setError(apiError.message || 'Failed to load events');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!formData.title || !formData.sport || !formData.city || !formData.eventDate) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      const token = await authService.getJWT();
      if (!token) return;

      const newEvent = await eventService.createEvent(token, {
        ...formData,
        eventDate: new Date(formData.eventDate).toISOString(),
      });

      setEvents([...events, newEvent]);
      setOpenCreateDialog(false);
      setFormData({
        title: '',
        description: '',
        sport: '',
        city: '',
        eventDate: '',
        skillLevel: 'beginner',
        maxParticipants: 10,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create event');
    }
  };

  const handleJoinEvent = async (eventId: string) => {
    try {
      const token = await authService.getJWT();
      if (!token) return;

      const updated = await eventService.joinEvent(token, eventId);
      setEvents(events.map(e => e.eventId === eventId ? updated : e));
    } catch (err: any) {
      console.error('Error joining event:', err);
      setError(err.message || 'Failed to join event');
    }
  };

  const handleLeaveEvent = async (eventId: string) => {
    try {
      const token = await authService.getJWT();
      if (!token) return;

      await eventService.leaveEvent(token, eventId);
      setEvents(events.map(e => 
        e.eventId === eventId ? { ...e, isJoined: false } : e
      ));
    } catch (err: any) {
      console.error('Error leaving event:', err);
      setError(err.message || 'Failed to leave event');
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          {t('nav.events')}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setOpenCreateDialog(true)}
        >
          Create Event
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {events.length === 0 ? (
        <Alert severity="info">No events available. Create one to get started!</Alert>
      ) : (
        <Grid container spacing={2}>
          {events.map((event) => (
            <Grid item xs={12} sm={6} md={4} key={event.eventId}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flex: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    {event.title}
                  </Typography>

                  <Box sx={{ mb: 2 }}>
                    <Chip label={event.sport} size="small" sx={{ mr: 1 }} />
                    <Chip
                      label={event.skillLevel}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Box>

                  <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                    {event.description}
                  </Typography>

                  <Typography variant="caption" display="block" sx={{ mb: 1 }}>
                    📍 {event.city}
                  </Typography>

                  <Typography variant="caption" display="block" sx={{ mb: 1 }}>
                    📅 {new Date(event.eventDate).toLocaleDateString()}
                  </Typography>

                  <Typography variant="caption" display="block" sx={{ mb: 2 }}>
                    👥 {event.participantCount}/{event.maxParticipants} joined
                  </Typography>

                  <Typography variant="caption" display="block">
                    Organized by: {event.organizerName}
                  </Typography>
                </CardContent>

                {event.isJoined ? (
                  <Button
                    fullWidth
                    variant="outlined"
                    color="error"
                    startIcon={<PersonRemoveIcon />}
                    onClick={() => handleLeaveEvent(event.eventId)}
                  >
                    Leave
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    startIcon={<PersonAddIcon />}
                    onClick={() => handleJoinEvent(event.eventId)}
                    disabled={event.participantCount >= event.maxParticipants}
                  >
                    {event.participantCount >= event.maxParticipants ? 'Full' : 'Join'}
                  </Button>
                )}
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Event Dialog */}
      <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} maxWidth="sm" fullWidth>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Create New Event
          </Typography>

          <TextField
            fullWidth
            label="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />

          <TextField
            fullWidth
            select
            label="Sport"
            value={formData.sport}
            onChange={(e) => setFormData({ ...formData, sport: e.target.value })}
            margin="normal"
            required
          >
            {SPORTS.map((sport) => (
              <MenuItem key={sport} value={sport}>
                {sport}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            label="City"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            margin="normal"
            required
          />

          <TextField
            fullWidth
            type="datetime-local"
            label="Event Date & Time"
            value={formData.eventDate}
            onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
            margin="normal"
            InputLabelProps={{ shrink: true }}
            required
          />

          <TextField
            fullWidth
            select
            label="Skill Level"
            value={formData.skillLevel}
            onChange={(e) => setFormData({ ...formData, skillLevel: e.target.value })}
            margin="normal"
          >
            {LEVELS.map((level) => (
              <MenuItem key={level} value={level}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            type="number"
            label="Max Participants"
            value={formData.maxParticipants}
            onChange={(e) => setFormData({ ...formData, maxParticipants: parseInt(e.target.value) })}
            margin="normal"
            InputProps={{ inputProps: { min: 2 } }}
          />

          <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={handleCreateEvent}
            >
              Create
            </Button>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => setOpenCreateDialog(false)}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      </Dialog>
    </Container>
  );
};
