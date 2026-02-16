import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  CircularProgress,
  Button as MuiButton,
} from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ViewListIcon from '@mui/icons-material/ViewList';
import { useI18n } from '@/hooks/useI18n';
import { authService } from '@/services/authService';
import { eventService, EventResponse } from '@/services/eventService';
import { handleApiError, isNetworkError } from '@/utils/apiErrorHandler';
import styles from './Events.module.css';

type ViewMode = 'list' | 'calendar';

export const EventsPage: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [events, setEvents] = useState<EventResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [joiningId, setJoiningId] = useState<string | null>(null);

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
      const data = await eventService.getEvents(token, 50);
      setEvents(data);
    } catch (err: unknown) {
      console.error('Error loading events:', err);
      const apiError = handleApiError(err);
      if (isNetworkError(err) || apiError.isCorsError) {
        setError('Unable to connect to the API.');
      } else {
        setError(apiError.message || 'Failed to load events');
      }
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <CircularProgress />
        </div>
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div className={styles.container}>
        <Alert severity="info" sx={{ mb: 2 }}>{error}</Alert>
        <MuiButton onClick={loadEvents}>Retry</MuiButton>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <div className={styles.emptyIconWrap}>
            <EventIcon className={styles.emptyIcon} />
          </div>
          <h2 className={styles.emptyTitle}>No events yet</h2>
          <p className={styles.emptyDesc}>
            Events will let you create and join training meetups. We&apos;re building it.
          </p>
          <MuiButton variant="outlined" disabled>
            Create event
          </MuiButton>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Events</h1>
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

      {viewMode === 'calendar' && (
        <div className={styles.calendarPlaceholder}>
          <CalendarMonthIcon sx={{ fontSize: 48, color: 'var(--color-neutral-400)' }} />
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
              <span>👥 {evt.participantCount} / {evt.maxParticipants}</span>
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
    </div>
  );
};
