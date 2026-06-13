import React, { useEffect, useState } from 'react';
import { Box, Button, Collapse, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import { useWcDisplay } from '@/hooks/useWcDisplay';
import { formatI18n } from '@/i18n';
import {
  sportsEventLayerService,
  type CreatePredictionPayload,
  type EventMatch,
  type EventPrediction,
} from '@/services/sportsEventLayerService';
import { CountryFlag } from '@/components/worldCupHub/CountryFlag';
import { arePredictionsOpen, parseKickoffUtc } from '@/utils/eventMatchUtils';
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
  const { teamName } = useWcDisplay();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [scoreA, setScoreA] = useState('1');
  const [scoreB, setScoreB] = useState('0');
  const [winnerPick, setWinnerPick] = useState<WinnerPick | null>(null);
  const [submitted, setSubmitted] = useState<EventPrediction | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [, setLockTick] = useState(0);

  const open = arePredictionsOpen(match);

  // Flip the card to "closed" the moment kickoff passes, even without a data refresh.
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

  const predictMutation = useMutation({
    mutationFn: (payload: CreatePredictionPayload) =>
      sportsEventLayerService.submitPrediction(eventId, payload),
    onSuccess: (pred) => {
      setSubmitted(pred);
      setEditing(false);
      setSaveError(false);
      queryClient.invalidateQueries({ queryKey: ['my-prediction', eventId, match.matchId] });
      queryClient.invalidateQueries({ queryKey: ['prediction-breakdown', eventId, match.matchId] });
      queryClient.invalidateQueries({ queryKey: ['live-stats', eventId] });
      queryClient.invalidateQueries({ queryKey: ['community-pulse', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-picks', eventId] });
    },
    onError: () => {
      // Server rejects picks for live/finished/locked matches — refresh so the card reflects it.
      setSaveError(true);
      queryClient.invalidateQueries({ queryKey: ['event-hub', eventId] });
    },
  });

  const teamA = breakdown?.outcomes.find((o) => o.teamId === match.teamAId);
  const teamB = breakdown?.outcomes.find((o) => o.teamId === match.teamBId);
  const draw = breakdown?.outcomes.find((o) => o.outcomeType === 'draw');
  const total = breakdown?.totalPredictions ?? 0;

  const scoreNumA = parseInt(scoreA, 10);
  const scoreNumB = parseInt(scoreB, 10);
  const scoresValid = Number.isInteger(scoreNumA) && Number.isInteger(scoreNumB)
    && scoreNumA >= 0 && scoreNumB >= 0;
  /** With the score panel open, the score itself decides the outcome — no separate tap required. */
  const derivedPick: WinnerPick | null = scoresValid
    ? (scoreNumA === scoreNumB ? 'draw' : scoreNumA > scoreNumB ? 'teamA' : 'teamB')
    : null;
  const activeChoice = showScore ? derivedPick : winnerPick;

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
      payload.predictedScoreA = scoreNumA;
      payload.predictedScoreB = scoreNumB;
      if (pick === 'teamA') payload.predictedWinnerTeamId = match.teamAId;
      else if (pick === 'teamB') payload.predictedWinnerTeamId = match.teamBId;
    }
    predictMutation.mutate(payload);
  };

  const handlePick = (pick: WinnerPick) => {
    setWinnerPick(pick);
    if (!showScore) {
      submit(pick);
      return;
    }
    // Score panel open: tapping a side flips the score to match the chosen outcome.
    if (!scoresValid) return;
    if (pick === 'draw' && scoreNumA !== scoreNumB) {
      setScoreB(scoreA);
    } else if (pick === 'teamA' && scoreNumA < scoreNumB) {
      setScoreA(scoreB);
      setScoreB(scoreA);
    } else if (pick === 'teamB' && scoreNumA > scoreNumB) {
      setScoreA(scoreB);
      setScoreB(scoreA);
    }
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
        {formatI18n(t('event_hub.community_picks_line'), {
          teamA: teamName(match.teamAId, match.teamAName),
          pctA: teamA?.percent ?? 0,
          draw: t('event_hub.pick_draw'),
          pctDraw: draw?.percent ?? 0,
          teamB: teamName(match.teamBId, match.teamBName),
          pctB: teamB?.percent ?? 0,
        })}
      </Typography>
    </>
  );

  if (activePred && !editing) {
    const pickLabel =
      activePred.predictedWinnerTeamId === match.teamAId ? `${match.teamAFlag} ${teamName(match.teamAId, match.teamAName)}`
      : activePred.predictedWinnerTeamId === match.teamBId ? `${match.teamBFlag} ${teamName(match.teamBId, match.teamBName)}`
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
          {saveError && (
            <Typography className={styles.saveError}>{t('event_hub.predict_save_failed')}</Typography>
          )}
          <Box className={styles.pickRow}>
            <Button
              className={`${styles.pickBtn} ${activeChoice === 'teamA' ? styles.pickBtnActive : ''}`}
              onClick={() => handlePick('teamA')}
              disabled={predictMutation.isPending}
            >
              <CountryFlag teamId={match.teamAId} flagEmoji={match.teamAFlag} size={22} className={styles.pickBtnFlag} />
              <span className={styles.pickBtnName}>{teamName(match.teamAId, match.teamAName)}</span>
            </Button>
            <Button
              className={`${styles.pickBtn} ${activeChoice === 'draw' ? styles.pickBtnActive : ''}`}
              onClick={() => handlePick('draw')}
              disabled={predictMutation.isPending}
            >
              <span className={styles.pickBtnFlag}>🤝</span>
              <span className={styles.pickBtnName}>{t('event_hub.pick_draw')}</span>
            </Button>
            <Button
              className={`${styles.pickBtn} ${activeChoice === 'teamB' ? styles.pickBtnActive : ''}`}
              onClick={() => handlePick('teamB')}
              disabled={predictMutation.isPending}
            >
              <CountryFlag teamId={match.teamBId} flagEmoji={match.teamBFlag} size={22} className={styles.pickBtnFlag} />
              <span className={styles.pickBtnName}>{teamName(match.teamBId, match.teamBName)}</span>
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
                <CountryFlag teamId={match.teamAId} flagEmoji={match.teamAFlag} size={24} className={styles.scoreFlag} />
                <input
                  className={styles.scoreInput}
                  type="number"
                  min={0}
                  max={20}
                  value={scoreA}
                  onChange={(e) => setScoreA(e.target.value)}
                  aria-label={`${teamName(match.teamAId, match.teamAName)} score`}
                />
                <span className={styles.scoreDash}>–</span>
                <input
                  className={styles.scoreInput}
                  type="number"
                  min={0}
                  max={20}
                  value={scoreB}
                  onChange={(e) => setScoreB(e.target.value)}
                  aria-label={`${teamName(match.teamBId, match.teamBName)} score`}
                />
                <CountryFlag teamId={match.teamBId} flagEmoji={match.teamBFlag} size={24} className={styles.scoreFlag} />
              </Box>
              {derivedPick && (
                <Typography className={styles.scoreSummary}>
                  {derivedPick === 'draw'
                    ? `🤝 ${t('event_hub.pick_draw')} · ${scoreNumA}–${scoreNumB}`
                    : derivedPick === 'teamA'
                      ? `${match.teamAFlag} ${teamName(match.teamAId, match.teamAName)} · ${scoreNumA}–${scoreNumB}`
                      : `${match.teamBFlag} ${teamName(match.teamBId, match.teamBName)} · ${scoreNumA}–${scoreNumB}`}
                </Typography>
              )}
              <Button
                size="small"
                variant="contained"
                className={styles.ctaPrimary}
                fullWidth
                disabled={!derivedPick || predictMutation.isPending}
                onClick={() => derivedPick && submit(derivedPick, true)}
              >
                {t('event_hub.save_prediction')}
              </Button>
            </Box>
          </Collapse>
        </Box>
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
    </Box>
  );
};
