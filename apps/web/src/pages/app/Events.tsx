import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ViewListIcon from '@mui/icons-material/ViewList';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useI18n } from '@/hooks/useI18n';
import { useMe } from '@/hooks/useMe';
import { authService } from '@/services/authService';
import { eventService, EventResponse } from '@/services/eventService';
import { profileService } from '@/services/profileService';
import { handleApiError, isNetworkError } from '@/utils/apiErrorHandler';
import { EVENT_INTEREST_OPTIONS } from '@/config/eventsInterest';
import styles from './Events.module.css';

type ViewMode = 'list' | 'calendar';

/** Waitlist is one profile record per user (PUT /api/profile/me); client always upserts the same document. */
function interestLabel(id: string): string {
  return EVENT_INTEREST_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export const EventsPage: React.FC = () => {
  const { t } = useI18n();
  const { me, refreshMe, loading: meLoading } = useMe();
  const profileInitRef = useRef<string | null>(null);
  const waitlistSubmitLockRef = useRef(false);

  const [events, setEvents] = useState<EventResponse[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const [cityDraft, setCityDraft] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [savingWaitlist, setSavingWaitlist] = useState(false);
  const [waitlistError, setWaitlistError] = useState('');
  const [editPreferences, setEditPreferences] = useState(false);
  /** Snapshot when opening edit — Cancel restores this without persisting partial edits */
  const [editBaseline, setEditBaseline] = useState<{ city: string; types: string[] } | null>(null);

  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestDraft, setSuggestDraft] = useState('');
  const [suggestSaving, setSuggestSaving] = useState(false);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const waitlisted = Boolean(me?.profile?.eventsWaitlistEnabled);
  const savedCity = me?.profile?.eventsCityInterest || me?.profile?.city || '';
  const savedTypes = me?.profile?.eventsInterestTypes ?? [];
  const displayCity = useMemo(
    () => (me?.profile?.eventsCityInterest || me?.profile?.city || '').trim(),
    [me?.profile?.eventsCityInterest, me?.profile?.city]
  );

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
    setEditPreferences(false);
    setEditBaseline(null);
  }, [userKey, me?.profile]);

  const loadEvents = useCallback(async () => {
    try {
      setLoadingEvents(true);
      setError('');
      const token = await authService.getJWT();
      if (!token) {
        setEvents([]);
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

  const beginEditPreferences = () => {
    const city = (me?.profile?.eventsCityInterest || me?.profile?.city || '').trim();
    const types = [...(me?.profile?.eventsInterestTypes ?? [])];
    setEditBaseline({ city, types });
    setCityDraft(city || me?.profile?.city || '');
    setSelectedTypes(types.length ? types : []);
    setWaitlistError('');
    setEditPreferences(true);
  };

  const cancelEditPreferences = () => {
    if (editBaseline) {
      setCityDraft(editBaseline.city);
      setSelectedTypes([...editBaseline.types]);
    } else {
      setCityDraft(savedCity || me?.profile?.city || '');
      setSelectedTypes(savedTypes.length ? [...savedTypes] : []);
    }
    setEditBaseline(null);
    setEditPreferences(false);
    setWaitlistError('');
  };

  const handleJoinWaitlist = async () => {
    if (waitlistSubmitLockRef.current || savingWaitlist) return;
    waitlistSubmitLockRef.current = true;
    setSavingWaitlist(true);
    setWaitlistError('');
    try {
      const token = await authService.getJWT(true);
      if (!token) {
        setWaitlistError('Sign in to join the waitlist.');
        return;
      }
      const city = cityDraft.trim() || savedCity.trim();
      if (!city) {
        setWaitlistError('Add your city so we can notify you when Events launch locally.');
        return;
      }

      const wasFirstJoin = !waitlisted;
      await profileService.updateMyProfile(token, {
        eventsWaitlistEnabled: true,
        eventsCityInterest: city,
        eventsInterestTypes: selectedTypes,
      });
      await refreshMe();
      setEditPreferences(false);
      setEditBaseline(null);
      setToastMessage(
        wasFirstJoin
          ? `We'll notify you when events launch in ${city}.`
          : 'Your Events preferences were saved.'
      );
      setToastOpen(true);
    } catch (err: unknown) {
      const apiError = handleApiError(err);
      setWaitlistError(apiError.message || 'Could not save. Try again.');
    } finally {
      setSavingWaitlist(false);
      waitlistSubmitLockRef.current = false;
    }
  };

  const handleSuggestCitySubmit = async () => {
    const city = suggestDraft.trim();
    if (!city) return;
    if (suggestSaving) return;
    try {
      setSuggestSaving(true);
      const token = await authService.getJWT(true);
      if (!token) {
        setToastMessage('Sign in to suggest a city.');
        setToastOpen(true);
        setSuggestOpen(false);
        return;
      }
      await profileService.updateMyProfile(token, { eventsCitySuggestion: city });
      await refreshMe();
      setSuggestOpen(false);
      setSuggestDraft('');
      setToastMessage(`Thanks — we recorded interest in ${city}.`);
      setToastOpen(true);
    } catch (err: unknown) {
      const apiError = handleApiError(err);
      setToastMessage(apiError.message || 'Could not save your suggestion.');
      setToastOpen(true);
    } finally {
      setSuggestSaving(false);
    }
  };

  const openSuggestModal = () => {
    setSuggestDraft(cityDraft.trim() || savedCity || '');
    setSuggestOpen(true);
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
    if (!waitlisted) return '';
    if (displayCity) {
      return `We'll notify you when events launch in ${displayCity}`;
    }
    return "We'll notify you when local meetups launch";
  }, [waitlisted, displayCity]);

  const formStackSx = { width: '100%' };

  const WaitlistSuccessPanel = ({ compact }: { compact?: boolean }) => (
    <Stack spacing={compact ? 1.5 : 2} sx={formStackSx}>
      <Alert severity="success" icon={<EventAvailableIcon />} sx={{ borderRadius: 2, textAlign: 'left' }}>
        <Typography variant="subtitle2" fontWeight={700}>
          You&apos;re on the list
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {confirmationLine}
        </Typography>
        {displayCity ? (
          <Typography variant="body2" sx={{ mt: 1, opacity: 0.95 }}>
            <strong>City:</strong> {displayCity}
          </Typography>
        ) : null}
        {savedTypes.length > 0 ? (
          <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.95 }}>
            <strong>Interests:</strong> {savedTypes.map(interestLabel).join(' · ')}
          </Typography>
        ) : (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            Add interests anytime with Edit preferences.
          </Typography>
        )}
      </Alert>
      <Button
        variant="outlined"
        size={compact ? 'small' : 'medium'}
        startIcon={<EditOutlinedIcon />}
        onClick={beginEditPreferences}
        sx={{ alignSelf: compact ? 'flex-start' : 'center' }}
      >
        Edit preferences
      </Button>
      <Button variant="text" size="small" onClick={openSuggestModal} sx={{ alignSelf: compact ? 'flex-start' : 'center' }}>
        Suggest another city for coverage
      </Button>
    </Stack>
  );

  const notifyDisabled = savingWaitlist || (waitlisted && !editPreferences);

  const WaitlistForm = ({ compact }: { compact?: boolean }) => (
    <Stack spacing={compact ? 2 : 2.5} sx={formStackSx}>
      {!compact ? (
        <Box sx={{ width: '100%' }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ textAlign: 'left', mb: 1 }}>
            City for launch alerts
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="e.g. Atlanta"
            value={cityDraft}
            onChange={(e) => setCityDraft(e.target.value)}
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
          {EVENT_INTEREST_OPTIONS.map((opt) => {
            const active = selectedTypes.includes(opt.id);
            return (
              <Chip
                key={opt.id}
                label={opt.label}
                onClick={() => toggleType(opt.id)}
                color={active ? 'primary' : 'default'}
                variant={active ? 'filled' : 'outlined'}
                size={compact ? 'small' : 'medium'}
                className={styles.interestChip}
                sx={{
                  borderColor: active ? 'rgba(167, 139, 250, 0.55)' : 'rgba(167, 139, 250, 0.4)',
                  bgcolor: active ? undefined : 'transparent',
                  ...(active
                    ? {
                        boxShadow: '0 0 18px rgba(139, 92, 246, 0.45), 0 0 4px rgba(167, 139, 250, 0.4)',
                        background: 'linear-gradient(145deg, rgba(99, 102, 241, 0.45), rgba(139, 92, 246, 0.35))',
                      }
                    : {
                        backgroundColor: 'transparent',
                      }),
                }}
              />
            );
          })}
        </Stack>
      </Box>
      {waitlistError ? (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {waitlistError}
        </Alert>
      ) : null}
      {editPreferences ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ width: '100%' }}>
          <Button
            variant="contained"
            size={compact ? 'medium' : 'large'}
            fullWidth
            disabled={notifyDisabled}
            onClick={() => void handleJoinWaitlist()}
            sx={{ py: compact ? 1 : 1.5, fontWeight: 700, flex: { sm: 1 } }}
          >
            {savingWaitlist ? 'Saving…' : 'Save changes'}
          </Button>
          <Button
            variant="outlined"
            size={compact ? 'medium' : 'large'}
            fullWidth
            disabled={savingWaitlist}
            onClick={cancelEditPreferences}
            sx={{ py: compact ? 1 : 1.5, flex: { sm: 1 } }}
          >
            Cancel
          </Button>
        </Stack>
      ) : (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ width: '100%' }}>
          <Button
            variant="contained"
            size={compact ? 'medium' : 'large'}
            fullWidth
            disabled={notifyDisabled}
            onClick={() => void handleJoinWaitlist()}
            sx={{ py: compact ? 1 : 1.5, fontWeight: 700, flex: { sm: 1 } }}
          >
            {savingWaitlist ? 'Saving…' : 'Notify me when Events launch'}
          </Button>
          <Button variant="outlined" size={compact ? 'medium' : 'large'} fullWidth onClick={openSuggestModal} sx={{ py: compact ? 1 : 1.5, flex: { sm: 1 } }}>
            Suggest a city
          </Button>
        </Stack>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: compact ? 'left' : 'center' }}>
        Limited early access per city — spots are filled in order of signup.
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: compact ? 'left' : 'center', display: 'block' }}>
        No credits are used until event bookings go live.
      </Typography>
    </Stack>
  );

  const renderWaitlistBlock = (compact?: boolean) => {
    if (waitlisted && !editPreferences) {
      return <WaitlistSuccessPanel compact={compact} />;
    }
    return <WaitlistForm compact={compact} />;
  };

  const pageFrame = (children: React.ReactNode) => <div className={styles.pageFrame}>{children}</div>;

  if (meLoading && !me) {
    return (
      <div className={styles.container}>
        {pageFrame(
          <div className={styles.loading}>
            <CircularProgress sx={{ color: 'primary.light' }} />
          </div>
        )}
      </div>
    );
  }

  if (loadingEvents && events.length === 0 && !error) {
    return (
      <div className={styles.container}>
        {pageFrame(
          <div className={styles.loading}>
            <CircularProgress sx={{ color: 'primary.light' }} />
          </div>
        )}
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div className={styles.container}>
        {pageFrame(
          <Container maxWidth={false} disableGutters sx={{ py: 2 }}>
            <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
            <Button variant="contained" onClick={() => void loadEvents()}>
              Retry
            </Button>
          </Container>
        )}
      </div>
    );
  }

  const showPublishedEvents = events.length > 0;

  return (
    <div className={styles.container}>
      <Dialog open={suggestOpen} onClose={() => !suggestSaving && setSuggestOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Suggest a city</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Tell us where you&apos;d like TrainMate Events — we use this to plan rollouts.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="City or metro area"
            placeholder="e.g. Portland, OR"
            value={suggestDraft}
            onChange={(e) => setSuggestDraft(e.target.value)}
            disabled={suggestSaving}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSuggestOpen(false)} disabled={suggestSaving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void handleSuggestCitySubmit()} disabled={suggestSaving || !suggestDraft.trim()}>
            {suggestSaving ? 'Saving…' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toastOpen}
        autoHideDuration={5000}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setToastOpen(false)} sx={{ width: '100%', maxWidth: 420 }}>
          {toastMessage}
        </Alert>
      </Snackbar>

      {pageFrame(
        <>
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

              <Paper elevation={0} className={styles.compactWaitlist} sx={{ mb: 3 }}>
                {waitlisted && !editPreferences ? (
                  <WaitlistSuccessPanel compact />
                ) : (
                  <>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                      {editPreferences ? 'Update your Events preferences' : 'Get notified for your city'}
                    </Typography>
                    {!editPreferences ? (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Published events are below — tell us where to launch meetups next.
                      </Typography>
                    ) : null}
                    <WaitlistForm compact />
                  </>
                )}
              </Paper>

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
            <Box sx={{ py: { xs: 2, sm: 4 } }}>
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

                  {renderWaitlistBlock()}
                </Stack>
              </Paper>
            </Box>
          ) : null}
        </>
      )}
    </div>
  );
};
