import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { useI18n } from '@/hooks/useI18n';
import { useWcDisplay } from '@/hooks/useWcDisplay';
import type { Fixture, Prediction, PredictionAggregate } from '@/types/worldCupHub';
import { PredictionShareCard } from '@/components/eventHub/PredictionShareCard';
import styles from '@/pages/EventHub.module.css';

type Props = {
  fixture: Fixture;
  prediction: Prediction;
  breakdown?: PredictionAggregate;
  onFindFans: (teamId: string) => void;
  onFindNearby: () => void;
  onShared?: () => void;
};

export const WcPredictionSuccess: React.FC<Props> = ({
  fixture, prediction, breakdown, onFindFans, onFindNearby, onShared,
}) => {
  const { t } = useI18n();
  const { teamName, matchLine, outcomeLabel } = useWcDisplay();
  const pickedTeamId = prediction.predictedWinnerTeamId
    ?? (prediction.predictionType === 'draw' ? undefined : fixture.teamAId);
  const pickedName = prediction.predictionType === 'draw'
    ? t('event_hub.pick_draw')
    : pickedTeamId === fixture.teamAId
      ? teamName(fixture.teamAId, fixture.teamAName)
      : teamName(fixture.teamBId, fixture.teamBName);

  return (
    <Box component="section" className={styles.section} id="predict">
      <Box className={styles.successPanel}>
        <Typography className={styles.successEyebrow}>✓ {t('event_hub.prediction_live')}</Typography>
        <Typography className={styles.successTitle}>{t('event_hub.your_pick_in')}</Typography>
        <Typography className={styles.successPick}>
          {fixture.teamAFlag} {matchLine(fixture.teamAId, fixture.teamAName, fixture.teamBId, fixture.teamBName)} {fixture.teamBFlag}
          <br />
          <strong>{pickedName}</strong>
          {prediction.predictionType === 'exact_score' && prediction.predictedScoreA != null && (
            <> · {prediction.predictedScoreA}–{prediction.predictedScoreB}</>
          )}
        </Typography>

        {breakdown && breakdown.totalPredictions > 0 && (
          <Box className={styles.communityBars} sx={{ mt: 2 }}>
            {breakdown.outcomes.map((o) => (
              <Box key={o.label} className={styles.barRow}>
                <Typography className={styles.barLabel}>{outcomeLabel(o)}</Typography>
                <Box className={styles.barTrack}>
                  <motion.div className={styles.barFill} animate={{ width: `${o.percent}%` }} />
                </Box>
                <Typography className={styles.barPct}>{o.percent}%</Typography>
              </Box>
            ))}
          </Box>
        )}

        <Box className={styles.successCtas}>
          {pickedTeamId && (
            <Button variant="contained" className={styles.ctaPrimary} onClick={() => onFindFans(pickedTeamId)}>
              {t('event_hub.find_fans_prefix')} {pickedName}
            </Button>
          )}
          <Button variant="outlined" className={styles.ctaSecondary} onClick={onFindNearby}>
            {t('event_hub.find_fans_watching')}
          </Button>
        </Box>

        <PredictionShareCard match={fixture} prediction={prediction} onShared={onShared} />
      </Box>
    </Box>
  );
};
