import React, { useCallback, useEffect, useState } from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { Link } from 'react-router-dom';
import { authService } from '@/services/authService';
import { matchService, type SkippedProfileItem } from '@/services/matchService';
import { getMultiplePhotoUrls, NO_PHOTO_PLACEHOLDER } from '@/utils/profilePhotos';
import { isGraphQLEnabled } from '@/services/graphqlService';
import styles from './ConnectionsList.module.css';

export const SkippedProfilesPage: React.FC = () => {
  const [items, setItems] = useState<SkippedProfileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isGraphQLEnabled) {
        setError('Open the REST-backed app to load skipped profiles, or disable AppSync for this environment.');
        setItems([]);
        return;
      }
      const token = await authService.getJWT(true);
      if (!token) {
        setError('Sign in to view skipped profiles.');
        return;
      }
      const list = await matchService.getSkippedProfiles(token);
      setItems(list);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (status === 403) {
        setError(msg || 'Reviewing skipped profiles is not enabled for your account.');
      } else {
        setError(msg || (e instanceof Error ? e.message : 'Could not load skipped profiles'));
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
        Skipped
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Profiles you passed on in Discover. They stay out of your deck unless an admin enables recycling (then they
        appear with a &quot;Seen before&quot; label).
      </Typography>
      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {items.length === 0 && !error ? (
        <Typography color="text.secondary">You have not skipped anyone yet.</Typography>
      ) : (
        <ul className={styles.list}>
          {items.map((row) => {
            const photo =
              getMultiplePhotoUrls(row.photoUrls, row.userId, 1, row.name)[0] || NO_PHOTO_PLACEHOLDER;
            const when = row.skippedAt ? new Date(row.skippedAt).toLocaleString() : '';
            return (
              <li key={row.userId} className={styles.row}>
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
                  <Typography variant="caption" color="text.secondary" display="block">
                    Skipped {when}
                  </Typography>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
