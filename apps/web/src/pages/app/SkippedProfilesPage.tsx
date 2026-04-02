import React from 'react';
import { Box, Typography, Alert, CircularProgress, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthContext } from '@/hooks/useAuthContext';
import { getMultiplePhotoUrls, NO_PHOTO_PLACEHOLDER } from '@/utils/profilePhotos';
import { GraphQLApiError } from '@/services/graphqlService';
import { matchQueryKeys } from '@/lib/queryKeys';
import { fetchSkippedProfilesForUser } from '@/services/matchExploreQueries';
import styles from './ConnectionsList.module.css';

export const SkippedProfilesPage: React.FC = () => {
  const { user } = useAuthContext();
  const userSub = user?.sub ?? '';

  const {
    data: items = [],
    isLoading: loading,
    isError,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: matchQueryKeys.skippedProfiles(userSub),
    queryFn: () => fetchSkippedProfilesForUser(userSub),
    enabled: !!userSub,
  });

  const error = (() => {
    if (!isError || queryError == null) return '';
    if (queryError instanceof GraphQLApiError && queryError.status === 403) {
      return 'Reviewing skipped profiles is not enabled for your account.';
    }
    const status = (queryError as { response?: { status?: number; data?: { message?: string } } })?.response?.status;
    const msg = (queryError as { response?: { data?: { message?: string } } })?.response?.data?.message;
    if (status === 403) return msg || 'Reviewing skipped profiles is not enabled for your account.';
    if (queryError instanceof Error) return queryError.message;
    return 'Could not load skipped profiles';
  })();

  if (!userSub) {
    return (
      <Box className={styles.root} py={4}>
        <Typography color="text.secondary">Sign in to view skipped profiles.</Typography>
      </Box>
    );
  }

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
      {error ? (
        <Alert severity="warning" sx={{ mb: 2 }} action={<Button onClick={() => refetch()}>Retry</Button>}>
          {error}
        </Alert>
      ) : null}
      {!error && items.length === 0 ? (
        <Typography color="text.secondary">You have not skipped anyone yet.</Typography>
      ) : !error ? (
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
      ) : null}
    </div>
  );
};
