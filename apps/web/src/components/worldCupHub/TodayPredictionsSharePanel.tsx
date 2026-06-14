import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Avatar, Box, Button, CircularProgress, Snackbar, Stack, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import { useMe } from '@/hooks/useMe';
import { useHeaderAvatarPhoto } from '@/hooks/useHeaderAvatarPhoto';
import { useWcDisplay } from '@/hooks/useWcDisplay';
import { formatI18n } from '@/i18n';
import type { EventMatch } from '@/services/sportsEventLayerService';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import {
  canvasToShareFile,
  downloadCanvasImage,
  shareContent,
} from '@/utils/nativeShare';
import {
  captureElementToCanvas,
  waitForDomPickCount,
} from '@/utils/domShareCapture';
import {
  fetchTodaySharePicks,
  todaySharePicksQueryKey,
  type TodaySharePick,
} from '@/utils/todaySharePicks';
import { CountryFlag } from '@/components/worldCupHub/CountryFlag';
import styles from '@/pages/WorldCupV2.module.css';

type Props = {
  eventId: string;
  /** Full hub fixture list — share includes every pick for matches kicking off today (incl. finished). */
  matches: EventMatch[];
  isAuthenticated: boolean;
  onAuthRequired: () => void;
};

export const TodayPredictionsSharePanel: React.FC<Props> = ({
  eventId,
  matches,
  isAuthenticated,
  onAuthRequired,
}) => {
  const { t, locale } = useI18n();
  const { me } = useMe();
  const { teamName } = useWcDisplay();
  const queryClient = useQueryClient();
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const picksQueryKey = useMemo(
    () => todaySharePicksQueryKey(eventId, matches),
    [eventId, matches],
  );

  const { data: todayPicks = [], isFetching: picksLoading } = useQuery({
    queryKey: picksQueryKey,
    queryFn: () => fetchTodaySharePicks(eventId, matches, teamName, t),
    enabled: isAuthenticated,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const fanName = me?.profile?.name?.trim()
    || todayPicks[0]?.pred.userDisplayName?.trim()
    || t('event_hub.share_fan_fallback');

  const profilePhotoUrl = useHeaderAvatarPhoto(me?.profile?.photoUrls);

  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/world-cup` : '';
  const shareLinkLabel = shareUrl.replace(/^https?:\/\//, '');

  const buildSharePayload = useCallback(() => {
    const title = formatI18n(t('event_hub.share_today_whatsapp_header'), { name: fanName });
    return { title, url: shareUrl };
  }, [fanName, t, shareUrl]);

  const imageFilename = `world-cup-picks-${fanName.replace(/\s+/g, '-').toLowerCase()}.png`;

  const loadFreshPicks = useCallback(async () => {
    return queryClient.fetchQuery({
      queryKey: picksQueryKey,
      queryFn: () => fetchTodaySharePicks(eventId, matches, teamName, t),
    });
  }, [queryClient, picksQueryKey, eventId, matches, teamName, t]);

  const captureShareImage = useCallback(async (expectedPickCount: number) => {
    const el = shareCardRef.current;
    if (!el) throw new Error('Share card not ready');
    await waitForDomPickCount(el, expectedPickCount);
    return captureElementToCanvas(el);
  }, []);

  const recordShares = useCallback((picks: TodaySharePick[]) => {
    for (const { match } of picks) {
      sportsEventLayerService.sharePrediction(eventId, match.matchId).catch(() => {});
    }
  }, [eventId]);

  const handleDownload = useCallback(async () => {
    setSharing(true);
    try {
      const picks = await loadFreshPicks();
      if (picks.length === 0) return;
      const canvas = await captureShareImage(picks.length);
      downloadCanvasImage(canvas, imageFilename);
      setNotice(t('event_hub.image_downloaded'));
      recordShares(picks);
    } finally {
      setSharing(false);
    }
  }, [loadFreshPicks, captureShareImage, imageFilename, recordShares, t]);

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      const picks = await loadFreshPicks();
      if (picks.length === 0) return;

      const canvas = await captureShareImage(picks.length);
      const { title, url } = buildSharePayload();
      const file = await canvasToShareFile(canvas, imageFilename);
      const result = await shareContent({ title, url, file });

      if (result === 'shared') {
        recordShares(picks);
        return;
      }
      if (result === 'aborted') return;

      downloadCanvasImage(canvas, imageFilename);
      try {
        await navigator.clipboard.writeText(`${title}\n${url}`);
        setNotice(t('event_hub.share_fallback'));
      } catch {
        setNotice(t('event_hub.image_downloaded'));
      }
      recordShares(picks);
    } finally {
      setSharing(false);
    }
  }, [loadFreshPicks, captureShareImage, buildSharePayload, imageFilename, recordShares, t]);

  if (!isAuthenticated) {
    return (
      <Box className={styles.todaySharePanel}>
        <Typography className={styles.todayShareTitle}>{t('event_hub.share_today_title')}</Typography>
        <Typography className={styles.todayShareLead}>{t('event_hub.share_today_login')}</Typography>
        <Button variant="contained" className={styles.ctaPrimary} onClick={onAuthRequired}>
          {t('event_hub.signup_free')}
        </Button>
      </Box>
    );
  }

  if (!picksLoading && todayPicks.length === 0) return null;

  return (
    <Box className={styles.todaySharePanel}>
      <Box ref={shareCardRef} className={styles.todayShareCapture}>
        <Typography className={styles.todayShareEventBadge} component="p">
          {t('event_hub.share_today_event_title').toUpperCase()}
        </Typography>

        <Box className={styles.todayShareHeader}>
          <Box className={styles.todayShareIdentity}>
            <Avatar
              src={profilePhotoUrl ?? undefined}
              alt={fanName}
              className={styles.todayShareAvatar}
              imgProps={{ crossOrigin: 'anonymous' }}
            >
              {fanName.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography className={styles.todayShareTitle}>
                {formatI18n(t('event_hub.share_today_title_named'), { name: fanName })}
              </Typography>
              <Typography className={styles.todayShareLead}>
                {t('event_hub.share_today_subtitle')}
              </Typography>
              <Typography className={styles.todayShareDate}>{dateLabel}</Typography>
            </Box>
          </Box>
        </Box>

        <Typography className={styles.todayShareLead} sx={{ mb: 0.75, mt: 0.5 }}>
          {formatI18n(t('event_hub.share_today_lead'), { count: todayPicks.length })}
        </Typography>

        <Box className={styles.todaySharePreview}>
          {todayPicks.map(({ match, row }) => (
            <Box key={match.matchId} className={styles.todaySharePickRow} data-share-pick="">
              <Box className={styles.todayShareMatchup}>
                <CountryFlag teamId={match.teamAId} size={22} alt={row.teamAName} />
                <span>{row.teamAName}</span>
                <span className={styles.todayShareVs}>{t('event_hub.vs')}</span>
                <span>{row.teamBName}</span>
                <CountryFlag teamId={match.teamBId} size={22} alt={row.teamBName} />
              </Box>
              <Typography className={styles.todaySharePick}>
                → {row.pickLabel}
              </Typography>
            </Box>
          ))}
        </Box>

        <Typography className={styles.todayShareFooter}>
          {t('event_hub.share_card_footer')} · {shareLinkLabel}
        </Typography>
      </Box>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap className={styles.todayShareActions}>
        <Button
          variant="contained"
          className={styles.ctaPrimary}
          onClick={handleShare}
          disabled={sharing || picksLoading || todayPicks.length === 0}
          startIcon={sharing ? <CircularProgress size={18} color="inherit" /> : undefined}
        >
          {t('event_hub.share')}
        </Button>
        <Button
          variant="outlined"
          className={styles.ctaSecondary}
          onClick={handleDownload}
          disabled={sharing || picksLoading || todayPicks.length === 0}
        >
          {t('event_hub.download_image')}
        </Button>
      </Stack>

      <Snackbar
        open={!!notice}
        autoHideDuration={4000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setNotice(null)} sx={{ width: '100%' }}>
          {notice}
        </Alert>
      </Snackbar>
    </Box>
  );
};
