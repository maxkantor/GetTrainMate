import React, { useEffect, useState } from 'react';
import { Box, Button, Collapse, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import { useWcDisplay } from '@/hooks/useWcDisplay';
import { formatI18n } from '@/i18n';
import {
  sportsEventLayerService,
  type CreatePredictionPayload,
  type EventHubSettings,
  type EventMatch,
  type EventPrediction,
  type EventHubSnapshot,
} from '@/services/sportsEventLayerService';
import { WcTeamLabel } from '@/components/worldCupHub/WcTeamLabel';
import { arePredictionsOpen, parseKickoffUtc } from '@/utils/eventMatchUtils';
import { PredictionShareCard } from '@/components/eventHub/PredictionShareCard';
import { WcQuickInsight } from './WcQuickInsight';
import { WcFanPickFeed } from './WcFanPickFeed';
import type { WinnerPick } from '@/types/worldCupHub';
import styles from '@/pages/WorldCupV2.module.css';

type Props = {
  eventId: string;
  match: EventMatch;
  hub: EventHubSnapshot;
  isAuthenticated: boolean;
  onAuthRequired: () => void;
  compact?: boolean;
};

function parseScore(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(n) || n < 0 || n > 20) return null;
  return n;
}

export const WcInlinePredict: React.FC<Props> = ({
  eventId, match, hub, isAuthenticated, onAuthRequired, compact,
}) => {
  const settings: EventHubSettings = hub.settings;
  const { t } = useI18n();
  const { teamName } = useWcDisplay();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [showFanPicks, setShowFanPicks] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState<EventPrediction | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [, setLockTick] = useState(0);

  const predictionsEnabled = settings.predictionsEnabled !== false;
  const sharingEnabled = settings.sharingEnabled !== false;
  const intelEnabled = settings.matchIntelligenceEnabled !== false;
  const fanFeedEnabled = settings.fanFeedEnabled !== false;
  const exactEnabled = settings.exactScoreEnabled !== false;

  const open = predictionsEnabled && arePredictionsOpen(match);
  const kickoff = parseKickoffUtc(match.matchDate, match.matchTime);

  useEffect(() => {
    if (kickoff == null) return;
    const delay = kickoff - Date.now();
    if (delay <= 0) return;
    const id = window.setTimeout(() => setLockTick((n) => n + 1), Math.min(delay + 1000, 2 ** 31 - 1));
    return () => window.clearTimeout(id);
  }, [kickoff]);

  const { data: breakdown } = useQuery({
    queryKey: ['prediction-breakdown', eventId, match.matchId],
    queryFn: () => sportsEventLayerService.getPredictionBreakdown(eventId, match.matchId),
    staleTime: 30_000,
  });

  const { data: existing } = useQuery({
    queryKey: ['my-prediction', eventId, match.matchId],
    queryFn: () => sportsEventLayerService.getMyPrediction(eventId, match.matchId),
    enabled: isAuthenticated,
  });

  const activePred = submitted ?? existing ?? null;
  const hasExact = activePred?.predictedScoreA != null && activePred?.predictedScoreB != null;
  const total = breakdown?.totalPredictions ?? 0;

  const scoreNumA = parseScore(scoreA);
  const scoreNumB = parseScore(scoreB);
  const scoresComplete = scoreNumA != null && scoreNumB != null;
  const derivedPick: WinnerPick | null = scoresComplete
    ? (scoreNumA === scoreNumB ? 'draw' : scoreNumA > scoreNumB ? 'teamA' : 'teamB')
    : null;

  const predictMutation = useMutation({
    mutationFn: (payload: CreatePredictionPayload) =>
      sportsEventLayerService.submitPrediction(eventId, payload),
    onSuccess: (pred) => {
      setSubmitted(pred);
      setEditing(false);
      setSaveError(false);
      queryClient.invalidateQueries({ queryKey: ['my-prediction', eventId, match.matchId] });
      queryClient.invalidateQueries({ queryKey: ['prediction-breakdown', eventId, match.matchId] });
      queryClient.invalidateQueries({ queryKey: ['fan-picks-feed', eventId] });
      queryClient.invalidateQueries({ queryKey: ['live-stats', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-picks', eventId] });
      queryClient.invalidateQueries({ queryKey: ['today-share-picks', eventId] });
    },
    onError: () => {
      setSaveError(true);
      queryClient.invalidateQueries({ queryKey: ['event-hub', eventId] });
    },
  });

  const submitPick = () => {
    if (!derivedPick || !isAuthenticated) {
      if (!isAuthenticated) onAuthRequired();
      return;
    }
    if (!open) return;

    const payload: CreatePredictionPayload = {
      matchId: match.matchId,
      predictionType: exactEnabled ? 'exact_score' : derivedPick === 'draw' ? 'draw' : 'winner',
      reason: reason.trim() || undefined,
    };
    if (payload.predictionType === 'winner') {
      payload.predictedWinnerTeamId = derivedPick === 'teamA' ? match.teamAId : match.teamBId;
    } else if (payload.predictionType === 'draw') {
      /* draw */
    } else {
      payload.predictedScoreA = scoreNumA!;
      payload.predictedScoreB = scoreNumB!;
      if (derivedPick === 'teamA') payload.predictedWinnerTeamId = match.teamAId;
      else if (derivedPick === 'teamB') payload.predictedWinnerTeamId = match.teamBId;
    }
    predictMutation.mutate(payload);
  };

  const startEdit = () => {
    if (activePred) {
      if (hasExact) {
        setScoreA(String(activePred.predictedScoreA));
        setScoreB(String(activePred.predictedScoreB));
      } else {
        setScoreA('');
        setScoreB('');
      }
      setReason(activePred.reason ?? '');
    }
    setEditing(true);
  };

  const communityBlock = total > 0 ? (
    <Box className={styles.communityBlock}>
      <Typography className={styles.communityCount}>
        {formatI18n(t('event_hub.community_activity'), { count: total })}
      </Typography>
    </Box>
  ) : null;

  const fanPicksSection = fanFeedEnabled && (
    <>
      <button type="button" className={styles.viewFanPicksBtn} onClick={() => setShowFanPicks((v) => !v)}>
        {showFanPicks ? t('event_hub.hide_fan_picks') : t('event_hub.view_fan_picks')}
      </button>
      <Collapse in={showFanPicks}>
        <WcFanPickFeed
          eventId={eventId}
          hub={hub}
          matchId={match.matchId}
          isAuthenticated={isAuthenticated}
          onAuthRequired={onAuthRequired}
          compact
        />
      </Collapse>
    </>
  );

  const quickInsightSection = intelEnabled && !compact && (
    <WcQuickInsight eventId={eventId} match={match} enabled />
  );

  if (!predictionsEnabled) {
    return <Typography className={styles.lockedReason}>{t('event_hub.predictions_coming_soon')}</Typography>;
  }

  if (activePred && !editing) {
    return (
      <Box className={styles.predPanel}>
        <Box className={styles.predBadgeRow}>
          <span className={styles.predBadge}>✓ {t('event_hub.your_pick_in')}</span>
          {open && (
            <button type="button" className={styles.predActionBtn} onClick={startEdit}>
              {t('event_hub.change_pick')}
            </button>
          )}
        </Box>

        <Box className={styles.predPickLine}>
          {hasExact ? (
            <>
              <WcTeamLabel teamId={match.teamAId} fallbackName={match.teamAName} flagEmoji={match.teamAFlag} size={22} />
              <span className={styles.predScoreChip}>{activePred.predictedScoreA} – {activePred.predictedScoreB}</span>
              <WcTeamLabel teamId={match.teamBId} fallbackName={match.teamBName} flagEmoji={match.teamBFlag} size={22} />
            </>
          ) : activePred.predictedWinnerTeamId === match.teamAId ? (
            <WcTeamLabel teamId={match.teamAId} fallbackName={match.teamAName} flagEmoji={match.teamAFlag} size={22} />
          ) : activePred.predictedWinnerTeamId === match.teamBId ? (
            <WcTeamLabel teamId={match.teamBId} fallbackName={match.teamBName} flagEmoji={match.teamBFlag} size={22} />
          ) : (
            <span className={styles.predPickLabel}>🤝 {t('event_hub.pick_draw')}</span>
          )}
        </Box>

        {activePred.reason && (
          <Typography className={styles.fanPickReason}>&ldquo;{activePred.reason}&rdquo;</Typography>
        )}

        {communityBlock}
        {fanPicksSection}

        {!compact && sharingEnabled && (
          <>
            <button type="button" className={styles.viewFanPicksBtn} onClick={() => setShowShare((v) => !v)}>
              {showShare ? t('event_hub.hide_share_card') : t('event_hub.share_your_card')}
            </button>
            <Collapse in={showShare}>
              <Box sx={{ mt: 1 }}>
                <PredictionShareCard
                  match={match}
                  prediction={activePred}
                  onShared={() => sportsEventLayerService.sharePrediction(eventId, match.matchId).catch(() => {})}
                />
              </Box>
            </Collapse>
          </>
        )}

        {quickInsightSection}
      </Box>
    );
  }

  return (
    <Box className={styles.predFlow}>
      {open ? (
        <>
          <Typography className={styles.makePickTitle}>{t('event_hub.make_your_pick')}</Typography>
          <Typography className={styles.freeBadge}>{t('event_hub.free_fan_predictions')}</Typography>

          {saveError && (
            <Typography className={styles.saveError}>{t('event_hub.predict_save_failed')}</Typography>
          )}

          <Box className={styles.scorePanelClean}>
            <Box className={styles.scoreRowClean}>
              <WcTeamLabel teamId={match.teamAId} fallbackName={match.teamAName} flagEmoji={match.teamAFlag} size={20} nameClassName={styles.scoreTeamName} />
              <input
                className={styles.scoreInputEmpty}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="–"
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value.replace(/\D/g, '').slice(0, 2))}
                aria-label={`${teamName(match.teamAId, match.teamAName)} score`}
              />
              <span className={styles.scoreColon}>:</span>
              <input
                className={styles.scoreInputEmpty}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="–"
                value={scoreB}
                onChange={(e) => setScoreB(e.target.value.replace(/\D/g, '').slice(0, 2))}
                aria-label={`${teamName(match.teamBId, match.teamBName)} score`}
              />
              <WcTeamLabel teamId={match.teamBId} fallbackName={match.teamBName} flagEmoji={match.teamBFlag} size={20} nameClassName={styles.scoreTeamName} />
            </Box>

            {scoresComplete && derivedPick && (
              <Typography className={styles.scoreSummaryClean}>
                {derivedPick === 'draw'
                  ? `${t('event_hub.pick_draw')} · ${scoreNumA}–${scoreNumB}`
                  : `${teamName(derivedPick === 'teamA' ? match.teamAId : match.teamBId, derivedPick === 'teamA' ? match.teamAName : match.teamBName)} · ${scoreNumA}–${scoreNumB}`}
              </Typography>
            )}
          </Box>

          <TextField
            fullWidth
            size="small"
            multiline
            minRows={2}
            placeholder={t('event_hub.why_optional')}
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 280))}
            className={styles.reasonField}
          />

          <Button
            variant="contained"
            className={styles.ctaPrimary}
            fullWidth
            disabled={!scoresComplete || predictMutation.isPending}
            onClick={submitPick}
          >
            {t('event_hub.save_prediction')}
          </Button>

          {editing && (
            <button type="button" className={styles.predActionBtnMuted} onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </button>
          )}

          {communityBlock}
          {fanPicksSection}
        </>
      ) : (
        <Typography className={styles.lockedReason}>
          🔒{' '}
          {match.status === 'Live'
            ? t('event_hub.predictions_locked_live')
            : match.status === 'Completed'
              ? t('event_hub.predictions_locked_done')
              : kickoff != null && kickoff <= Date.now()
                ? t('event_hub.predictions_locked_started')
                : t('event_hub.predictions_closed')}
        </Typography>
      )}

      {quickInsightSection}
    </Box>
  );
};
