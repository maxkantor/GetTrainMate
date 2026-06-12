import React, { useState } from 'react';
import { Box, Button, Collapse, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import {
  sportsEventLayerService,
  type CreatePredictionPayload,
  type EventMatch,
  type EventPrediction,
} from '@/services/sportsEventLayerService';
import { arePredictionsOpen } from '@/utils/eventMatchUtils';
import { PredictionShareCard } from '@/components/eventHub/PredictionShareCard';
import type { WinnerPick } from '@/types/worldCupHub';
import styles from '@/pages/WorldCupV2.module.css';

type Props = {
  eventId: string;
  match: EventMatch;
  isAuthenticated: boolean;
  onAuthRequired: () => void;
  compact?: boolean;
};

export const WcInlinePredict: React.FC<Props> = ({
  eventId, match, isAuthenticated, onAuthRequired, compact,
}) => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [scoreA, setScoreA] = useState('1');
  const [scoreB, setScoreB] = useState('0');
  const [winnerPick, setWinnerPick] = useState<WinnerPick | null>(null);
  const [submitted, setSubmitted] = useState<EventPrediction | null>(null);

  const open = arePredictionsOpen(match);

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

  const predictMutation = useMutation({
    mutationFn: (payload: CreatePredictionPayload) =>
      sportsEventLayerService.submitPrediction(eventId, payload),
    onSuccess: (pred) => {
      setSubmitted(pred);
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['my-prediction', eventId, match.matchId] });
      queryClient.invalidateQueries({ queryKey: ['prediction-breakdown', eventId, match.matchId] });
      queryClient.invalidateQueries({ queryKey: ['live-stats', eventId] });
      queryClient.invalidateQueries({ queryKey: ['community-pulse', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-picks', eventId] });
    },
  });

  const teamA = breakdown?.outcomes.find((o) => o.teamId === match.teamAId);
  const teamB = breakdown?.outcomes.find((o) => o.teamId === match.teamBId);
  const draw = breakdown?.outcomes.find((o) => o.outcomeType === 'draw');
  const total = breakdown?.totalPredictions ?? 0;

  const submit = (pick: WinnerPick, exact = false) => {
    if (!isAuthenticated) { onAuthRequired(); return; }
    if (!open) return;

    const payload: CreatePredictionPayload = {
      matchId: match.matchId,
      predictionType: exact ? 'exact_score' : pick === 'draw' ? 'draw' : 'winner',
    };
    if (payload.predictionType === 'winner') {
      payload.predictedWinnerTeamId = pick === 'teamA' ? match.teamAId : match.teamBId;
    }
    if (payload.predictionType === 'exact_score') {
      payload.predictedScoreA = parseInt(scoreA, 10);
      payload.predictedScoreB = parseInt(scoreB, 10);
      if (pick === 'teamA') payload.predictedWinnerTeamId = match.teamAId;
      else if (pick === 'teamB') payload.predictedWinnerTeamId = match.teamBId;
    }
    predictMutation.mutate(payload);
  };

  const handlePick = (pick: WinnerPick) => {
    setWinnerPick(pick);
    if (!showScore) submit(pick);
  };

  /** Reopen the pick UI prefilled from the saved prediction (change pick / add exact score). */
  const startEdit = (withScore: boolean) => {
    if (activePred) {
      const pick: WinnerPick | null =
        activePred.predictedWinnerTeamId === match.teamAId ? 'teamA'
        : activePred.predictedWinnerTeamId === match.teamBId ? 'teamB'
        : activePred.predictionType === 'draw' ? 'draw'
        : null;
      setWinnerPick(pick);
      if (hasExact) {
        setScoreA(String(activePred.predictedScoreA));
        setScoreB(String(activePred.predictedScoreB));
      }
      setShowScore(withScore || hasExact);
    }
    setEditing(true);
  };

  const pollBlock = total > 0 && (
    <>
      <Box className={styles.pollBar}>
        <Box className={styles.pollSegA} style={{ width: `${teamA?.percent ?? 0}%` }} />
        <Box className={styles.pollSegD} style={{ width: `${draw?.percent ?? 0}%` }} />
        <Box className={styles.pollSegB} style={{ width: `${teamB?.percent ?? 0}%` }} />
      </Box>
      <Typography className={styles.pollLabels}>
        {match.teamAName} {teamA?.percent ?? 0}% · Draw {draw?.percent ?? 0}% · {match.teamBName} {teamB?.percent ?? 0}%
      </Typography>
    </>
  );

  if (activePred && !editing) {
    const pickLabel =
      activePred.predictedWinnerTeamId === match.teamAId ? `${match.teamAFlag} ${match.teamAName}`
      : activePred.predictedWinnerTeamId === match.teamBId ? `${match.teamBFlag} ${match.teamBName}`
      : t('event_hub.pick_draw');

    return (
      <Box className={styles.predPanel}>
        <Box className={styles.predBadgeRow}>
          <span className={styles.predBadge}>✓ {t('event_hub.your_pick_in')}</span>
          {open && (
            <button type="button" className={styles.predActionBtn} onClick={() => startEdit(false)}>
              {t('event_hub.edit_pick')}
            </button>
          )}
        </Box>

        <Box className={styles.predPickLine}>
          <span className={styles.predPickLabel}>{pickLabel}</span>
          {hasExact ? (
            <span className={styles.predScoreChip}>
              {activePred.predictedScoreA} – {activePred.predictedScoreB}
            </span>
          ) : open ? (
            <button type="button" className={styles.predAddScoreBtn} onClick={() => startEdit(true)}>
              + {t('event_hub.add_exact_score')}
            </button>
          ) : null}
        </Box>

        {pollBlock}

        {!compact && (
          <Box sx={{ mt: 1.5 }}>
            <PredictionShareCard
              match={match}
              prediction={activePred}
              onShared={() => sportsEventLayerService.sharePrediction(eventId, match.matchId).catch(() => {})}
            />
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box>
      {total > 0 && (
        <Typography className={styles.pollKicker}>
          {t('event_hub.community_picks')}
        </Typography>
      )}
      {pollBlock}

      {open ? (
        <Box sx={{ mt: total > 0 ? 1 : 0 }}>
          <Box className={styles.pickRow}>
            <Button
              className={`${styles.pickBtn} ${winnerPick === 'teamA' ? styles.pickBtnActive : ''}`}
              onClick={() => handlePick('teamA')}
              disabled={predictMutation.isPending}
            >
              <span className={styles.pickBtnFlag}>{match.teamAFlag}</span>
              <span className={styles.pickBtnName}>{match.teamAName}</span>
            </Button>
            <Button
              className={`${styles.pickBtn} ${winnerPick === 'draw' ? styles.pickBtnActive : ''}`}
              onClick={() => handlePick('draw')}
              disabled={predictMutation.isPending}
            >
              <span className={styles.pickBtnFlag}>🤝</span>
              <span className={styles.pickBtnName}>{t('event_hub.pick_draw')}</span>
            </Button>
            <Button
              className={`${styles.pickBtn} ${winnerPick === 'teamB' ? styles.pickBtnActive : ''}`}
              onClick={() => handlePick('teamB')}
              disabled={predictMutation.isPending}
            >
              <span className={styles.pickBtnFlag}>{match.teamBFlag}</span>
              <span className={styles.pickBtnName}>{match.teamBName}</span>
            </Button>
          </Box>

          <Box className={styles.predFootRow}>
            <button type="button" className={styles.predActionBtn} onClick={() => setShowScore((v) => !v)}>
              {showScore ? t('event_hub.hide_score') : `+ ${t('event_hub.add_exact_score')}`}
            </button>
            {editing && (
              <button
                type="button"
                className={styles.predActionBtnMuted}
                onClick={() => { setEditing(false); setShowScore(false); }}
              >
                {t('common.cancel')}
              </button>
            )}
          </Box>

          <Collapse in={showScore}>
            <Box className={styles.scorePanel}>
              <Box className={styles.scoreRow}>
                <span className={styles.scoreFlag} aria-hidden>{match.teamAFlag}</span>
                <input
                  className={styles.scoreInput}
                  type="number"
                  min={0}
                  max={20}
                  value={scoreA}
                  onChange={(e) => setScoreA(e.target.value)}
                  aria-label={`${match.teamAName} score`}
                />
                <span className={styles.scoreDash}>–</span>
                <input
                  className={styles.scoreInput}
                  type="number"
                  min={0}
                  max={20}
                  value={scoreB}
                  onChange={(e) => setScoreB(e.target.value)}
                  aria-label={`${match.teamBName} score`}
                />
                <span className={styles.scoreFlag} aria-hidden>{match.teamBFlag}</span>
              </Box>
              {!winnerPick && (
                <Typography className={styles.scoreHint}>{t('event_hub.pick_first_hint')}</Typography>
              )}
              <Button
                size="small"
                variant="contained"
                className={styles.ctaPrimary}
                fullWidth
                disabled={!winnerPick || predictMutation.isPending}
                onClick={() => winnerPick && submit(winnerPick, true)}
              >
                {t('event_hub.save_prediction')}
              </Button>
            </Box>
          </Collapse>
        </Box>
      ) : (
        <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>
          {t('event_hub.predictions_closed')}
        </Typography>
      )}
    </Box>
  );
};
