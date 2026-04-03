import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ViewListIcon from '@mui/icons-material/ViewList';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { useI18n } from '@/hooks/useI18n';
import { useMe } from '@/hooks/useMe';
import { authService } from '@/services/authService';
import { eventService, EventResponse } from '@/services/eventService';
import { profileService } from '@/services/profileService';
import { handleApiError, isNetworkError } from '@/utils/apiErrorHandler';
import { EVENT_INTEREST_OPTIONS } from '@/config/eventsInterest';
import styles from './Events.module.css';

type ViewMode = 'list' | 'calendar';

function interestLabel(id: string): string {
  return EVENT_INTEREST_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export const EventsPage: React.FC = () => {
  const { t } = useI18n();
  const { me, refreshMe, loading: meLoading } = useMe();
  const profileInitRef = useRef<string | null>(null);

  const [events, setEvents] = useState<EventResponse[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const [cityDraft, setCityDraft] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [savingWaitlist, setSavingWaitlist] = useState(false);
  const [waitlistError, setWaitlistError] = useState('');

  const waitlisted = Boolean(me?.profile?.eventsWaitlistEnabled);
  const savedCity = me?.profile?.eventsCityInterest || me?.profile?.city || '';
  const savedTypes = me?.profile?.eventsInterestTypes ?? [];

  const userKey = me?.user?.id ?? '';
  useEffect(() => {
    if (!userKey) {
      profileInitRef.current = null;
      return;
    }
    if (!me?.profile) return;
    if (profileInitRef.current === userKey) return;
    profileInitRef.current = userKey;
    setCityDraft(me.profile.eventsCityInterest || me.profile.city || '');
    setSelectedTypes(me.profile.eventsInterestTypes?.length ? [...me.profile.eventsInterestTypes] : []);
  }, [userKey, me?.profile]);

  const loadEvents = useCallback(async () => {
    try {
      setLoadingEvents(true);
      setError('');
      const token = await authService.getJWT();
      if (!token) {
        setError('Not authenticated');
        return;
      }
      const data = await eventService.getEvents(token, 50);
      setEvents(data);
    } catch (err: unknown) {
      const apiError = handleApiError(err);
      if (isNetworkError(err) || apiError.isCorsError) {
        setError('Unable to connect to the API.');
      } else {
        setError(apiError.message || 'Failed to load events');
      }
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const toggleType = (id: string) => {
    setSelectedTypes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleJoinWaitlist = async () => {
    setWaitlistError('');
    try {
      setSavingWaitlist(true);
      const token = await authService.getJWT(true);
      if (!token) {
        setWaitlistError('Sign in to join the waitlist.');
        return;
      }
      const city = cityDraft.trim() || savedCity.trim();
      if (!city) {
        setWaitlistError('Add your city (or set it on your profile) so we can notify you locally.');
        return;
      }
      await profileService.updateMyProfile(token, {
        eventsWaitlistEnabled: true,
        eventsCityInterest: city,
        eventsInterestTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
      });
      await refreshMe();
    } catch (err: unknown) {
      const apiError = handleApiError(err);
      setWaitlistError(apiError.message || 'Could not save. Try again.');
    } finally {
      setSavingWaitlist(false);
    }
  };

  const handleSuggestCityFocus = () => {
    if (!cityDraft.trim() && savedCity) setCityDraft(savedCity);
  };

  const handleRSVP = async (eventId: string) => {
    try {
      setJoiningId(eventId);
      const token = await authService.getJWT();
      if (!token) return;
      await eventService.joinEvent(token, eventId);
      await loadEvents();
    } catch (err) {
      const apiError = handleApiError(err);
      setError(apiError.message || 'Failed to RSVP');
    } finally {
      setJoiningId(null);
    }
  };

  const confirmationLine = useMemo(() => {
    const city = me?.profile?.eventsCityInterest || me?.profile?.city;
    if (!waitlisted) return '';
    if (city) {
      return `You're on the Events waitlist for ${city}`;
    }
    return "We'll notify you when local meetups launch";
  }, [waitlisted, me?.profile?.eventsCityInterest, me?.profile?.city]);

  const WaitlistForm = ({ compact }: { compact?: boolean }) => (
    <Stack spacing={compact ? 2 : 2.5} sx={{ width: '100%', maxWidth: compact ? 520 : 480 }}>
      {!compact ? (
        <Box sx={{ width: '100%', maxWidth: 420, alignSelf: 'center' }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ textAlign: 'left', mb: 1 }}>
            City for launch alerts
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="e.g. Atlanta"
            value={cityDraft}
            onChange={(e) => setCityDraft(e.target.value)}
            onFocus={handleSuggestCityFocus}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                bgcolor: 'rgba(0,0,0,0.2)',
              },
            }}
          />
        </Box>
      ) : (
        <TextField
          fullWidth
          size="small"
          label="City for launch alerts"
          placeholder="e.g. Atlanta"
          value={cityDraft}
          onChange={(e) => setCityDraft(e.target.value)}
          onFocus={handleSuggestCityFocus}
          sx={{
            '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'rgba(0,0,0,0.2)' },
          }}
        />
      )}
      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mb: 1, textAlign: compact ? 'left' : 'center' }}>
          What would you join? (optional)
        </Typography>
        <Stack direction="row" gap={1} flexWrap="wrap" justifyContent={compact ? 'flex-start' : 'center'} useFlexGap>
          {EVENT_INTEREST_OPTIONS.map((opt) => (
            <Chip
              key={opt.id}
              label={opt.label}
              onClick={() => toggleType(opt.id)}
              color={selectedTypes.includes(opt.id) ? 'primary' : 'default'}
              variant={selectedTypes.includes(opt.id) ? 'filled' : 'outlined'}
              size={compact ? 'small' : 'medium'}
              sx={{ borderColor: 'rgba(167, 139, 250, 0.35)' }}
            />
          ))}
        </Stack>
      </Box>
      {waitlistError ? (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {waitlistError}
        </Alert>
      ) : null}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Button
          variant="contained"
          size={compact ? 'medium' : 'large'}
          fullWidth
          disabled={savingWaitlist}
          onClick={() => void handleJoinWaitlist()}
          sx={{ py: compact ? 1 : 1.5, fontWeight: 700 }}
        >
          {savingWaitlist ? 'Saving…' : waitlisted ? 'Update my waitlist' : 'Notify me when Events launch'}
        </Button>
        {!compact ? (
          <Button variant="outlined" size="large" fullWidth onClick={handleSuggestCityFocus} sx={{ py: 1.5 }}>
            Suggest my city
          </Button>
        ) : null}
      </Stack>
      {!compact ? (
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
          No credits are used until event bookings go live.
        </Typography>
      ) : (
        <Typography variant="caption" color="text.secondary">
          No credits until bookings go live.
        </Typography>
      )}
    </Stack>
  );

  if (meLoading && !me) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <CircularProgress sx={{ color: 'primary.light' }} />
        </div>
      </div>
    );
  }

  if (loadingEvents && events.length === 0 && !error) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <CircularProgress sx={{ color: 'primary.light' }} />
        </div>
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <Container maxWidth="sm" className={styles.container}>
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={() => void loadEvents()}>
          Retry
        </Button>
      </Container>
    );
  }

  const showPublishedEvents = events.length > 0;

  return (
    <div className={styles.container}>
      {showPublishedEvents ? (
        <>
          <div className={styles.header}>
            <h1 className={styles.title}>{t('nav.events')}</h1>
            <div className={styles.viewToggle}>
              <button
                type="button"
                className={`${styles.toggleBtn} ${viewMode === 'list' ? styles.toggleActive : ''}`}
                onClick={() => setViewMode('list')}
                aria-pressed={viewMode === 'list'}
              >
                <ViewListIcon sx={{ fontSize: 20 }} />
                List
              </button>
              <button
                type="button"
                className={`${styles.toggleBtn} ${viewMode === 'calendar' ? styles.toggleActive : ''}`}
                onClick={() => setViewMode('calendar')}
                aria-pressed={viewMode === 'calendar'}
              >
                <CalendarMonthIcon sx={{ fontSize: 20 }} />
                Calendar
              </button>
            </div>
          </div>

          {waitlisted ? (
            <Alert severity="success" icon={<EventAvailableIcon />} sx={{ mb: 3, borderRadius: 2 }}>
              <strong>{confirmationLine}</strong>
              {savedTypes.length > 0 ? (
                <Typography variant="body2" sx={{ mt: 1, opacity: 0.95 }}>
                  Interests: {savedTypes.map(interestLabel).join(' · ')}
                </Typography>
              ) : null}
            </Alert>
          ) : (
            <Paper elevation={0} className={styles.compactWaitlist} sx={{ mb: 3 }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Get notified for your city
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Published events are below — tell us where to launch meetups next.
              </Typography>
              <WaitlistForm compact />
            </Paper>
          )}

          {viewMode === 'calendar' && (
            <div className={styles.calendarPlaceholder}>
              <CalendarMonthIcon sx={{ fontSize: 48, color: 'rgba(167, 139, 250, 0.5)' }} />
              <p>Calendar view coming soon</p>
            </div>
          )}

          <div className={styles.eventList}>
            {events.map((evt) => (
              <article key={evt.eventId} className={styles.eventCard}>
                <div className={styles.eventHeader}>
                  <h3 className={styles.eventTitle}>{evt.title}</h3>
                  <span className={styles.eventSport}>{evt.sport}</span>
                </div>
                <p className={styles.eventDesc}>{evt.description || 'No description'}</p>
                <div className={styles.eventMeta}>
                  <span>📍 {evt.city}</span>
                  <span>📅 {new Date(evt.eventDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                  <span>
                    👥 {evt.participantCount} / {evt.maxParticipants}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.rsvpBtn}
                  onClick={() => handleRSVP(evt.eventId)}
                  disabled={evt.isJoined || joiningId === evt.eventId}
                >
                  {evt.isJoined ? 'Joined' : joiningId === evt.eventId ? 'Joining…' : 'RSVP'}
                </button>
              </article>
            ))}
          </div>
        </>
      ) : null}

      {!showPublishedEvents ? (
        <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
          <Paper elevation={0} className={styles.launchPaper}>
            <Box className={styles.launchGlow} aria-hidden />
            <Stack spacing={3} alignItems="center" textAlign="center">
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.35), rgba(139, 92, 246, 0.25))',
                  border: '1px solid rgba(167, 139, 250, 0.35)',
                }}
              >
                <NotificationsActiveIcon sx={{ fontSize: 40, color: 'primary.light' }} />
              </Box>
              <Typography variant="overline" sx={{ letterSpacing: '0.2em', color: 'text.secondary', fontWeight: 700 }}>
                Coming online
              </Typography>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                Train together IRL
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 520 }}>
                Local workout meetups, partner sessions, and community events are coming soon.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 540, lineHeight: 1.65 }}>
                We&apos;re preparing city-based fitness meetups and RSVP flows. Join the waitlist to get notified when
                Events launch in your area.
              </Typography>

              {waitlisted ? (
                <Alert severity="success" sx={{ width: '100%', maxWidth: 480, borderRadius: 2, textAlign: 'left' }}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    {confirmationLine}
                  </Typography>
                  {savedTypes.length > 0 ? (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Preferences: {savedTypes.map(interestLabel).join(' · ')}
                    </Typography>
                  ) : null}
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
                    Update your city and interests below anytime.
                  </Typography>
                </Alert>
              ) : null}

              <WaitlistForm />
            </Stack>
          </Paper>
        </Container>
      ) : null}
    </div>
  );
};
