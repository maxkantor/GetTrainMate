import React from 'react';
import { Box, Typography } from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { arePredictionsOpen } from '@/utils/eventMatchUtils';
import type { WcHubProps } from './wcTypes';
import { WcMatchCard } from './WcMatchCard';
import styles from '@/pages/WorldCupV2.module.css';

type Props = Pick<WcHubProps, 'eventId' | 'hub' | 'isAuthenticated' | 'onAuthRequired'>;

export const WcPredictionsTab: React.FC<Props> = ({ eventId, hub, isAuthenticated, onAuthRequired }) => {
  const { t } = useI18n();
  const openMatches = hub.matches
    .filter(arePredictionsOpen)
    .sort((a, b) => `${a.matchDate}${a.matchTime}`.localeCompare(`${b.matchDate}${b.matchTime}`));

  return (
    <Box className={styles.tabPanel}>
      <Typography className={styles.sectionTitle}>{t('event_hub.predictions_hub_title')}</Typography>
      <Typography className={styles.sectionLead}>{t('event_hub.predictions_hub_lead')}</Typography>

      {openMatches.length === 0 ? (
        <Box className={styles.emptyPremium}>
          <Typography className={styles.emptyTitle}>{t('event_hub.predictions_coming_soon')}</Typography>
          <Typography className={styles.emptyDesc}>{t('event_hub.matches_coming_soon_desc')}</Typography>
        </Box>
      ) : (
        <Box className={styles.matchGrid}>
          {openMatches.map((m) => (
            <WcMatchCard
              key={m.matchId}
              eventId={eventId}
              match={m}
              isAuthenticated={isAuthenticated}
              onAuthRequired={onAuthRequired}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};
