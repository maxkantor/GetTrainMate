import React, { useState } from 'react';
import { Box, Tab, Tabs, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import { ComingSoon } from '@/components/eventHub/ComingSoon';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import styles from '@/pages/EventHub.module.css';

type Props = { eventId: string };

export const LeaderboardsSection: React.FC<Props> = ({ eventId }) => {
  const { t } = useI18n();
  const [tab, setTab] = useState(0);
  const types = ['predictors', 'active', 'shared'] as const;
  const type = types[tab];

  const { data: entries = [] } = useQuery({
    queryKey: ['leaderboard', eventId, type],
    queryFn: () => sportsEventLayerService.getLeaderboard(eventId, type),
    refetchInterval: 60_000,
  });

  const labels = [t('event_hub.lb_predictors'), t('event_hub.lb_active'), t('event_hub.lb_shared')];

  return (
    <Box component="section" className={styles.section} id="leaderboards">
      <Typography component="h2" className={styles.sectionTitle}>{t('event_hub.leaderboard_title')}</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} className={styles.feedTabs}>
        {labels.map((l, i) => <Tab key={l} label={l} value={i} />)}
      </Tabs>
      {entries.length === 0 ? (
        <ComingSoon title={t('event_hub.no_leaderboard')} icon="🏆" />
      ) : (
        <Box className={styles.lbList}>
          {entries.map((e, i) => (
            <Box key={e.userId} className={styles.lbRow}>
              <span className={styles.lbRank}>#{i + 1}</span>
              <span className={styles.lbName}>{e.displayName ?? t('event_hub.fan')}</span>
              <span className={styles.lbScore}>
                {tab === 0 ? e.score : tab === 1 ? e.commentCount + e.predictionsCount : e.shareCount}
              </span>
            </Box>
          ))}
        </Box>
      )}
      <Typography className={styles.lbDisclaimer}>{t('event_hub.lb_disclaimer')}</Typography>
    </Box>
  );
};
