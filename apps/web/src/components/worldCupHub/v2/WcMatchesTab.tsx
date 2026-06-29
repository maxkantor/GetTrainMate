import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { TodayPredictionsSharePanel } from '@/components/worldCupHub/TodayPredictionsSharePanel';
import { categorizeMatches } from '@/utils/eventMatchUtils';
import { WcEmptyState } from '@/components/worldCupHub/WcEmptyState';
import type { WcHubProps } from './wcTypes';
import { WcMatchCard } from './WcMatchCard';
import styles from '@/pages/WorldCupV2.module.css';

type Props = Pick<WcHubProps, 'eventId' | 'hub' | 'isAuthenticated' | 'onAuthRequired'>;

type MatchFilter = 'today' | 'upcoming' | 'completed';

export const WcMatchesTab: React.FC<Props> = ({ eventId, hub, isAuthenticated, onAuthRequired }) => {
  const { t } = useI18n();
  const [filter, setFilter] = useState<MatchFilter>('today');
  const { today, upcoming, completed } = useMemo(
    () => categorizeMatches(hub.matches),
    [hub.matches],
  );

  useEffect(() => {
    if (filter === 'today' && today.length === 0 && upcoming.length > 0) {
      setFilter('upcoming');
    }
  }, [filter, today.length, upcoming.length]);

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

      {(filter === 'today' || filter === 'upcoming') && (
        <TodayPredictionsSharePanel
          eventId={eventId}
          matches={hub.matches}
          isAuthenticated={isAuthenticated}
          onAuthRequired={onAuthRequired}
          variant={filter === 'upcoming' ? 'upcoming' : 'today'}
        />
      )}

      {active.length === 0 ? (
        <WcEmptyState
          title={
            filter === 'today' && (upcoming.length > 0 || completed.length > 0)
              ? t('event_hub.no_matches_today')
              : filter === 'completed'
                ? t('event_hub.no_completed_matches')
                : t('event_hub.matches_coming_soon')
          }
          description={
            filter === 'today' && upcoming.length > 0
              ? t('event_hub.no_matches_today_desc')
              : filter === 'completed'
                ? t('event_hub.no_completed_matches_desc')
                : t('event_hub.matches_coming_soon_desc')
          }
        />
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
