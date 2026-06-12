import React from 'react';
import { Box, Button, Grid, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import { ComingSoon } from '@/components/eventHub/ComingSoon';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import styles from '@/pages/EventHub.module.css';

type Props = {
  eventId: string;
  onFollow: (teamId: string, country: string) => void;
  onViewDiscussions: (teamId: string) => void;
  onViewPredictions: () => void;
};

export const TeamExplorer: React.FC<Props> = ({ eventId, onFollow, onViewDiscussions, onViewPredictions }) => {
  const { t } = useI18n();
  const { data: teams = [] } = useQuery({
    queryKey: ['team-explorer', eventId],
    queryFn: () => sportsEventLayerService.getTeamStats(eventId),
    refetchInterval: 60_000,
  });

  return (
    <Box component="section" className={styles.section} id="teams">
      <Typography component="h2" className={styles.sectionTitle}>{t('event_hub.team_explorer')}</Typography>
      <Typography className={styles.sectionLead}>{t('event_hub.team_explorer_lead')}</Typography>

      {teams.length === 0 ? (
        <ComingSoon title={t('event_hub.teams_coming_soon')} description={t('event_hub.teams_admin_hint')} />
      ) : (
        <Grid container spacing={2}>
          {teams.map((team, i) => (
            <Grid item xs={12} sm={6} md={4} key={team.teamId}>
              <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                <Box className={styles.teamCard}>
                  <Typography className={styles.teamFlag}>{team.flagEmoji}</Typography>
                  <Typography className={styles.teamName}>{team.name}</Typography>
                  <Box className={styles.teamStats}>
                    <span>{team.fanCount} {t('event_hub.fans')}</span>
                    <span>{team.predictionsCount} {t('event_hub.picks')}</span>
                    <span>{team.discussionCount} {t('event_hub.posts')}</span>
                  </Box>
                  <Box className={styles.teamActions}>
                    <Button size="small" variant="contained" className={styles.matchBtnPrimary} onClick={() => onFollow(team.teamId, team.country)}>
                      {t('event_hub.follow_team')}
                    </Button>
                    <Button size="small" variant="text" onClick={() => onViewDiscussions(team.teamId)}>{t('event_hub.view_discussions')}</Button>
                  </Box>
                </Box>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};
