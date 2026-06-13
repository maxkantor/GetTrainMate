import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Box, Button, Snackbar, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import { useMe } from '@/hooks/useMe';
import { useWcDisplay } from '@/hooks/useWcDisplay';
import { formatI18n } from '@/i18n';
import type { EventMatch, EventPrediction } from '@/services/sportsEventLayerService';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import {
  canvasToPngBlob,
  renderTodayPicksCanvas,
  type TodayPickRow,
} from '@/utils/todayPredictionsShareCanvas';
import styles from '@/pages/WorldCupV2.module.css';

type Props = {
  eventId: string;
  todayMatches: EventMatch[];
  isAuthenticated: boolean;
  onAuthRequired: () => void;
};

function canShareWithFiles(file: File): boolean {
  if (!navigator.share || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

function buildPickRow(
  match: EventMatch,
  prediction: EventPrediction,
  teamName: (id: string, name?: string) => string,
  t: (key: string) => string,
): TodayPickRow {
  const teamADisplay = teamName(match.teamAId, match.teamAName);
  const teamBDisplay = teamName(match.teamBId, match.teamBName);
  let pickLabel: string;
  let scoreLine: string | undefined;

  if (prediction.predictionType === 'draw') {
    pickLabel = t('event_hub.pick_draw');
  } else if (prediction.predictionType === 'exact_score' && prediction.predictedScoreA != null) {
    pickLabel = `${prediction.predictedScoreA}–${prediction.predictedScoreB}`;
    scoreLine = `${teamADisplay} ${prediction.predictedScoreA}–${prediction.predictedScoreB} ${teamBDisplay}`;
  } else {
    pickLabel = prediction.predictedWinnerTeamId === match.teamAId ? teamADisplay : teamBDisplay;
  }

  return {
    teamAFlag: match.teamAFlag ?? '',
    teamAName: teamADisplay,
    teamBFlag: match.teamBFlag ?? '',
    teamBName: teamBDisplay,
    pickLabel,
    scoreLine,
  };
}

export const TodayPredictionsSharePanel: React.FC<Props> = ({
  eventId,
  todayMatches,
  isAuthenticated,
  onAuthRequired,
}) => {
  const { t, locale } = useI18n();
  const { me } = useMe();
  const { teamName } = useWcDisplay();
  const [notice, setNotice] = useState<string | null>(null);

  const { data: summary } = useQuery({
    queryKey: ['my-picks', eventId],
    queryFn: () => sportsEventLayerService.getMyPicksSummary(eventId),
    enabled: isAuthenticated,
  });

  const todayIds = useMemo(() => new Set(todayMatches.map((m) => m.matchId)), [todayMatches]);

  const todayPicks = useMemo(() => {
    if (!summary?.predictions.length) return [];
    return summary.predictions
      .filter((p) => todayIds.has(p.matchId))
      .map((pred) => {
        const match = todayMatches.find((m) => m.matchId === pred.matchId);
        if (!match) return null;
        return { match, pred, row: buildPickRow(match, pred, teamName, t) };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
  }, [summary, todayIds, todayMatches, teamName, t]);

  const fanName = me?.profile?.name?.trim()
    || summary?.predictions[0]?.userDisplayName?.trim()
    || t('event_hub.share_fan_fallback');

  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/world-cup` : '';

  const buildCanvas = useCallback(() => renderTodayPicksCanvas(
    fanName,
    dateLabel,
    todayPicks.map((p) => p.row),
    {
      eventTitle: t('event_hub.share_today_event_title'),
      subtitle: t('event_hub.share_today_subtitle'),
      picksHeading: t('event_hub.share_today_picks_heading'),
      footer: t('event_hub.share_card_footer'),
    },
  ), [fanName, dateLabel, todayPicks, t]);

  const buildWhatsAppText = useCallback(() => {
    const header = formatI18n(t('event_hub.share_today_whatsapp_header'), { name: fanName });
    const lines = todayPicks.map(({ row }) => {
      const score = row.scoreLine ? ` (${row.scoreLine})` : '';
      return `• ${row.teamAFlag} ${row.teamAName} vs ${row.teamBName} ${row.teamBFlag} → ${row.pickLabel}${score}`;
    });
    return [header, '', ...lines, '', t('event_hub.share_card_footer'), shareUrl].join('\n');
  }, [fanName, todayPicks, t, shareUrl]);

  const handleDownload = useCallback(async () => {
    const canvas = buildCanvas();
    const link = document.createElement('a');
    link.download = `world-cup-picks-${fanName.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setNotice(t('event_hub.image_downloaded'));
    for (const { match } of todayPicks) {
      sportsEventLayerService.sharePrediction(eventId, match.matchId).catch(() => {});
    }
  }, [buildCanvas, fanName, todayPicks, eventId, t]);

  const handleWhatsApp = useCallback(async () => {
    const text = buildWhatsAppText();
    try {
      const blob = await canvasToPngBlob(buildCanvas());
      if (blob) {
        const file = new File([blob], 'world-cup-today-picks.png', { type: 'image/png' });
        if (canShareWithFiles(file)) {
          await navigator.share({
            title: formatI18n(t('event_hub.share_today_sheet_title'), { name: fanName }),
            text,
            files: [file],
          });
          for (const { match } of todayPicks) {
            sportsEventLayerService.sharePrediction(eventId, match.matchId).catch(() => {});
          }
          return;
        }
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    setNotice(t('event_hub.share_today_whatsapp_hint'));
    for (const { match } of todayPicks) {
      sportsEventLayerService.sharePrediction(eventId, match.matchId).catch(() => {});
    }
  }, [buildCanvas, buildWhatsAppText, fanName, todayPicks, eventId, t]);

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

  if (todayPicks.length === 0) return null;

  return (
    <Box className={styles.todaySharePanel}>
      <Box className={styles.todayShareHeader}>
        <Typography className={styles.todayShareTitle}>
          {formatI18n(t('event_hub.share_today_title_named'), { name: fanName })}
        </Typography>
        <Typography className={styles.todayShareLead}>
          {formatI18n(t('event_hub.share_today_lead'), { count: todayPicks.length })}
        </Typography>
      </Box>

      <Box className={styles.todaySharePreview}>
        {todayPicks.map(({ match, row }) => (
          <Box key={match.matchId} className={styles.todaySharePickRow}>
            <Typography className={styles.todayShareMatchup}>
              {row.teamAFlag} {row.teamAName} {t('event_hub.vs')} {row.teamBName} {row.teamBFlag}
            </Typography>
            <Typography className={styles.todaySharePick}>
              → {row.pickLabel}
            </Typography>
          </Box>
        ))}
      </Box>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap className={styles.todayShareActions}>
        <Button variant="contained" className={styles.ctaPrimary} onClick={handleWhatsApp}>
          {t('event_hub.share_today_whatsapp')}
        </Button>
        <Button variant="outlined" className={styles.ctaSecondary} onClick={handleDownload}>
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
