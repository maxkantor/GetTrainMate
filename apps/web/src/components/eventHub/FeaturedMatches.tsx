import React from 'react';
import { Box, Button, Chip, Grid, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { useI18n } from '@/hooks/useI18n';
import { useMatchCountdown } from '@/hooks/useMatchCountdown';
import { ComingSoon } from '@/components/eventHub/ComingSoon';
import type { EventMatch } from '@/services/sportsEventLayerService';
import { arePredictionsOpen, formatMatchMeta } from '@/utils/eventMatchUtils';
import styles from '@/pages/EventHub.module.css';

type Props = {
  matches: EventMatch[];
  onPredict: (matchId: string) => void;
  onDiscuss: (matchId: string) => void;
  onShare: (match: EventMatch) => void;
};

const MatchCard: React.FC<{
  match: EventMatch;
  onPredict: () => void;
  onDiscuss: () => void;
  onShare: () => void;
}> = ({ match, onPredict, onDiscuss, onShare }) => {
  const { t } = useI18n();
  const hasKickoff = Boolean(match.matchDate?.trim() && match.matchTime?.trim());
  const countdown = useMatchCountdown(hasKickoff ? match.matchDate : '', hasKickoff ? match.matchTime : undefined);
  const meta = formatMatchMeta(match);
  const predictionsOpen = arePredictionsOpen(match);

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
      <Box className={styles.matchTicket}>
        <Box className={styles.matchTicketTop}>
          {match.status === 'Live' && <Chip label="LIVE" size="small" className={styles.liveChip} />}
          {match.status === 'Completed' && match.scoreA != null && (
            <Typography className={styles.matchScore}>{match.scoreA} – {match.scoreB}</Typography>
          )}
          {hasKickoff && countdown && match.status === 'Scheduled' && (
            <Typography className={styles.matchCountdown}>{countdown}</Typography>
          )}
        </Box>
        <Box className={styles.matchTeams}>
          <Box className={styles.matchTeam}>
            <span className={styles.matchFlag}>{match.teamAFlag}</span>
            <Typography className={styles.matchTeamName}>{match.teamAName}</Typography>
          </Box>
          <Typography className={styles.matchVs}>VS</Typography>
          <Box className={styles.matchTeam}>
            <span className={styles.matchFlag}>{match.teamBFlag}</span>
            <Typography className={styles.matchTeamName}>{match.teamBName}</Typography>
          </Box>
        </Box>
        <Typography className={styles.matchMeta}>
          {meta || (match.stage ? match.stage : t('event_hub.schedule_tbd'))}
        </Typography>
        <Box className={styles.matchActions}>
          <Button
            size="small"
            variant="contained"
            className={styles.matchBtnPrimary}
            onClick={onPredict}
            disabled={!predictionsOpen}
          >
            {predictionsOpen ? t('event_hub.predict_match') : t('event_hub.predictions_closed')}
          </Button>
          <Button size="small" variant="outlined" className={styles.matchBtnGhost} onClick={onDiscuss}>
            {t('event_hub.join_discussion')}
          </Button>
          <Button size="small" variant="text" onClick={onShare}>{t('event_hub.share_match')}</Button>
        </Box>
      </Box>
    </motion.div>
  );
};

export const FeaturedMatches: React.FC<Props> = ({ matches, onPredict, onDiscuss, onShare }) => {
  const { t } = useI18n();
  const upcoming = matches
    .filter((m) => m.status !== 'Completed')
    .sort((a, b) => `${a.matchDate}${a.matchTime}`.localeCompare(`${b.matchDate}${b.matchTime}`))
    .slice(0, 6);

  return (
    <Box component="section" className={styles.section} id="featured-matches">
      <Typography component="h2" className={styles.sectionTitle}>{t('event_hub.featured_matches')}</Typography>
      <Typography className={styles.sectionLead}>{t('event_hub.featured_matches_lead')}</Typography>
      {upcoming.length === 0 ? (
        <ComingSoon title={t('event_hub.matches_coming_soon')} description={t('event_hub.matches_coming_soon_desc')} />
      ) : (
        <Grid container spacing={2.5}>
          {upcoming.map((m) => (
            <Grid item xs={12} sm={6} lg={4} key={m.matchId}>
              <MatchCard
                match={m}
                onPredict={() => onPredict(m.matchId)}
                onDiscuss={() => onDiscuss(m.matchId)}
                onShare={() => onShare(m)}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};
