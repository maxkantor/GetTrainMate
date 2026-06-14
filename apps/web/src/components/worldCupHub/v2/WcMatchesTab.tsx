import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { TodayPredictionsSharePanel } from '@/components/worldCupHub/TodayPredictionsSharePanel';
import { categorizeMatches } from '@/utils/eventMatchUtils';
import type { WcHubProps } from './wcTypes';
import { WcMatchCard } from './WcMatchCard';
import styles from '@/pages/WorldCupV2.module.css';

type Props = Pick<WcHubProps, 'eventId' | 'hub' | 'isAuthenticated' | 'onAuthRequired'>;

type MatchFilter = 'today' | 'upcoming' | 'completed';

export const WcMatchesTab: React.FC<Props> = ({ eventId, hub, isAuthenticated, onAuthRequired }) => {
  const { t } = useI18n();
  const [filter, setFilter] = useState<MatchFilter>('today');
  const { today, upcoming, completed } = categorizeMatches(hub.matches);

  const lists: Record<MatchFilter, typeof hub.matches> = { today, upcoming, completed };
  const active = lists[filter];

  const filters: { key: MatchFilter; label: string; count: number }[] = [
    { key: 'today', label: t('event_hub.filter_today'), count: today.length },
    { key: 'upcoming', label: t('event_hub.filter_upcoming'), count: upcoming.length },
    { key: 'completed', label: t('event_hub.filter_completed'), count: completed.length },
  ];

  return (
    <Box className={styles.tabPanel}>
      <Typography className={styles.sectionTitle}>{t('event_hub.match_center')}</Typography>
      <Typography className={styles.sectionLead}>{t('event_hub.match_center_lead')}</Typography>

      <Box className={styles.subTabs}>
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`${styles.subTab} ${filter === f.key ? styles.subTabActive : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </Box>

      {filter === 'today' && (
        <TodayPredictionsSharePanel
          eventId={eventId}
          matches={hub.matches}
          isAuthenticated={isAuthenticated}
          onAuthRequired={onAuthRequired}
        />
      )}

      {active.length === 0 ? (
        <Box className={styles.emptyPremium}>
          <Typography className={styles.emptyTitle}>{t('event_hub.matches_coming_soon')}</Typography>
          <Typography className={styles.emptyDesc}>{t('event_hub.matches_coming_soon_desc')}</Typography>
        </Box>
      ) : (
        <Box className={styles.matchGrid}>
          {active.map((m) => (
            <WcMatchCard
              key={m.matchId}
              eventId={eventId}
              hub={hub}
              match={m}
              isAuthenticated={isAuthenticated}
              onAuthRequired={onAuthRequired}
              showPredict={filter !== 'completed'}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};
