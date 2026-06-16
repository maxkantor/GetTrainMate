import React, { useCallback, useMemo, useState } from 'react';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { WcToast } from '@/components/worldCupHub/WcToast';
import type { EventMatch, EventPrediction } from '@/services/sportsEventLayerService';
import { useI18n } from '@/hooks/useI18n';
import { formatI18n } from '@/i18n';
import { useWcDisplay } from '@/hooks/useWcDisplay';
import { useMe } from '@/hooks/useMe';
import { useHeaderAvatarPhoto } from '@/hooks/useHeaderAvatarPhoto';
import { authService } from '@/services/authService';
import { CountryFlag } from '@/components/worldCupHub/CountryFlag';
import { renderTodayPicksCanvas } from '@/utils/todayPredictionsShareCanvas';
import { buildTodayPickRow } from '@/utils/todaySharePicks';
import { fetchProfilePhotoForCanvas } from '@/utils/profilePhotos';
import { formatKickoffFriendly } from '@/utils/eventMatchUtils';
import {
  canvasToShareFile,
  downloadCanvasImage,
  shareContent,
} from '@/utils/nativeShare';
import styles from '@/pages/WorldCupV2.module.css';

type Props = {
  match: EventMatch;
  prediction: EventPrediction;
  onShared?: () => void;
};

export const PredictionShareCard: React.FC<Props> = ({ match, prediction, onShared }) => {
  const { t } = useI18n();
  const { me } = useMe();
  const { teamName } = useWcDisplay();
  const profilePhotoUrl = useHeaderAvatarPhoto(me?.profile?.photoUrls);
  const [notice, setNotice] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const row = useMemo(
    () => buildTodayPickRow(match, prediction, teamName, t),
    [match, prediction, teamName, t],
  );

  const fanName = me?.profile?.name?.trim()
    || prediction.userDisplayName?.trim()
    || t('event_hub.share_fan_fallback');

  const dateLabel = formatKickoffFriendly(match.matchDate, match.matchTime)
    ?? t('event_hub.share_card_title');

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/world-cup` : '';
  const shareLinkLabel = shareUrl.replace(/^https?:\/\//, '');
  const imageFilename = `world-cup-prediction-${match.teamAId}-vs-${match.teamBId}.png`;

  const buildSharePayload = useCallback(() => {
    const title = formatI18n(t('event_hub.share_pick_sheet_title'), {
      name: fanName,
      teamA: row.teamAName,
      teamB: row.teamBName,
    });
    return { title, url: shareUrl };
  }, [fanName, row.teamAName, row.teamBName, t, shareUrl]);

  const renderShareCanvas = useCallback(async () => {
    const token = await authService.getJWT();
    const avatarImg = await fetchProfilePhotoForCanvas(me?.profile?.photoUrls, {
      token,
      displayUrl: profilePhotoUrl,
    });
    return renderTodayPicksCanvas(
      fanName,
      dateLabel,
      [row],
      {
        eventTitle: t('event_hub.share_today_event_title'),
        subtitle: t('event_hub.share_card_title'),
        picksHeading: t('event_hub.share_today_picks_heading'),
        footer: shareLinkLabel,
        footerMadeOn: t('event_hub.share_card_footer'),
      },
      avatarImg,
    );
  }, [fanName, dateLabel, row, t, profilePhotoUrl, me?.profile?.photoUrls, shareLinkLabel]);

  const handleDownload = useCallback(async () => {
    setSharing(true);
    try {
      const canvas = await renderShareCanvas();
      downloadCanvasImage(canvas, imageFilename);
      setNotice(t('event_hub.image_downloaded'));
      onShared?.();
    } finally {
      setSharing(false);
    }
  }, [renderShareCanvas, imageFilename, onShared, t]);

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      const canvas = await renderShareCanvas();
      const { title, url } = buildSharePayload();
      const file = await canvasToShareFile(canvas, imageFilename);
      const result = await shareContent({ title, url, file });

      if (result === 'shared') {
        onShared?.();
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
      onShared?.();
    } finally {
      setSharing(false);
    }
  }, [renderShareCanvas, buildSharePayload, imageFilename, onShared, t]);

  return (
    <Box className={styles.todaySharePanel} sx={{ mt: 0 }}>
      <Typography className={styles.todayShareTitle}>{t('event_hub.share_card_title')}</Typography>
      <Typography className={styles.todayShareLead}>{t('event_hub.share_card_hint')}</Typography>

      <Box className={styles.todaySharePreview}>
        <Box className={styles.todaySharePickRow}>
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
      </Box>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap className={styles.todayShareActions}>
        <Button
          variant="contained"
          className={styles.ctaPrimary}
          onClick={handleShare}
          disabled={sharing}
          startIcon={sharing ? <CircularProgress size={18} color="inherit" /> : undefined}
        >
          {t('event_hub.share')}
        </Button>
        <Button
          variant="outlined"
          className={styles.ctaSecondary}
          onClick={handleDownload}
          disabled={sharing}
        >
          {t('event_hub.download_image')}
        </Button>
      </Stack>

      <WcToast open={!!notice} message={notice} onClose={() => setNotice(null)} />
    </Box>
  );
};
