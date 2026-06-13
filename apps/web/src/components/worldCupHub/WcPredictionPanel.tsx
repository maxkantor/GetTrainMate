import React from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import { useWcDisplay } from '@/hooks/useWcDisplay';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import type { Fixture, Prediction, WinnerPick } from '@/types/worldCupHub';
import { arePredictionsOpen } from '@/utils/eventMatchUtils';
import { WcPredictionSuccess } from './WcPredictionSuccess';
import styles from '@/pages/EventHub.module.css';

type Props = {
  eventId: string;
  fixture: Fixture | undefined;
  fixtures: Fixture[];
  winnerPick: WinnerPick | null;
  onWinnerPick: (pick: WinnerPick) => void;
  scoreA: string;
  scoreB: string;
  onScoreA: (v: string) => void;
  onScoreB: (v: string) => void;
  fanTake: string;
  onFanTake: (v: string) => void;
  showScore: boolean;
  onToggleScore: () => void;
  isAuthenticated: boolean;
  submitting: boolean;
  submitted: Prediction | null;
  onSubmit: () => void;
  onAuthRequired: () => void;
  onFindFans: (teamId: string) => void;
  onFindNearby: () => void;
  onShared?: () => void;
};

export const WcPredictionPanel: React.FC<Props> = ({
  eventId, fixture, fixtures, winnerPick, onWinnerPick,
  scoreA, scoreB, onScoreA, onScoreB, fanTake, onFanTake,
  showScore, onToggleScore, isAuthenticated, submitting, submitted,
  onSubmit, onAuthRequired, onFindFans, onFindNearby, onShared,
}) => {
  const { t } = useI18n();
  const { teamName, matchLine, outcomeLabel } = useWcDisplay();
  const open = fixture ? arePredictionsOpen(fixture) : false;

  const { data: breakdown } = useQuery({
    queryKey: ['prediction-breakdown', eventId, fixture?.matchId],
    queryFn: () => sportsEventLayerService.getPredictionBreakdown(eventId, fixture!.matchId),
    enabled: !!fixture?.matchId,
    refetchInterval: 30_000,
  });

  if (!fixtures.length) {
    return (
      <Box component="section" className={styles.section} id="predict">
        <Box className={styles.emptyPremium}>
          <Typography className={styles.emptyTitle}>{t('event_hub.predictions_coming_soon')}</Typography>
        </Box>
      </Box>
    );
  }

  if (submitted && fixture) {
    return (
      <WcPredictionSuccess
        fixture={fixture}
        prediction={submitted}
        breakdown={breakdown}
        onFindFans={onFindFans}
        onFindNearby={onFindNearby}
        onShared={onShared}
      />
    );
  }

  return (
    <Box component="section" className={styles.section} id="predict">
      <Typography component="h2" className={styles.sectionTitle}>{t('event_hub.prediction_form_title')}</Typography>
      <Typography className={styles.sectionLead}>{t('event_hub.prediction_form_lead')}</Typography>

      <Box className={styles.predictPanel}>
        <Typography className={styles.predictMatchLabel}>
          {fixture?.teamAFlag}{' '}
          {fixture ? matchLine(fixture.teamAId, fixture.teamAName, fixture.teamBId, fixture.teamBName) : ''}{' '}
          {fixture?.teamBFlag}
        </Typography>

        <Box className={styles.pickGrid}>
          {([
            ['teamA', teamName(fixture?.teamAId, fixture?.teamAName), fixture?.teamAFlag],
            ['draw', t('event_hub.pick_draw'), '⚖️'],
            ['teamB', teamName(fixture?.teamBId, fixture?.teamBName), fixture?.teamBFlag],
          ] as const).map(([pick, label, flag]) => (
            <motion.button
              key={pick}
              type="button"
              className={`${styles.pickCard} ${winnerPick === pick ? styles.pickCardActive : ''}`}
              whileTap={{ scale: 0.98 }}
              onClick={() => onWinnerPick(pick)}
              disabled={!open}
            >
              <span className={styles.pickFlag}>{flag}</span>
              <span className={styles.pickLabel}>{label}</span>
            </motion.button>
          ))}
        </Box>

        <Button size="small" className={styles.scoreToggle} onClick={onToggleScore}>
          {showScore ? t('event_hub.hide_score') : t('event_hub.add_exact_score')}
        </Button>

        {showScore && fixture && (
          <Box className={styles.scoreRow}>
            <TextField size="small" label={teamName(fixture.teamAId, fixture.teamAName)} value={scoreA} onChange={(e) => onScoreA(e.target.value)} type="number" className={styles.inputDark} />
            <Typography sx={{ alignSelf: 'center', opacity: 0.5 }}>–</Typography>
            <TextField size="small" label={teamName(fixture.teamBId, fixture.teamBName)} value={scoreB} onChange={(e) => onScoreB(e.target.value)} type="number" className={styles.inputDark} />
          </Box>
        )}

        <TextField
          fullWidth
          multiline
          rows={2}
          placeholder={t('event_hub.fan_take_placeholder')}
          value={fanTake}
          onChange={(e) => onFanTake(e.target.value)}
          className={styles.inputDark}
          sx={{ mt: 1.5 }}
        />

        {breakdown && breakdown.totalPredictions > 0 && (
          <Box className={styles.communityBars} sx={{ mt: 2 }}>
            <Typography className={styles.communityLabel}>{t('event_hub.community_picks')}</Typography>
            {breakdown.outcomes.map((o) => (
              <Box key={o.label} className={styles.barRow}>
                <Typography className={styles.barLabel}>{outcomeLabel(o)}</Typography>
                <Box className={styles.barTrack}>
                  <motion.div className={styles.barFill} initial={{ width: 0 }} animate={{ width: `${o.percent}%` }} />
                </Box>
                <Typography className={styles.barPct}>{o.percent}%</Typography>
              </Box>
            ))}
          </Box>
        )}

        {!open && <Typography className={styles.closedNote}>{t('event_hub.predictions_closed')}</Typography>}

        {isAuthenticated ? (
          <Button
            variant="contained"
            size="large"
            className={styles.ctaPrimary}
            sx={{ mt: 2 }}
            disabled={!open || !winnerPick || submitting}
            onClick={onSubmit}
          >
            {t('event_hub.save_prediction')}
          </Button>
        ) : (
          <Button variant="contained" size="large" className={styles.ctaPrimary} sx={{ mt: 2 }} onClick={onAuthRequired}>
            {t('event_hub.signup_to_save')}
          </Button>
        )}
      </Box>
    </Box>
  );
};
