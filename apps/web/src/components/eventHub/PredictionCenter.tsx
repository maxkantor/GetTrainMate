import React from 'react';
import { Box, Button, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import { PredictionShareCard } from '@/components/eventHub/PredictionShareCard';
import { ComingSoon } from '@/components/eventHub/ComingSoon';
import {
  sportsEventLayerService,
  type EventMatch,
  type EventPrediction,
} from '@/services/sportsEventLayerService';
import styles from '@/pages/EventHub.module.css';

type Props = {
  eventId: string;
  matches: EventMatch[];
  enabled: boolean;
  exactEnabled: boolean;
  winnerEnabled: boolean;
  drawEnabled: boolean;
  sharingEnabled: boolean;
  selectedMatchId: string;
  onSelectMatch: (id: string) => void;
  predictionType: 'winner' | 'draw' | 'exact_score';
  onPredictionType: (t: 'winner' | 'draw' | 'exact_score') => void;
  winnerTeamId: string;
  onWinnerTeamId: (id: string) => void;
  scoreA: string;
  scoreB: string;
  onScoreA: (v: string) => void;
  onScoreB: (v: string) => void;
  reason: string;
  onReason: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  submittedPrediction: EventPrediction | null;
  isAuthenticated: boolean;
  onLogin: () => void;
};

export const PredictionCenter: React.FC<Props> = ({
  eventId, matches, enabled, exactEnabled, winnerEnabled, drawEnabled, sharingEnabled,
  selectedMatchId, onSelectMatch, predictionType, onPredictionType,
  winnerTeamId, onWinnerTeamId, scoreA, scoreB, onScoreA, onScoreB,
  reason, onReason, onSubmit, submitting, submittedPrediction, isAuthenticated, onLogin,
}) => {
  const { t } = useI18n();
  const match = matches.find((m) => m.matchId === selectedMatchId) ?? matches[0];

  const { data: breakdown } = useQuery({
    queryKey: ['prediction-breakdown', eventId, match?.matchId],
    queryFn: () => sportsEventLayerService.getPredictionBreakdown(eventId, match!.matchId),
    enabled: !!match?.matchId && enabled,
    refetchInterval: 45_000,
  });

  if (!enabled) return null;

  return (
    <Box component="section" className={styles.section} id="predictions">
      <Typography component="h2" className={styles.sectionTitle}>{t('event_hub.free_fan_predictions')}</Typography>
      <Typography className={styles.sectionLead}>{t('event_hub.predictions_lead')}</Typography>

      {matches.length === 0 ? (
        <ComingSoon title={t('event_hub.predictions_coming_soon')} />
      ) : (
        <Box className={styles.predictionPanel}>
          <Select fullWidth size="small" value={match?.matchId ?? ''} onChange={(e) => onSelectMatch(e.target.value)} className={styles.selectDark}>
            {matches.map((m) => (
              <MenuItem key={m.matchId} value={m.matchId}>{m.teamAFlag} {m.teamAName} vs {m.teamBName} {m.teamBFlag}</MenuItem>
            ))}
          </Select>

          {breakdown && breakdown.totalPredictions > 0 && (
            <Box className={styles.communityBars}>
              <Typography className={styles.communityLabel}>{t('event_hub.community_picks')}</Typography>
              {breakdown.outcomes.map((o) => (
                <Box key={o.label} className={styles.barRow}>
                  <Typography className={styles.barLabel}>{o.label}</Typography>
                  <Box className={styles.barTrack}>
                    <motion.div
                      className={styles.barFill}
                      initial={{ width: 0 }}
                      animate={{ width: `${o.percent}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </Box>
                  <Typography className={styles.barPct}>{o.percent}%</Typography>
                </Box>
              ))}
            </Box>
          )}

          <Select fullWidth size="small" value={predictionType} onChange={(e) => onPredictionType(e.target.value as typeof predictionType)} className={styles.selectDark} sx={{ mt: 2 }}>
            {winnerEnabled && <MenuItem value="winner">{t('event_hub.pick_winner')}</MenuItem>}
            {drawEnabled && <MenuItem value="draw">{t('event_hub.pick_draw')}</MenuItem>}
            {exactEnabled && <MenuItem value="exact_score">{t('event_hub.pick_score')}</MenuItem>}
          </Select>

          {predictionType === 'winner' && match && (
            <Select fullWidth size="small" value={winnerTeamId} onChange={(e) => onWinnerTeamId(e.target.value)} className={styles.selectDark} sx={{ mt: 1.5 }}>
              <MenuItem value={match.teamAId}>{match.teamAName}</MenuItem>
              <MenuItem value={match.teamBId}>{match.teamBName}</MenuItem>
            </Select>
          )}

          {predictionType === 'exact_score' && match && (
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
              <TextField size="small" label={match.teamAName} value={scoreA} onChange={(e) => onScoreA(e.target.value)} type="number" className={styles.inputDark} />
              <TextField size="small" label={match.teamBName} value={scoreB} onChange={(e) => onScoreB(e.target.value)} type="number" className={styles.inputDark} />
            </Stack>
          )}

          <TextField fullWidth size="small" multiline rows={2} label={t('event_hub.why_optional')} value={reason} onChange={(e) => onReason(e.target.value)} className={styles.inputDark} sx={{ mt: 1.5 }} />

          {isAuthenticated ? (
            <Button variant="contained" className={styles.ctaPrimary} onClick={onSubmit} disabled={submitting} sx={{ mt: 2 }}>
              {t('event_hub.submit_prediction')}
            </Button>
          ) : (
            <Button variant="contained" className={styles.ctaPrimary} onClick={onLogin} sx={{ mt: 2 }}>
              {t('event_hub.login_to_predict')}
            </Button>
          )}

          {submittedPrediction && match && sharingEnabled && (
            <PredictionShareCard
              match={match}
              prediction={submittedPrediction}
              onShared={() => sportsEventLayerService.sharePrediction(eventId, match.matchId)}
            />
          )}
        </Box>
      )}
    </Box>
  );
};
