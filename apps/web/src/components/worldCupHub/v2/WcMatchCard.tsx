import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import type { EventMatch } from '@/services/sportsEventLayerService';
import { formatMatchMeta, isTbdMatch } from '@/utils/eventMatchUtils';
import { useMatchCountdown } from '@/hooks/useMatchCountdown';
import { WcInlinePredict } from './WcInlinePredict';
import styles from '@/pages/WorldCupV2.module.css';

type Props = {
  eventId: string;
  match: EventMatch;
  groupLabel?: string;
  isAuthenticated: boolean;
  onAuthRequired: () => void;
  showPredict?: boolean;
};

const statusClass = (status: EventMatch['status']) => {
  if (status === 'Live') return styles.statusLive;
  if (status === 'Completed') return styles.statusFinal;
  return styles.statusUpcoming;
};

const statusLabel = (status: EventMatch['status'], t: (k: string) => string) => {
  if (status === 'Live') return 'LIVE';
  if (status === 'Completed') return t('event_hub.status_final');
  if (status === 'Postponed') return 'POSTPONED';
  return t('event_hub.status_upcoming');
};

export const WcMatchCard: React.FC<Props> = ({
  eventId, match, groupLabel, isAuthenticated, onAuthRequired, showPredict = true,
}) => {
  const { t } = useI18n();
  const hasKickoff = Boolean(match.matchDate?.trim() && match.matchTime?.trim());
  const countdown = useMatchCountdown(hasKickoff ? match.matchDate : '', hasKickoff ? match.matchTime : undefined);
  const isFinal = match.status === 'Completed';
  const isLive = match.status === 'Live';
  const isTbd = isTbdMatch(match);

  if (isTbd) {
    return (
      <Box className={`${styles.matchCard} ${styles.matchCardTbd}`}>
        <Box className={styles.matchTop}>
          <Chip size="small" label={statusLabel(match.status, t)} className={statusClass(match.status)} />
          <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>
            {match.stage}
          </Typography>
        </Box>
        <Box className={styles.matchTeams}>
          <Box className={styles.matchTeam}>
            <span className={`${styles.matchFlag} ${styles.matchFlagTbd}`}>❔</span>
            <Typography className={`${styles.matchTeamName} ${styles.matchTeamNameTbd}`}>
              {t('event_hub.teams_tbd')}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography className={styles.matchVs}>VS</Typography>
          </Box>
          <Box className={styles.matchTeam}>
            <span className={`${styles.matchFlag} ${styles.matchFlagTbd}`}>❔</span>
            <Typography className={`${styles.matchTeamName} ${styles.matchTeamNameTbd}`}>
              {t('event_hub.teams_tbd')}
            </Typography>
          </Box>
        </Box>
        <Typography className={styles.tbdHint}>🔒 {t('event_hub.tbd_unlock_hint')}</Typography>
      </Box>
    );
  }

  return (
    <Box className={`${styles.matchCard} ${match.isFeatured ? styles.matchCardFeatured : ''}`}>
      <Box className={styles.matchTop}>
        <Chip size="small" label={statusLabel(match.status, t)} className={statusClass(match.status)} />
        {match.isFeatured && <Chip size="small" label="★" sx={{ ml: 0.5, bgcolor: 'rgba(251,191,36,0.2)', color: '#fde68a' }} />}
        {groupLabel && <Chip size="small" label={groupLabel} sx={{ ml: 0.5, bgcolor: 'rgba(129,140,248,0.14)', color: '#c7d2fe' }} />}
        {isLive ? (
          <Typography sx={{ fontSize: '0.78rem', color: '#fca5a5', fontWeight: 700 }}>● LIVE</Typography>
        ) : hasKickoff && match.status === 'Scheduled' && countdown ? (
          <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)' }}>{countdown}</Typography>
        ) : (
          <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>
            {formatMatchMeta(match) || t('event_hub.kickoff_tbd')}
          </Typography>
        )}
      </Box>

      <Box className={styles.matchTeams}>
        <Box className={styles.matchTeam}>
          <span className={styles.matchFlag}>{match.teamAFlag}</span>
          <Typography className={styles.matchTeamName}>{match.teamAName}</Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          {isFinal || isLive ? (
            <Typography className={styles.matchScore}>
              {match.scoreA ?? 0} – {match.scoreB ?? 0}
            </Typography>
          ) : (
            <Typography className={styles.matchVs}>VS</Typography>
          )}
        </Box>
        <Box className={styles.matchTeam}>
          <span className={styles.matchFlag}>{match.teamBFlag}</span>
          <Typography className={styles.matchTeamName}>{match.teamBName}</Typography>
        </Box>
      </Box>

      {match.venue && (
        <Typography className={styles.matchMeta}>{match.venue}</Typography>
      )}

      {showPredict && (
        <WcInlinePredict
          eventId={eventId}
          match={match}
          isAuthenticated={isAuthenticated}
          onAuthRequired={onAuthRequired}
        />
      )}
    </Box>
  );
};
