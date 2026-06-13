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
} from '@/services/sportsEventLayerService';
import { CountryFlag } from '@/components/worldCupHub/CountryFlag';
import { arePredictionsOpen, parseKickoffUtc } from '@/utils/eventMatchUtils';
import { PredictionShareCard } from '@/components/eventHub/PredictionShareCard';
import { WcMatchIntelligence } from './WcMatchIntelligence';
import { WcFanPickFeed } from './WcFanPickFeed';
import type { WinnerPick } from '@/types/worldCupHub';
import type { EventHubSnapshot } from '@/services/sportsEventLayerService';
import styles from '@/pages/WorldCupV2.module.css';

type Props = {
  eventId: string;
  match: EventMatch;
  hub: EventHubSnapshot;
  isAuthenticated: boolean;
  onAuthRequired: () => void;
  compact?: boolean;
};

export const WcInlinePredict: React.FC<Props> = ({
  eventId, match, hub, isAuthenticated, onAuthRequired, compact,
}) => {
  const settings: EventHubSettings = hub.settings;
  const { t } = useI18n();
  const { teamName } = useWcDisplay();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [showFanPicks, setShowFanPicks] = useState(false);
  const [scoreA, setScoreA] = useState('1');
  const [scoreB, setScoreB] = useState('0');
  const [reason, setReason] = useState('');
  const [winnerPick, setWinnerPick] = useState<WinnerPick | null>(null);
  const [submitted, setSubmitted] = useState<EventPrediction | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [, setLockTick] = useState(0);

  const predictionsEnabled = settings.predictionsEnabled !== false;
  const sharingEnabled = settings.sharingEnabled !== false;
  const intelEnabled = settings.matchIntelligenceEnabled !== false;
  const fanFeedEnabled = settings.fanFeedEnabled !== false;
  const exactEnabled = settings.exactScoreEnabled !== false;
  const winnerEnabled = settings.winnerPickEnabled !== false;
  const drawEnabled = settings.drawPickEnabled !== false;

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
      queryClient.invalidateQueries({ queryKey: ['community-pulse', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-picks', eventId] });
    },
    onError: () => {
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
  const derivedPick: WinnerPick | null = scoresValid
    ? (scoreNumA === scoreNumB ? 'draw' : scoreNumA > scoreNumB ? 'teamA' : 'teamB')
    : null;

  const submitPick = (pick: WinnerPick, exact: boolean, reasonText?: string) => {
    if (!isAuthenticated) { onAuthRequired(); return; }
    if (!open) return;

    const payload: CreatePredictionPayload = {
      matchId: match.matchId,
      predictionType: exact ? 'exact_score' : pick === 'draw' ? 'draw' : 'winner',
      reason: reasonText?.trim() || undefined,
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

  const handleSubmitScore = () => {
    if (!derivedPick) return;
    if (derivedPick === 'draw' && !drawEnabled) return;
    if (derivedPick !== 'draw' && !winnerEnabled) return;
    submitPick(derivedPick, exactEnabled, reason);
  };

  const handleQuickPick = (pick: WinnerPick) => {
    setWinnerPick(pick);
    if (pick === 'draw') {
      setScoreA('0');
      setScoreB('0');
    } else if (pick === 'teamA') {
      setScoreA('2');
      setScoreB('1');
    } else {
      setScoreA('1');
      setScoreB('2');
    }
    if (!exactEnabled) submitPick(pick, false, reason);
  };

  const startEdit = () => {
    if (activePred) {
      if (hasExact) {
        setScoreA(String(activePred.predictedScoreA));
        setScoreB(String(activePred.predictedScoreB));
      }
      setReason(activePred.reason ?? '');
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

  if (!predictionsEnabled) {
    return (
      <Typography className={styles.lockedReason}>{t('event_hub.predictions_coming_soon')}</Typography>
    );
  }

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
            <button type="button" className={styles.predActionBtn} onClick={startEdit}>
              {t('event_hub.change_pick')}
            </button>
          )}
        </Box>

        <Box className={styles.predPickLine}>
          <span className={styles.predPickLabel}>{pickLabel}</span>
          {hasExact && (
            <span className={styles.predScoreChip}>
              {activePred.predictedScoreA} – {activePred.predictedScoreB}
            </span>
          )}
        </Box>

        {activePred.reason && (
          <Typography className={styles.fanPickReason}>&ldquo;{activePred.reason}&rdquo;</Typography>
        )}

        {pollBlock}

        {!compact && sharingEnabled && (
          <Box sx={{ mt: 1.5 }}>
            <PredictionShareCard
              match={match}
              prediction={activePred}
              onShared={() => sportsEventLayerService.sharePrediction(eventId, match.matchId).catch(() => {})}
            />
          </Box>
        )}

        {fanFeedEnabled && (
          <button type="button" className={styles.predActionBtn} onClick={() => setShowFanPicks((v) => !v)}>
            {showFanPicks ? t('event_hub.hide_fan_picks') : t('event_hub.view_fan_picks')}
          </button>
        )}

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
      </Box>
    );
  }

  return (
    <Box>
      <WcMatchIntelligence eventId={eventId} match={match} enabled={intelEnabled && !compact} />

      {total > 0 && (
        <Typography className={styles.pollKicker}>{t('event_hub.community_split')}</Typography>
      )}
      {pollBlock}

      {open ? (
        <Box sx={{ mt: total > 0 ? 1 : 0 }}>
          <Typography className={styles.makePickTitle}>{t('event_hub.make_your_pick')}</Typography>
          <Typography className={styles.freeBadge}>{t('event_hub.free_fan_predictions')}</Typography>

          {saveError && (
            <Typography className={styles.saveError}>{t('event_hub.predict_save_failed')}</Typography>
          )}

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
            sx={{ mt: 1.25 }}
          />

          <Button
            size="small"
            variant="contained"
            className={styles.ctaPrimary}
            fullWidth
            disabled={!derivedPick || predictMutation.isPending}
            onClick={handleSubmitScore}
            sx={{ mt: 1.25 }}
          >
            {t('event_hub.save_prediction')}
          </Button>

          {(winnerEnabled || drawEnabled) && (
            <Box className={styles.pickRow} sx={{ mt: 1.25 }}>
              {winnerEnabled && (
                <Button
                  className={`${styles.pickBtn} ${winnerPick === 'teamA' ? styles.pickBtnActive : ''}`}
                  onClick={() => handleQuickPick('teamA')}
                  disabled={predictMutation.isPending}
                >
                  <CountryFlag teamId={match.teamAId} flagEmoji={match.teamAFlag} size={20} className={styles.pickBtnFlag} />
                  <span className={styles.pickBtnName}>{teamName(match.teamAId, match.teamAName)}</span>
                </Button>
              )}
              {drawEnabled && (
                <Button
                  className={`${styles.pickBtn} ${winnerPick === 'draw' ? styles.pickBtnActive : ''}`}
                  onClick={() => handleQuickPick('draw')}
                  disabled={predictMutation.isPending}
                >
                  <span className={styles.pickBtnFlag}>🤝</span>
                  <span className={styles.pickBtnName}>{t('event_hub.pick_draw')}</span>
                </Button>
              )}
              {winnerEnabled && (
                <Button
                  className={`${styles.pickBtn} ${winnerPick === 'teamB' ? styles.pickBtnActive : ''}`}
                  onClick={() => handleQuickPick('teamB')}
                  disabled={predictMutation.isPending}
                >
                  <CountryFlag teamId={match.teamBId} flagEmoji={match.teamBFlag} size={20} className={styles.pickBtnFlag} />
                  <span className={styles.pickBtnName}>{teamName(match.teamBId, match.teamBName)}</span>
                </Button>
              )}
            </Box>
          )}

          {editing && (
            <button type="button" className={styles.predActionBtnMuted} onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </button>
          )}
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
