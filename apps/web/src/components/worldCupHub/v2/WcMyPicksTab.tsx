import React from 'react';
import { Box, Button, Chip, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { CountryFlag } from '@/components/worldCupHub/CountryFlag';
import { useI18n } from '@/hooks/useI18n';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import { parseKickoffUtc } from '@/utils/eventMatchUtils';
import type { WcHubProps } from './wcTypes';
import styles from '@/pages/WorldCupV2.module.css';

type Props = Pick<WcHubProps, 'eventId' | 'hub' | 'isAuthenticated' | 'onAuthRequired'>;

export const WcMyPicksTab: React.FC<Props> = ({ eventId, hub, isAuthenticated, onAuthRequired }) => {
  const { t } = useI18n();

  const { data: summary } = useQuery({
    queryKey: ['my-picks', eventId],
    queryFn: () => sportsEventLayerService.getMyPicksSummary(eventId),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <Box className={styles.tabPanel}>
        <Typography className={styles.sectionTitle}>{t('event_hub.my_picks_title')}</Typography>
        <Box className={styles.emptyPremium}>
          <Typography className={styles.emptyTitle}>{t('event_hub.my_picks_login')}</Typography>
          <Button variant="contained" className={styles.ctaPrimary} sx={{ mt: 2 }} onClick={onAuthRequired}>
            {t('event_hub.signup_free')}
          </Button>
        </Box>
      </Box>
    );
  }

  const wrong = (summary?.totalCount ?? 0) - (summary?.correctCount ?? 0) - (summary?.pendingCount ?? 0);

  return (
    <Box className={styles.tabPanel}>
      <Typography className={styles.sectionTitle}>{t('event_hub.my_picks_title')}</Typography>
      <Typography className={styles.sectionLead}>{t('event_hub.my_picks_lead')}</Typography>

      <Box className={styles.picksGrid}>
        <Box className={styles.pickStatCard}>
          <Typography className={styles.pickStatVal}>{summary?.totalCount ?? 0}</Typography>
          <Typography className={styles.pickStatLbl}>{t('event_hub.my_predictions')}</Typography>
        </Box>
        <Box className={styles.pickStatCard}>
          <Typography className={styles.pickStatVal}>{summary?.correctCount ?? 0}</Typography>
          <Typography className={styles.pickStatLbl}>{t('event_hub.correct_picks')}</Typography>
        </Box>
        <Box className={styles.pickStatCard}>
          <Typography className={styles.pickStatVal}>{Math.max(0, wrong)}</Typography>
          <Typography className={styles.pickStatLbl}>{t('event_hub.wrong_picks')}</Typography>
        </Box>
        <Box className={styles.pickStatCard}>
          <Typography className={styles.pickStatVal}>{summary?.pendingCount ?? 0}</Typography>
          <Typography className={styles.pickStatLbl}>{t('event_hub.pending_picks')}</Typography>
        </Box>
        <Box className={styles.pickStatCard}>
          <Typography className={styles.pickStatVal}>{summary?.accuracyPercent ?? 0}%</Typography>
          <Typography className={styles.pickStatLbl}>{t('event_hub.accuracy')}</Typography>
        </Box>
        <Box className={styles.pickStatCard}>
          <Typography className={styles.pickStatVal}>
            {summary?.globalRank ? `#${summary.globalRank}` : '—'}
          </Typography>
          <Typography className={styles.pickStatLbl}>{t('event_hub.global_rank')}</Typography>
        </Box>
      </Box>

      {!summary?.predictions.length ? (
        <Box className={styles.emptyPremium}>
          <Typography className={styles.emptyTitle}>{t('event_hub.no_picks_yet')}</Typography>
        </Box>
      ) : (
        <Box className={styles.matchGrid}>
          {summary.predictions.map((pred) => {
            const match = hub.matches.find((m) => m.matchId === pred.matchId);
            if (!match) return null;
            const label =
              pred.predictionType === 'draw'
                ? t('event_hub.pick_draw')
                : pred.predictedWinnerTeamId === match.teamAId
                  ? match.teamAName
                  : match.teamBName;

            const hasResult = match.status === 'Completed' && match.scoreA != null && match.scoreB != null;
            const kickoff = parseKickoffUtc(match.matchDate, match.matchTime);
            const inPlay = match.status === 'Live'
              || (match.status === 'Scheduled' && kickoff != null && kickoff <= Date.now());

            let chipLabel: string;
            let chipColor: 'success' | 'error' | 'warning' | 'default';
            if (hasResult) {
              const actual = match.scoreA! > match.scoreB! ? match.teamAId
                : match.scoreB! > match.scoreA! ? match.teamBId : 'draw';
              const predicted = pred.predictionType === 'draw' ? 'draw' : pred.predictedWinnerTeamId;
              const exact = pred.predictionType === 'exact_score'
                && pred.predictedScoreA === match.scoreA && pred.predictedScoreB === match.scoreB;
              if (exact) { chipLabel = `🎯 ${t('event_hub.pick_exact')}`; chipColor = 'success'; }
              else if (actual === predicted) { chipLabel = `✓ ${t('event_hub.pick_correct')}`; chipColor = 'success'; }
              else { chipLabel = `✗ ${t('event_hub.pick_missed')}`; chipColor = 'error'; }
            } else if (inPlay) {
              chipLabel = t('event_hub.pick_in_progress');
              chipColor = 'warning';
            } else {
              chipLabel = `✓ ${t('event_hub.pick_saved')}`;
              chipColor = 'default';
            }

            return (
              <Box key={pred.predictionKey} className={styles.matchCard}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', fontWeight: 700 }}>
                  <CountryFlag teamId={match.teamAId} flagEmoji={match.teamAFlag} size={24} alt={match.teamAName ?? ''} />
                  <span>{match.teamAName}</span>
                  <span className={styles.matchVs}>vs</span>
                  <span>{match.teamBName}</span>
                  <CountryFlag teamId={match.teamBId} flagEmoji={match.teamBFlag} size={24} alt={match.teamBName ?? ''} />
                </Box>
                <Typography sx={{ fontSize: '0.9rem' }}>
                  {label}
                  {pred.predictionType === 'exact_score' && pred.predictedScoreA != null && (
                    <> · {pred.predictedScoreA}–{pred.predictedScoreB}</>
                  )}
                </Typography>
                {hasResult && (
                  <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)' }}>
                    {t('event_hub.final_score')}: {match.scoreA}–{match.scoreB}
                  </Typography>
                )}
                <Chip size="small" label={chipLabel} color={chipColor} />
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};
