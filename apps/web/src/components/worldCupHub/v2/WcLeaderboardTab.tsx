import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import type { WcHubProps } from './wcTypes';
import styles from '@/pages/WorldCupV2.module.css';

type Props = Pick<WcHubProps, 'eventId'>;

export const WcLeaderboardTab: React.FC<Props> = ({ eventId }) => {
  const { t } = useI18n();
  const [period, setPeriod] = useState<'overall' | 'week' | 'today'>('overall');

  const { data: entries = [] } = useQuery({
    queryKey: ['leaderboard', eventId, 'predictors'],
    queryFn: () => sportsEventLayerService.getLeaderboard(eventId, 'predictors'),
    refetchInterval: 60_000,
  });

  const periods = [
    { key: 'today' as const, label: t('event_hub.lb_today') },
    { key: 'week' as const, label: t('event_hub.lb_week') },
    { key: 'overall' as const, label: t('event_hub.lb_overall') },
  ];

  const display = period === 'overall' ? entries : entries.slice(0, Math.min(10, entries.length));

  return (
    <Box className={styles.tabPanel}>
      <Typography className={styles.sectionTitle}>{t('event_hub.leaderboard_title')}</Typography>
      <Typography className={styles.sectionLead}>{t('event_hub.leaderboard_lead')}</Typography>

      <Box className={styles.subTabs}>
        {periods.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`${styles.subTab} ${period === p.key ? styles.subTabActive : ''}`}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </button>
        ))}
      </Box>

      {display.length === 0 ? (
        <Box className={styles.emptyPremium}>
          <Typography className={styles.emptyTitle}>{t('event_hub.no_leaderboard')}</Typography>
        </Box>
      ) : (
        <Box className={styles.lbTable}>
          <Box className={styles.lbRow} sx={{ bgcolor: 'rgba(255,255,255,0.03)', fontWeight: 700, fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>
            <span>{t('event_hub.col_rank')}</span>
            <span>{t('event_hub.col_username')}</span>
            <span>{t('event_hub.col_correct')}</span>
            <span>{t('event_hub.col_points')}</span>
          </Box>
          {display.map((e, i) => (
            <Box key={e.userId} className={styles.lbRow}>
              <span className={styles.lbRank}>#{i + 1}</span>
              <span className={styles.lbName}>{e.displayName ?? t('event_hub.fan')}</span>
              <span className={styles.lbStat}>{e.correctCount} / {e.predictionsCount}</span>
              <span className={styles.lbPts}>{e.score}</span>
            </Box>
          ))}
        </Box>
      )}
      <Typography sx={{ mt: 1.5, fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
        {t('event_hub.lb_disclaimer')}
      </Typography>
    </Box>
  );
};
