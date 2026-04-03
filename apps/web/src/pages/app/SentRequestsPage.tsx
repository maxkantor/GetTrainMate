import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Alert,
  Chip,
  CircularProgress,
  Button,
  Card,
  CardContent,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthContext } from '@/hooks/useAuthContext';
import { getMultiplePhotoUrls, NO_PHOTO_PLACEHOLDER } from '@/utils/profilePhotos';
import { GraphQLApiError } from '@/services/graphqlService';
import { matchQueryKeys } from '@/lib/queryKeys';
import { fetchSentRequestsForUser } from '@/services/matchExploreQueries';
import type { SentRequestItem } from '@/services/matchService';
import styles from './ConnectionsList.module.css';

function SentCard({ row }: { row: SentRequestItem }) {
  const photo =
    getMultiplePhotoUrls(row.photoUrls, row.userId, 1, row.name)[0] || NO_PHOTO_PLACEHOLDER;
  const isMatched = row.status === 'Matched';
  const statusColor =
    row.status === 'Matched' ? 'success' : row.status === 'Pending' ? 'primary' : 'warning';

  return (
    <Card variant="outlined" sx={{ height: '100%', borderRadius: 2, bgcolor: 'background.paper' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, p: 2 }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
          <img
            src={photo}
            alt=""
            className={styles.gridAvatar}
          />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Link to={`/app/profile/${encodeURIComponent(row.userId)}`} className={styles.nameLink}>
              {row.name}
            </Link>
            {row.city ? (
              <Typography variant="caption" color="text.secondary" display="block">
                {row.city}
              </Typography>
            ) : null}
            <Chip size="small" label={row.status} color={statusColor} sx={{ mt: 0.75 }} variant="outlined" />
          </Box>
        </Box>
        {isMatched ? (
          <Button
            component={Link}
            to={`/app/chat?thread=${encodeURIComponent(row.matchId)}`}
            variant="contained"
            size="small"
            fullWidth
            sx={{ mt: 'auto' }}
          >
            Open chat
          </Button>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            Waiting
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export const SentRequestsPage: React.FC = () => {
  const { user } = useAuthContext();
  const userSub = user?.sub ?? '';

  const {
    data: items = [],
    isLoading: loading,
    isError,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: matchQueryKeys.sentRequests(userSub),
    queryFn: () => fetchSentRequestsForUser(userSub),
    enabled: !!userSub,
  });

  const { matched, pending } = useMemo(() => {
    const m: SentRequestItem[] = [];
    const p: SentRequestItem[] = [];
    for (const row of items) {
      if (row.status === 'Matched') m.push(row);
      else p.push(row);
    }
    return { matched: m, pending: p };
  }, [items]);

  const error = (() => {
    if (!isError || queryError == null) return '';
    if (queryError instanceof GraphQLApiError && queryError.status === 403) {
      return 'Sent requests are not enabled for your account.';
    }
    const status = (queryError as { response?: { status?: number; data?: { message?: string } } })?.response?.status;
    const msg = (queryError as { response?: { data?: { message?: string } } })?.response?.data?.message;
    if (status === 403) return msg || 'Sent requests are not enabled for your account.';
    if (queryError instanceof Error) return queryError.message;
    return 'Could not load sent requests';
  })();

  if (!userSub) {
    return (
      <Box className={styles.rootWide} py={4}>
        <Typography color="text.secondary">Sign in to view sent requests.</Typography>
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
        Sent requests
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Your last 30 outgoing likes, newest first. Matched means you can chat; Pending means they have not matched back
        yet.
      </Typography>
      {error ? (
        <Alert severity="warning" sx={{ mb: 2 }} action={<Button onClick={() => refetch()}>Retry</Button>}>
          {error}
        </Alert>
      ) : null}
      {!error && items.length === 0 ? (
        <Typography color="text.secondary">No outgoing requests yet.</Typography>
      ) : !error ? (
        <>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, letterSpacing: '0.06em' }}>
            Matched
          </Typography>
          {matched.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              No matched invites yet.
            </Typography>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 2,
                mb: 4,
              }}
            >
              {matched.map((row) => (
                <SentCard key={row.matchId} row={row} />
              ))}
            </Box>
          )}

          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, letterSpacing: '0.06em' }}>
            Pending
          </Typography>
          {pending.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No pending invites.
            </Typography>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              {pending.map((row) => (
                <SentCard key={row.matchId} row={row} />
              ))}
            </Box>
          )}
        </>
      ) : null}
    </div>
  );
};
