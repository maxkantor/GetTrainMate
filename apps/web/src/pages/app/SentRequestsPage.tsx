import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Alert,
  Chip,
  CircularProgress,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
} from '@mui/material';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useI18n } from '@/hooks/useI18n';
import { getMultiplePhotoUrls, NO_PHOTO_PLACEHOLDER } from '@/utils/profilePhotos';
import { GraphQLApiError } from '@/services/graphqlService';
import { matchQueryKeys } from '@/lib/queryKeys';
import {
  fetchSentRequestsForUser,
  fetchIncomingLikesForUser,
  cancelSentInviteForUser,
} from '@/services/matchExploreQueries';
import type { SentRequestItem } from '@/services/matchService';
import { creditPhrase } from '@/config/premiumCatalog';
import styles from './ConnectionsList.module.css';

function SentCard({
  row,
  showCancelButton,
  onRequestCancel,
  cancelBusy,
}: {
  row: SentRequestItem;
  showCancelButton: boolean;
  onRequestCancel?: () => void;
  cancelBusy?: boolean;
}) {
  const { t } = useI18n();
  const photo =
    getMultiplePhotoUrls(row.photoUrls, row.userId, 1, row.name)[0] || NO_PHOTO_PLACEHOLDER;
  const isMatched = row.status === 'Matched';
  const statusColor =
    row.status === 'Matched' ? 'success' : row.status === 'Pending' ? 'primary' : 'warning';

  return (
    <Card variant="outlined" sx={{ height: '100%', borderRadius: 2, bgcolor: 'background.paper' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, p: 2 }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
          <img src={photo} alt="" className={styles.gridAvatar} />
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
        ) : showCancelButton ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 'auto' }}>
            <Typography variant="caption" color="text.secondary">
              {t('sentRequests.waiting')}
            </Typography>
            <Button
              type="button"
              variant="outlined"
              color="inherit"
              size="small"
              fullWidth
              disabled={cancelBusy}
              onClick={onRequestCancel}
            >
              {t('sentRequests.cancel_invite')}
            </Button>
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('sentRequests.waiting')}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export const SentRequestsPage: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthContext();
  const userSub = user?.sub ?? '';
  const queryClient = useQueryClient();
  const [cancelTarget, setCancelTarget] = useState<SentRequestItem | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const {
    data: incomingPayload,
    isLoading: incomingLoading,
  } = useQuery({
    queryKey: matchQueryKeys.incomingLikes(userSub),
    queryFn: () => fetchIncomingLikesForUser(userSub),
    enabled: !!userSub,
  });

  const cancelMutation = useMutation({
    mutationFn: (targetUserId: string) => cancelSentInviteForUser(targetUserId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: matchQueryKeys.sentRequests(userSub) });
      setCancelTarget(null);
      setToastOpen(true);
      setActionError(null);
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err)) {
        const m = (err.response?.data as { message?: string } | undefined)?.message;
        if (m) {
          setActionError(m);
          return;
        }
      }
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : t('sentRequests.error_cancel');
      setActionError(msg);
    },
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
    const status = (queryError as { response?: { status?: number; data?: { message?: string } } })?.response
      ?.status;
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
        {t('sentRequests.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('sentRequests.subtitle')}
      </Typography>

      {incomingLoading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <CircularProgress size={22} />
          <Typography variant="body2" color="text.secondary">
            Checking incoming interests…
          </Typography>
        </Box>
      ) : incomingPayload && !incomingPayload.unlocked ? (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button component={Link} to="/app/profile" size="small" variant="outlined" color="inherit">
              Unlock on Profile
            </Button>
          }
        >
          Reveal who liked you ({creditPhrase(incomingPayload.requiredCredits ?? 3)}) to see athletes who sent
          interest before you matched. One-time unlock.
        </Alert>
      ) : null}

      {incomingPayload?.unlocked && (incomingPayload.items?.length ?? 0) > 0 ? (
        <>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, letterSpacing: '0.06em' }}>
            Liked you first
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Open a profile and like back to match.
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
              mb: 3,
            }}
          >
            {incomingPayload.items!.map((row) => (
              <SentCard key={`in-${row.matchId}-${row.userId}`} row={row} showCancelButton={false} />
            ))}
          </Box>
        </>
      ) : null}

      {error ? (
        <Alert severity="warning" sx={{ mb: 2 }} action={<Button onClick={() => refetch()}>Retry</Button>}>
          {error}
        </Alert>
      ) : null}
      {actionError ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      ) : null}
      {!error && items.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center', maxWidth: 420, mx: 'auto' }}>
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            {t('sentRequests.empty_all')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('sentRequests.empty_pending_hint')}
          </Typography>
        </Box>
      ) : !error ? (
        <>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, letterSpacing: '0.06em' }}>
            Matched
          </Typography>
          {matched.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {t('sentRequests.no_matched')}
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
                <SentCard key={row.matchId} row={row} showCancelButton={false} />
              ))}
            </Box>
          )}

          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, letterSpacing: '0.06em' }}>
            Pending
          </Typography>
          {pending.length === 0 ? (
            <Box sx={{ py: 3, px: 2, borderRadius: 2, border: '1px dashed', borderColor: 'divider' }}>
              <Typography variant="subtitle1" color="text.primary" gutterBottom>
                {t('sentRequests.empty_pending_title')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('sentRequests.empty_pending_hint')}
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              {pending.map((row) => (
                <SentCard
                  key={`${row.matchId}-${row.userId}`}
                  row={row}
                  showCancelButton={row.status === 'Pending'}
                  cancelBusy={cancelMutation.isPending}
                  onRequestCancel={() => setCancelTarget(row)}
                />
              ))}
            </Box>
          )}
        </>
      ) : null}

      <Dialog open={cancelTarget !== null} onClose={() => !cancelMutation.isPending && setCancelTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('sentRequests.cancel_confirm_title')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t('sentRequests.cancel_confirm_body')}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCancelTarget(null)} disabled={cancelMutation.isPending}>
            {t('sentRequests.keep_invite')}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={cancelMutation.isPending || !cancelTarget}
            onClick={() => {
              if (cancelTarget) cancelMutation.mutate(cancelTarget.userId);
            }}
          >
            {cancelMutation.isPending ? '…' : t('sentRequests.confirm_cancel')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toastOpen}
        autoHideDuration={4000}
        onClose={() => setToastOpen(false)}
        message={t('sentRequests.invite_cancelled')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </div>
  );
};
