import React from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { ComingSoon } from '@/components/eventHub/ComingSoon';
import type { EventGroup, EventTeam } from '@/services/sportsEventLayerService';
import styles from '@/pages/EventHub.module.css';

type Props = {
  enabled: boolean;
  published: boolean;
  groups: EventGroup[];
  teams: EventTeam[];
};

export const StandingsPanel: React.FC<Props> = ({ enabled, published, groups, teams }) => {
  const { t } = useI18n();

  if (!enabled) return null;

  const hasStandingsData = groups.length > 0 && teams.some((t) => t.played > 0 || t.points > 0);

  return (
    <Box component="section" className={styles.sectionMuted} id="standings">
      <Typography component="h2" className={styles.sectionTitleSmall}>{t('event_hub.standings_title')}</Typography>
      {!published || groups.length === 0 ? (
        <ComingSoon title={t('event_hub.standings_coming_soon')} description={t('event_hub.standings_admin_only')} icon="📊" />
      ) : !hasStandingsData ? (
        <ComingSoon title={t('event_hub.standings_not_published')} description={t('event_hub.standings_wait')} icon="📊" />
      ) : (
        <Grid container spacing={2}>
          {groups.map((g) => (
            <Grid item xs={12} sm={6} md={4} key={g.groupId}>
              <Box className={styles.standingsCard}>
                <Typography className={styles.standingsGroupLabel}>{g.label}</Typography>
                {teams.filter((t) => t.groupId === g.groupId).map((team) => (
                  <Box key={team.teamId} className={styles.standingsRow}>
                    <span>{team.flagEmoji} {team.name}</span>
                    <span className={styles.standingsPts}>{team.points} pts</span>
                  </Box>
                ))}
              </Box>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};
