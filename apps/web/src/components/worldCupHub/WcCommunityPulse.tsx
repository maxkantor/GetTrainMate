import React from 'react';
import { Box, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import { useWcDisplay } from '@/hooks/useWcDisplay';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import styles from '@/pages/EventHub.module.css';

type Props = { eventId: string };

export const WcCommunityPulse: React.FC<Props> = ({ eventId }) => {
  const { t } = useI18n();
  const { teamName, matchLine } = useWcDisplay();
  const { data: pulse } = useQuery({
    queryKey: ['community-pulse', eventId],
    queryFn: () => sportsEventLayerService.getCommunityPulse(eventId),
    refetchInterval: 45_000,
  });

  const { data: hub } = useQuery({
    queryKey: ['event-hub', eventId],
    queryFn: () => sportsEventLayerService.getHubSnapshot(eventId),
    staleTime: 60_000,
  });

  const hasData = (pulse?.totalPredictions ?? 0) > 0;
  const discussedMatch = hub?.matches.find((m) => m.matchId === pulse?.mostDiscussedMatchId);

  return (
    <Box component="section" className={styles.sectionTight} id="pulse">
      <Typography component="h2" className={styles.sectionTitle}>{t('event_hub.community_pulse')}</Typography>
      {!hasData ? (
        <Box className={styles.pulseEmpty}>{t('event_hub.pulse_empty')}</Box>
      ) : (
        <Box className={styles.pulseGrid}>
          <Box className={styles.pulseCard}>
            <span className={styles.pulseValue}>{pulse?.totalPredictions ?? 0}</span>
            <span className={styles.pulseLabel}>{t('event_hub.stat_predictions')}</span>
          </Box>
          <Box className={styles.pulseCard}>
            <span className={styles.pulseValue}>
              {pulse?.mostPickedTeamName
                ? teamName(pulse.mostPickedTeamId, pulse.mostPickedTeamName)
                : '—'}
            </span>
            <span className={styles.pulseLabel}>{t('event_hub.most_picked_today')}</span>
          </Box>
          <Box className={styles.pulseCard}>
            <span className={styles.pulseValue}>
              {discussedMatch
                ? matchLine(discussedMatch.teamAId, discussedMatch.teamAName, discussedMatch.teamBId, discussedMatch.teamBName)
                : pulse?.mostDiscussedMatchLabel ?? '—'}
            </span>
            <span className={styles.pulseLabel}>{t('event_hub.most_discussed')}</span>
          </Box>
        </Box>
      )}
      {pulse?.latestTakes?.length ? (
        <Box className={styles.latestTakes}>
          {pulse.latestTakes.map((take) => (
            <Box key={`${take.threadId}-${take.createdAt}`} className={styles.takeChip}>
              <strong>{take.userDisplayName?.[0]?.toUpperCase() ?? t('event_hub.fan')[0]}</strong>
              <span>{take.body}</span>
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
};
