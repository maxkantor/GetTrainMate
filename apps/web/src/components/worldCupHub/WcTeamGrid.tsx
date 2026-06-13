import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import { useWcDisplay } from '@/hooks/useWcDisplay';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import styles from '@/pages/EventHub.module.css';

type Props = {
  eventId: string;
  onFollow: (teamId: string, country: string) => void;
  onFindFans: (teamId: string) => void;
  onAuthRequired: () => void;
  isAuthenticated: boolean;
};

export const WcTeamGrid: React.FC<Props> = ({
  eventId, onFollow, onFindFans, onAuthRequired, isAuthenticated,
}) => {
  const { t } = useI18n();
  const { teamName } = useWcDisplay();
  const { data: teams = [] } = useQuery({
    queryKey: ['team-stats', eventId],
    queryFn: () => sportsEventLayerService.getTeamStats(eventId),
    refetchInterval: 60_000,
  });

  return (
    <Box component="section" className={styles.sectionTight} id="teams">
      <Typography component="h2" className={styles.sectionTitle}>{t('event_hub.team_explorer')}</Typography>
      {teams.length === 0 ? (
        <Box className={styles.emptyPremium}>
          <Typography className={styles.emptyTitle}>{t('event_hub.teams_coming_soon')}</Typography>
        </Box>
      ) : (
        <Box className={styles.teamGrid}>
          {teams.map((team) => (
            <Box key={team.teamId} className={styles.teamCard}>
              <Typography className={styles.teamFlag}>{team.flagEmoji}</Typography>
              <Typography className={styles.teamName}>{teamName(team.teamId, team.name)}</Typography>
              <Typography className={styles.teamStats}>
                {team.predictionsCount} {t('event_hub.picks')} · {team.fanCount} {t('event_hub.fans')}
              </Typography>
              <Box className={styles.teamActions}>
                <Button size="small" variant="outlined" onClick={() => (isAuthenticated ? onFollow(team.teamId, team.country) : onAuthRequired())}>
                  {t('event_hub.follow_team')}
                </Button>
                <Button size="small" variant="contained" className={styles.matchBtnPrimary} onClick={() => onFindFans(team.teamId)}>
                  {t('event_hub.find_fans')}
                </Button>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};
