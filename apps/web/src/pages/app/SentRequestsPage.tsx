import React, { useCallback, useEffect, useState } from 'react';
import { Box, Typography, Alert, Chip, CircularProgress } from '@mui/material';
import { Link } from 'react-router-dom';
import { authService } from '@/services/authService';
import { matchService, type SentRequestItem } from '@/services/matchService';
import { getMultiplePhotoUrls, NO_PHOTO_PLACEHOLDER } from '@/utils/profilePhotos';
import { isGraphQLEnabled } from '@/services/graphqlService';
import styles from './ConnectionsList.module.css';

export const SentRequestsPage: React.FC = () => {
  const [items, setItems] = useState<SentRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isGraphQLEnabled) {
        setError('Open the REST-backed app to load sent requests, or disable AppSync for this environment.');
        setItems([]);
        return;
      }
      const token = await authService.getJWT(true);
      if (!token) {
        setError('Sign in to view sent requests.');
        return;
      }
      const list = await matchService.getSentRequests(token);
      setItems(list);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number; data?: { message?: string; code?: string } } })?.response
        ?.status;
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (status === 403) {
        setError(msg || 'Sent requests are not enabled for your account.');
      } else {
        setError(msg || (e instanceof Error ? e.message : 'Could not load sent requests'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Box className={styles.root} display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div className={styles.root}>
      <Typography variant="h5" component="h1" gutterBottom>
        Sent requests
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        People you invited or liked. Pending means they have not matched back yet.
      </Typography>
      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {items.length === 0 && !error ? (
        <Typography color="text.secondary">No outgoing requests yet.</Typography>
      ) : (
        <ul className={styles.list}>
          {items.map((row) => {
            const photo =
              getMultiplePhotoUrls(row.photoUrls, row.userId, 1, row.name)[0] || NO_PHOTO_PLACEHOLDER;
            const statusColor = row.status === 'Matched' ? 'success' : 'primary';
            return (
              <li key={row.matchId} className={styles.row}>
                <img src={photo} alt="" className={styles.avatar} />
                <div className={styles.meta}>
                  <Link to={`/app/profile/${encodeURIComponent(row.userId)}`} className={styles.nameLink}>
                    {row.name}
                  </Link>
                  {row.city ? (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {row.city}
                    </Typography>
                  ) : null}
                  <Chip size="small" label={row.status} color={statusColor} sx={{ mt: 0.5 }} variant="outlined" />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
