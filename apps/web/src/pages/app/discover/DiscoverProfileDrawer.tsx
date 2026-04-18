import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { profileService, UserProfile } from '@/services/profileService';
import { authService } from '@/services/authService';
import { handleApiError } from '@/utils/apiErrorHandler';
import { getMultiplePhotoUrls, NO_PHOTO_PLACEHOLDER } from '@/utils/profilePhotos';
import { MatchFeedItem } from '@/services/matchService';
import type { MatchInsightResponse } from '@/types/ai';
import { MatchPanel } from './MatchPanel';
import { useI18n } from '@/hooks/useI18n';
import styles from './DiscoverProfileDrawer.module.css';

function scheduleSummary(schedule: { days?: string[]; timeStart?: string; timeEnd?: string }[] | undefined): string {
  if (!schedule?.length) return '';
  return schedule.map((s) => `${(s.days ?? []).join('/')} ${s.timeStart ?? ''}-${s.timeEnd ?? ''}`).join('; ');
}

interface DiscoverProfileDrawerProps {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  previewCard: MatchFeedItem | null;
  matchReasons: string[];
  compatibilityScore: number;
  aiInsightCreditCost: number;
  aiMatchInsightFull?: MatchInsightResponse;
  onUnlockAiInsight?: () => void;
  aiInsightLoading?: boolean;
  onSkip: () => void;
  onWantToTrain: () => void;
  interestLoading: boolean;
  canAct: boolean;
  primaryCtaLabel: string;
  primaryCtaIcon?: string;
}

export const DiscoverProfileDrawer: React.FC<DiscoverProfileDrawerProps> = ({
  open,
  onClose,
  userId,
  previewCard,
  matchReasons,
  compatibilityScore,
  aiInsightCreditCost,
  aiMatchInsightFull,
  onUnlockAiInsight,
  aiInsightLoading,
  onSkip,
  onWantToTrain,
  interestLoading,
  canAct,
  primaryCtaLabel,
  primaryCtaIcon,
}) => {
  const { t } = useI18n();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<Partial<UserProfile> | null>(null);

  useEffect(() => {
    if (!open || !userId) {
      setDetail(null);
      setError('');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const token = await authService.getJWT(true);
        if (!token) {
          if (!cancelled) setError(t('discover.sign_in_to_view_profile'));
          return;
        }
        const data = await profileService.getProfile(token, userId);
        if (!cancelled) setDetail(data);
      } catch (e) {
        if (!cancelled) setError(handleApiError(e).message || t('discover.could_not_load_profile'));
      } finally {
        // Always clear loading (Strict Mode / fast close used to skip this when `cancelled` was true → stuck spinner).
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, userId, t]);

  const name = detail?.name ?? previewCard?.name ?? 'Member';
  const city = detail?.city ?? previewCard?.city;
  const bio = detail?.bio ?? previewCard?.bio;
  const level = detail?.level ?? previewCard?.level;
  const mode = detail?.mode ?? previewCard?.mode;
  const goals = detail?.goals ?? [];
  const sportTags = detail?.sportTags ?? previewCard?.sportTags ?? [];
  const availability = detail?.availabilitySchedule ?? [];
  const photoUrls = getMultiplePhotoUrls(
    detail?.photoUrls ?? previewCard?.photoUrls,
    userId ?? previewCard?.userId ?? '',
    6,
    name
  );

  return (
    <Drawer
      anchor={isMobile ? 'bottom' : 'right'}
      open={open}
      onClose={onClose}
      PaperProps={{
        className: styles.paper,
        sx: {
          width: isMobile ? '100%' : { md: 'min(480px, 100vw)' },
          maxHeight: isMobile ? '92vh' : '100%',
        },
      }}
    >
      <Box className={styles.header}>
        <Typography variant="h6" component="h2" className={styles.headerTitle}>
          {t('discover_drawer.title')}
        </Typography>
        <IconButton onClick={onClose} aria-label={t('common.close')} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      <Box className={styles.body}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}
        {!loading && error && !previewCard && (
          <Typography color="error" variant="body2" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}
        {!loading && error && previewCard && (
          <Typography color="warning.main" variant="body2" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}
        {!loading && (detail || previewCard) && (
          <>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {photoUrls.slice(0, 6).map((url, i) => (
                <Box
                  key={i}
                  component="img"
                  src={url || NO_PHOTO_PLACEHOLDER}
                  alt=""
                  sx={{
                    width: 100,
                    height: 100,
                    objectFit: 'cover',
                    objectPosition: 'center top',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                />
              ))}
            </Stack>

            <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
              {name}
            </Typography>
            {level && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                {t('discover_drawer.level')}: {level.charAt(0).toUpperCase() + level.slice(1)}
              </Typography>
            )}
            {city && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {city}
                {detail?.state ? `, ${detail.state}` : ''}
              </Typography>
            )}
            {bio && (
              <Typography variant="body2" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                {bio}
              </Typography>
            )}
            {goals.length > 0 && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                {t('discover_drawer.goals')}
              </Typography>
            )}
            {goals.length > 0 && (
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                {goals.map((g) => (
                  <Chip key={g} label={g} size="small" variant="outlined" />
                ))}
              </Stack>
            )}
            {sportTags.length > 0 && (
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                {sportTags.map((sport) => (
                  <Chip key={sport} label={sport} size="small" />
                ))}
              </Stack>
            )}
            {(detail?.workoutStyle || detail?.personalityTag) && (
              <Box sx={{ mb: 2 }}>
                {detail?.workoutStyle && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    <strong>{t('discover_drawer.workout_style')}:</strong> {detail.workoutStyle}
                  </Typography>
                )}
                {detail?.personalityTag && (
                  <Typography variant="body2" color="text.secondary">
                    <strong>{t('discover_drawer.personality')}:</strong> {detail.personalityTag}
                  </Typography>
                )}
              </Box>
            )}
            {availability.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                  {t('discover_drawer.availability')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {scheduleSummary(availability as { days?: string[]; timeStart?: string; timeEnd?: string }[])}
                </Typography>
              </Box>
            )}

            <MatchPanel
              score={compatibilityScore}
              reasons={matchReasons}
              lockedInsightReasons={previewCard?.lockedInsightReasons}
              aiMatchInsight={previewCard?.aiMatchInsight}
              aiMatchInsightFull={aiMatchInsightFull}
              aiInsightCreditCost={aiInsightCreditCost}
              onUnlockAiInsight={canAct ? onUnlockAiInsight : undefined}
              aiInsightLoading={aiInsightLoading}
              compact
              collapsible
              defaultCollapsed
            />
          </>
        )}
      </Box>

      <Box className={styles.footer}>
        <Button variant="outlined" fullWidth onClick={onClose} aria-label={t('discover_drawer.back_aria')}>
          {t('discover_drawer.back')}
        </Button>
        <Button
          variant="outlined"
          fullWidth
          onClick={() => {
            onSkip();
            onClose();
          }}
          disabled={!canAct || interestLoading}
        >
          {t('discover.skip')}
        </Button>
        <Button
          variant="contained"
          color="primary"
          fullWidth
          onClick={onWantToTrain}
          disabled={!canAct || interestLoading}
          sx={{ py: 1.25, fontWeight: 800 }}
        >
          {interestLoading ? (
            <CircularProgress size={22} color="inherit" />
          ) : (
            <>
              {primaryCtaIcon ? (
                <Box component="span" sx={{ mr: 1 }} aria-hidden>
                  {primaryCtaIcon}
                </Box>
              ) : null}
              {primaryCtaLabel}
            </>
          )}
        </Button>
      </Box>
    </Drawer>
  );
};
