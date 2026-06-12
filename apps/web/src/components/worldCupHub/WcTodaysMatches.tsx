import React from 'react';
import { Box, Button, Chip, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import type { Fixture } from '@/types/worldCupHub';
import { arePredictionsOpen, formatMatchMeta } from '@/utils/eventMatchUtils';
import { useMatchCountdown } from '@/hooks/useMatchCountdown';
import styles from '@/pages/EventHub.module.css';

type Props = {
  eventId: string;
  fixtures: Fixture[];
  onPredict: (matchId: string) => void;
  onDiscuss: (matchId: string) => void;
};

const statusLabel = (status: Fixture['status']) => {
  if (status === 'Live') return 'LIVE';
  if (status === 'Completed') return 'FINAL';
  if (status === 'Postponed') return 'POSTPONED';
  return 'UPCOMING';
};

const MatchRailCard: React.FC<{
  fixture: Fixture;
  eventId: string;
  onPredict: () => void;
  onDiscuss: () => void;
}> = ({ fixture, eventId, onPredict, onDiscuss }) => {
  const { t } = useI18n();
  const hasKickoff = Boolean(fixture.matchDate?.trim() && fixture.matchTime?.trim());
  const countdown = useMatchCountdown(hasKickoff ? fixture.matchDate : '', hasKickoff ? fixture.matchTime : undefined);
  const open = arePredictionsOpen(fixture);

  const { data: breakdown } = useQuery({
    queryKey: ['prediction-breakdown', eventId, fixture.matchId],
    queryFn: () => sportsEventLayerService.getPredictionBreakdown(eventId, fixture.matchId),
    staleTime: 30_000,
  });

  const teamA = breakdown?.outcomes.find((o) => o.teamId === fixture.teamAId);
  const teamB = breakdown?.outcomes.find((o) => o.teamId === fixture.teamBId);
  const draw = breakdown?.outcomes.find((o) => o.outcomeType === 'draw');
  const total = breakdown?.totalPredictions ?? 0;

  return (
    <Box className={styles.railCard}>
      <Box className={styles.railCardTop}>
        <Chip size="small" label={statusLabel(fixture.status)} className={styles.statusChip} />
        {hasKickoff && countdown && fixture.status === 'Scheduled' ? (
          <Typography className={styles.railCountdown}>{countdown}</Typography>
        ) : (
          <Typography className={styles.railMeta}>{formatMatchMeta(fixture) || t('event_hub.kickoff_tbd')}</Typography>
        )}
      </Box>
      <Box className={styles.railTeams}>
        <Box className={styles.railTeam}>
          <span className={styles.railFlag}>{fixture.teamAFlag}</span>
          <Typography className={styles.railTeamName}>{fixture.teamAName}</Typography>
        </Box>
        <Typography className={styles.railVs}>vs</Typography>
        <Box className={styles.railTeam}>
          <span className={styles.railFlag}>{fixture.teamBFlag}</span>
          <Typography className={styles.railTeamName}>{fixture.teamBName}</Typography>
        </Box>
      </Box>
      {total > 0 && (
        <Box className={styles.splitBar}>
          <Box className={styles.splitSegA} style={{ width: `${teamA?.percent ?? 0}%` }} />
          <Box className={styles.splitSegD} style={{ width: `${draw?.percent ?? 0}%` }} />
          <Box className={styles.splitSegB} style={{ width: `${teamB?.percent ?? 0}%` }} />
        </Box>
      )}
      {total > 0 && (
        <Typography className={styles.splitLabels}>
          {fixture.teamAName} {teamA?.percent ?? 0}% · Draw {draw?.percent ?? 0}% · {fixture.teamBName} {teamB?.percent ?? 0}%
        </Typography>
      )}
      <Box className={styles.railActions}>
        <Button size="small" variant="contained" className={styles.matchBtnPrimary} disabled={!open} onClick={onPredict}>
          {open ? t('event_hub.predict_match') : t('event_hub.predictions_closed')}
        </Button>
        <Button size="small" variant="outlined" className={styles.matchBtnGhost} onClick={onDiscuss}>
          {t('event_hub.join_discussion')}
        </Button>
      </Box>
    </Box>
  );
};

export const WcTodaysMatches: React.FC<Props> = ({ eventId, fixtures, onPredict, onDiscuss }) => {
  const { t } = useI18n();
  const sorted = [...fixtures]
    .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || `${a.matchDate}${a.matchTime}`.localeCompare(`${b.matchDate}${b.matchTime}`));

  return (
    <Box component="section" className={styles.section} id="matches">
      <Typography component="h2" className={styles.sectionTitle}>{t('event_hub.todays_matches')}</Typography>
      <Typography className={styles.sectionLead}>{t('event_hub.todays_matches_lead')}</Typography>
      {sorted.length === 0 ? (
        <Box className={styles.emptyPremium}>
          <Typography className={styles.emptyTitle}>{t('event_hub.matches_coming_soon')}</Typography>
          <Typography className={styles.emptyDesc}>{t('event_hub.matches_coming_soon_desc')}</Typography>
        </Box>
      ) : (
        <Box className={styles.railScroll}>
          {sorted.map((f) => (
            <MatchRailCard
              key={f.matchId}
              fixture={f}
              eventId={eventId}
              onPredict={() => onPredict(f.matchId)}
              onDiscuss={() => onDiscuss(f.matchId)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};
