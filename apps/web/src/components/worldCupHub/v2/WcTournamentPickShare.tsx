import React, { useCallback, useMemo, useState } from 'react';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { WcToast } from '@/components/worldCupHub/WcToast';
import { useI18n } from '@/hooks/useI18n';
import { formatI18n } from '@/i18n';
import { useMe } from '@/hooks/useMe';
import { useHeaderAvatarPhoto } from '@/hooks/useHeaderAvatarPhoto';
import { useWcDisplay } from '@/hooks/useWcDisplay';
import { authService } from '@/services/authService';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import { WcTeamLabel } from '@/components/worldCupHub/WcTeamLabel';
import { fetchProfilePhotoForCanvas } from '@/utils/profilePhotos';
import {
  renderTournamentBracketShareCanvas,
  type TournamentBracketShareData,
} from '@/utils/tournamentBracketShareCanvas';
import {
  canvasToShareFile,
  downloadCanvasImage,
  shareContent,
} from '@/utils/nativeShare';
import styles from '@/pages/WorldCupV2.module.css';

type TeamRef = {
  teamId: string;
  name: string;
  flagEmoji?: string;
};

type Props = {
  eventId: string;
  semifinalists: TeamRef[];
  champion: TeamRef;
  thirdPlace: TeamRef;
  isAuthenticated: boolean;
  onAuthRequired: () => void;
};

export const WcTournamentPickShare: React.FC<Props> = ({
  eventId,
  semifinalists,
  champion,
  thirdPlace,
  isAuthenticated,
  onAuthRequired,
}) => {
  const { t } = useI18n();
  const { me } = useMe();
  const { teamName } = useWcDisplay();
  const profilePhotoUrl = useHeaderAvatarPhoto(me?.profile?.photoUrls);
  const [notice, setNotice] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const fanName = me?.profile?.name?.trim() || t('event_hub.share_fan_fallback');

  const shareData = useMemo((): TournamentBracketShareData => ({
    semifinalists: semifinalists.map((team) => ({
      teamId: team.teamId,
      name: teamName(team.teamId, team.name),
    })),
    champion: {
      teamId: champion.teamId,
      name: teamName(champion.teamId, champion.name),
    },
    thirdPlace: {
      teamId: thirdPlace.teamId,
      name: teamName(thirdPlace.teamId, thirdPlace.name),
    },
  }), [semifinalists, champion, thirdPlace, teamName]);

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/world-cup#predictions` : '';
  const shareLinkLabel = shareUrl.replace(/^https?:\/\//, '');
  const imageFilename = `world-cup-bracket-${fanName.replace(/\s+/g, '-').toLowerCase()}.png`;

  const buildSharePayload = useCallback(() => {
    const title = formatI18n(t('event_hub.tournament_share_whatsapp_header'), { name: fanName });
    return { title, url: shareUrl };
  }, [fanName, t, shareUrl]);

  const renderShareCanvas = useCallback(async () => {
    const token = await authService.getJWT();
    const avatarImg = await fetchProfilePhotoForCanvas(me?.profile?.photoUrls, {
      token,
      displayUrl: profilePhotoUrl,
    });
    return renderTournamentBracketShareCanvas(
      fanName,
      shareData,
      {
        eventTitle: t('event_hub.share_today_event_title'),
        subtitle: t('event_hub.tournament_share_subtitle'),
        semifinalsHeading: t('event_hub.tournament_pick_semifinals'),
        championHeading: t('event_hub.tournament_pick_champion'),
        thirdHeading: t('event_hub.tournament_pick_third'),
        footer: shareLinkLabel,
        footerMadeOn: t('event_hub.share_card_footer'),
      },
      avatarImg,
    );
  }, [fanName, shareData, t, profilePhotoUrl, me?.profile?.photoUrls, shareLinkLabel]);

  const recordShare = useCallback(() => {
    sportsEventLayerService.shareTournamentPick(eventId).catch(() => {});
  }, [eventId]);

  const handleDownload = useCallback(async () => {
    if (!isAuthenticated) {
      onAuthRequired();
      return;
    }
    setSharing(true);
    try {
      const canvas = await renderShareCanvas();
      downloadCanvasImage(canvas, imageFilename);
      setNotice(t('event_hub.image_downloaded'));
      recordShare();
    } finally {
      setSharing(false);
    }
  }, [isAuthenticated, onAuthRequired, renderShareCanvas, imageFilename, recordShare, t]);

  const handleShare = useCallback(async () => {
    if (!isAuthenticated) {
      onAuthRequired();
      return;
    }
    setSharing(true);
    try {
      const canvas = await renderShareCanvas();
      const { title, url } = buildSharePayload();
      const file = await canvasToShareFile(canvas, imageFilename);
      const result = await shareContent({ title, url, file });

      if (result === 'shared') {
        recordShare();
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
      recordShare();
    } finally {
      setSharing(false);
    }
  }, [isAuthenticated, onAuthRequired, renderShareCanvas, buildSharePayload, imageFilename, recordShare, t]);

  return (
    <Box className={styles.tournamentSharePanel}>
      <Typography className={styles.tournamentShareTitle}>
        {formatI18n(t('event_hub.tournament_share_title'), { name: fanName })}
      </Typography>
      <Typography className={styles.tournamentShareLead}>
        {t('event_hub.tournament_share_lead')}
      </Typography>

      <Box className={styles.tournamentSharePreview}>
        <Typography className={styles.tournamentSharePreviewLabel}>
          {t('event_hub.tournament_pick_semifinals')}
        </Typography>
        <Box className={styles.tournamentSharePreviewRow}>
          {semifinalists.map((team) => (
            <WcTeamLabel
              key={team.teamId}
              teamId={team.teamId}
              fallbackName={team.name}
              flagEmoji={team.flagEmoji}
              size={20}
            />
          ))}
        </Box>
        <Typography className={styles.tournamentSharePreviewLabel}>
          {t('event_hub.tournament_pick_champion')}
        </Typography>
        <WcTeamLabel
          teamId={champion.teamId}
          fallbackName={champion.name}
          flagEmoji={champion.flagEmoji}
          nameClassName={styles.tournamentShareChampionName}
        />
        <Typography className={styles.tournamentSharePreviewLabel}>
          {t('event_hub.tournament_pick_third')}
        </Typography>
        <WcTeamLabel
          teamId={thirdPlace.teamId}
          fallbackName={thirdPlace.name}
          flagEmoji={thirdPlace.flagEmoji}
        />
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
