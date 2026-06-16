import React, { useCallback, useMemo, useState } from 'react';
import { Avatar, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { WcToast } from '@/components/worldCupHub/WcToast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import { useMe } from '@/hooks/useMe';
import { useHeaderAvatarPhoto } from '@/hooks/useHeaderAvatarPhoto';
import { useWcDisplay } from '@/hooks/useWcDisplay';
import { formatI18n } from '@/i18n';
import type { EventMatch } from '@/services/sportsEventLayerService';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import { authService } from '@/services/authService';
import { renderTodayPicksCanvas } from '@/utils/todayPredictionsShareCanvas';
import { fetchProfilePhotoForCanvas } from '@/utils/profilePhotos';
import {
  canvasToShareFile,
  downloadCanvasImage,
  shareContent,
} from '@/utils/nativeShare';
import {
  fetchTodaySharePicks,
  fetchUpcomingSharePicks,
  todaySharePicksQueryKey,
  upcomingSharePicksQueryKey,
  type TodaySharePick,
} from '@/utils/todaySharePicks';
import { CountryFlag } from '@/components/worldCupHub/CountryFlag';
import { WcTrophyLogo } from '@/components/worldCupHub/WcTrophyLogo';
import styles from '@/pages/WorldCupV2.module.css';

type ShareVariant = 'today' | 'upcoming';

type Props = {
  eventId: string;
  matches: EventMatch[];
  isAuthenticated: boolean;
  onAuthRequired: () => void;
  variant?: ShareVariant;
};

export const TodayPredictionsSharePanel: React.FC<Props> = ({
  eventId,
  matches,
  isAuthenticated,
  onAuthRequired,
  variant = 'today',
}) => {
  const { t, locale } = useI18n();
  const { me } = useMe();
  const { teamName } = useWcDisplay();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const isUpcoming = variant === 'upcoming';

  const picksQueryKey = useMemo(
    () => (isUpcoming
      ? upcomingSharePicksQueryKey(eventId, matches)
      : todaySharePicksQueryKey(eventId, matches)),
    [isUpcoming, eventId, matches],
  );

  const { data: sharePicks = [], isFetching: picksLoading } = useQuery({
    queryKey: picksQueryKey,
    queryFn: () => (isUpcoming
      ? fetchUpcomingSharePicks(eventId, matches, teamName, t)
      : fetchTodaySharePicks(eventId, matches, teamName, t)),
    enabled: isAuthenticated,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const fanName = me?.profile?.name?.trim()
    || sharePicks[0]?.pred.userDisplayName?.trim()
    || t('event_hub.share_fan_fallback');

  const profilePhotoUrl = useHeaderAvatarPhoto(me?.profile?.photoUrls);

  const dateLabel = isUpcoming
    ? t('event_hub.share_upcoming_date_label')
    : new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date());

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/world-cup` : '';
  const shareLinkLabel = shareUrl.replace(/^https?:\/\//, '');

  const buildSharePayload = useCallback(() => {
    const titleKey = isUpcoming
      ? 'event_hub.share_upcoming_whatsapp_header'
      : 'event_hub.share_today_whatsapp_header';
    const title = formatI18n(t(titleKey), { name: fanName });
    return { title, url: shareUrl };
  }, [fanName, isUpcoming, t, shareUrl]);

  const imageFilename = isUpcoming
    ? `world-cup-upcoming-picks-${fanName.replace(/\s+/g, '-').toLowerCase()}.png`
    : `world-cup-picks-${fanName.replace(/\s+/g, '-').toLowerCase()}.png`;

  const loadFreshPicks = useCallback(async () => {
    return queryClient.fetchQuery({
      queryKey: picksQueryKey,
      queryFn: () => (isUpcoming
        ? fetchUpcomingSharePicks(eventId, matches, teamName, t)
        : fetchTodaySharePicks(eventId, matches, teamName, t)),
    });
  }, [queryClient, picksQueryKey, isUpcoming, eventId, matches, teamName, t]);

  const renderShareCanvas = useCallback(async (picks: TodaySharePick[]) => {
    const token = await authService.getJWT();
    const avatarImg = await fetchProfilePhotoForCanvas(me?.profile?.photoUrls, {
      token,
      displayUrl: profilePhotoUrl,
    });
    return renderTodayPicksCanvas(
      fanName,
      dateLabel,
      picks.map((p) => p.row),
      {
        eventTitle: t('event_hub.share_today_event_title'),
        subtitle: isUpcoming
          ? t('event_hub.share_upcoming_subtitle')
          : t('event_hub.share_today_subtitle'),
        picksHeading: t('event_hub.share_today_picks_heading'),
        footer: shareLinkLabel,
        footerMadeOn: t('event_hub.share_card_footer'),
      },
      avatarImg,
    );
  }, [fanName, dateLabel, isUpcoming, t, profilePhotoUrl, me?.profile?.photoUrls, shareLinkLabel]);

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
      const canvas = await renderShareCanvas(picks);
      downloadCanvasImage(canvas, imageFilename);
      setNotice(t('event_hub.image_downloaded'));
      recordShares(picks);
    } finally {
      setSharing(false);
    }
  }, [loadFreshPicks, renderShareCanvas, imageFilename, recordShares, t]);

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      const picks = await loadFreshPicks();
      if (picks.length === 0) return;

      const canvas = await renderShareCanvas(picks);
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
  }, [loadFreshPicks, renderShareCanvas, buildSharePayload, imageFilename, recordShares, t]);

  if (!isAuthenticated) {
    const loginKey = isUpcoming
      ? 'event_hub.share_upcoming_login'
      : 'event_hub.share_today_login';
    const titleKey = isUpcoming
      ? 'event_hub.share_upcoming_title'
      : 'event_hub.share_today_title';
    return (
      <Box className={styles.todaySharePanel}>
        <Typography className={styles.todayShareTitle}>{t(titleKey)}</Typography>
        <Typography className={styles.todayShareLead}>{t(loginKey)}</Typography>
        <Button variant="contained" className={styles.ctaPrimary} onClick={onAuthRequired}>
          {t('event_hub.signup_free')}
        </Button>
      </Box>
    );
  }

  if (!picksLoading && sharePicks.length === 0) return null;

  const titleKey = isUpcoming
    ? 'event_hub.share_upcoming_title_named'
    : 'event_hub.share_today_title_named';
  const leadKey = isUpcoming
    ? 'event_hub.share_upcoming_lead'
    : 'event_hub.share_today_lead';

  return (
    <Box className={styles.todaySharePanel}>
      <Box className={styles.todayShareHeader}>
        <WcTrophyLogo size="sm" glow className={styles.todayShareHeaderTrophy} />
        <Box className={styles.todayShareHeaderBody}>
          <Typography className={styles.todayShareTitle}>
            {formatI18n(t(titleKey), { name: fanName })}
          </Typography>
          <Typography className={styles.todayShareLead}>
            {formatI18n(t(leadKey), { count: sharePicks.length })}
          </Typography>
        </Box>
        <Avatar
          src={profilePhotoUrl ?? undefined}
          alt={fanName}
          className={styles.todayShareAvatar}
        >
          {fanName.charAt(0).toUpperCase()}
        </Avatar>
      </Box>

      <Box className={styles.todaySharePreview}>
        {sharePicks.map(({ match, row }) => (
          <Box key={match.matchId} className={styles.todaySharePickRow}>
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

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap className={styles.todayShareActions}>
        <Button
          variant="contained"
          className={styles.ctaPrimary}
          onClick={handleShare}
          disabled={sharing || picksLoading || sharePicks.length === 0}
          startIcon={sharing ? <CircularProgress size={18} color="inherit" /> : undefined}
        >
          {t('event_hub.share')}
        </Button>
        <Button
          variant="outlined"
          className={styles.ctaSecondary}
          onClick={handleDownload}
          disabled={sharing || picksLoading || sharePicks.length === 0}
        >
          {t('event_hub.download_image')}
        </Button>
      </Stack>

      <WcToast open={!!notice} message={notice} onClose={() => setNotice(null)} />
    </Box>
  );
};
