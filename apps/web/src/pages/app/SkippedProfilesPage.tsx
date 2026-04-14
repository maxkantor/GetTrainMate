import React from 'react';
import { Box, Typography, Alert, CircularProgress, Button, Card, CardContent } from '@mui/material';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useI18n } from '@/hooks/useI18n';
import { getMultiplePhotoUrls, NO_PHOTO_PLACEHOLDER, fallbackPlaceholderPhotoUrl } from '@/utils/profilePhotos';
import { GraphQLApiError } from '@/services/graphqlService';
import { matchQueryKeys } from '@/lib/queryKeys';
import { fetchSkippedProfilesForUser } from '@/services/matchExploreQueries';
import styles from './ConnectionsList.module.css';

export const SkippedProfilesPage: React.FC = () => {
  const { t } = useI18n();
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
      return t('app_pages.skipped.review_not_enabled');
    }
    const status = (queryError as { response?: { status?: number; data?: { message?: string } } })?.response?.status;
    const msg = (queryError as { response?: { data?: { message?: string } } })?.response?.data?.message;
    if (status === 403) return msg || t('app_pages.skipped.review_not_enabled');
    if (queryError instanceof Error) return queryError.message;
    return t('app_pages.skipped.could_not_load');
  })();

  if (!userSub) {
    return (
      <Box className={styles.rootWide} py={4}>
        <Typography color="text.secondary">{t('app_pages.skipped.sign_in_to_view')}</Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box className={styles.rootWide} display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div className={styles.rootWide}>
      <Typography variant="h5" component="h1" gutterBottom>
        {t('nav.skipped')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('app_pages.skipped.subtitle')}
      </Typography>
      {error ? (
        <Alert severity="warning" sx={{ mb: 2 }} action={<Button onClick={() => refetch()}>{t('discover.retry')}</Button>}>
          {error}
        </Alert>
      ) : null}
      {!error && items.length === 0 ? (
        <Typography color="text.secondary">{t('app_pages.skipped.empty')}</Typography>
      ) : !error ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(3, minmax(0, 1fr))',
            },
            gap: 2,
          }}
        >
          {items.map((row) => {
            const photo =
              getMultiplePhotoUrls(row.photoUrls, row.userId, 1, row.name)[0] || NO_PHOTO_PLACEHOLDER;
            const when = row.skippedAt ? new Date(row.skippedAt).toLocaleString() : '';
            return (
              <Card key={row.userId} variant="outlined" sx={{ borderRadius: 2, bgcolor: 'background.paper' }}>
                <CardContent sx={{ display: 'flex', gap: 1.5, p: 2 }}>
                  <img
                    src={photo}
                    alt=""
                    className={styles.gridAvatar}
                    onError={(e) => {
                      const el = e.currentTarget;
                      if (el.dataset.fallback === '2') {
                        el.src = NO_PHOTO_PLACEHOLDER;
                        return;
                      }
                      if (el.dataset.fallback === '1') {
                        el.dataset.fallback = '2';
                        el.src = NO_PHOTO_PLACEHOLDER;
                        return;
                      }
                      el.dataset.fallback = '1';
                      el.src = fallbackPlaceholderPhotoUrl(row.userId, 0);
                    }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Link to={`/app/profile/${encodeURIComponent(row.userId)}`} className={styles.nameLink}>
                      {row.name}
                    </Link>
                    {row.city ? (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {row.city}
                      </Typography>
                    ) : null}
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                      {when}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      ) : null}
    </div>
  );
};
