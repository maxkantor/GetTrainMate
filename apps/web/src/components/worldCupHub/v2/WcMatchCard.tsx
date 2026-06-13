import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { useWcDisplay } from '@/hooks/useWcDisplay';
import type { EventMatch } from '@/services/sportsEventLayerService';
import { CountryFlag } from '@/components/worldCupHub/CountryFlag';
import { MatchKickoffDisplay } from '@/components/worldCupHub/MatchKickoffDisplay';
import { isTbdMatch } from '@/utils/eventMatchUtils';
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
  if (status === 'Live') return t('event_hub.status_live');
  if (status === 'Completed') return t('event_hub.status_final');
  if (status === 'Postponed') return t('event_hub.status_postponed');
  return t('event_hub.status_upcoming');
};

export const WcMatchCard: React.FC<Props> = ({
  eventId, match, groupLabel, isAuthenticated, onAuthRequired, showPredict = true,
}) => {
  const { t } = useI18n();
  const { teamName } = useWcDisplay();
  const isFinal = match.status === 'Completed';
  const isLive = match.status === 'Live';
  const isTbd = isTbdMatch(match);

  if (isTbd) {
    return (
      <Box className={`${styles.matchCard} ${styles.matchCardTbd}`}>
        <Box className={styles.matchTop}>
          <Box className={styles.matchTopChips}>
            <Chip size="small" label={statusLabel(match.status, t)} className={statusClass(match.status)} />
            <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>
              {match.stage}
            </Typography>
          </Box>
        </Box>
        <Box className={styles.matchTeams}>
          <Box className={styles.matchTeam}>
            <span className={`${styles.matchFlag} ${styles.matchFlagTbd}`}>❔</span>
            <Typography className={`${styles.matchTeamName} ${styles.matchTeamNameTbd}`}>
              {t('event_hub.teams_tbd')}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography className={styles.matchVs}>{t('event_hub.vs').toUpperCase()}</Typography>
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
      <Box className={styles.matchCardHeader}>
        <Box className={styles.matchCardHeaderRow}>
          <Box className={styles.matchTopChips}>
            <Chip
              size="small"
              label={statusLabel(match.status, t)}
              className={isLive ? styles.statusLive : statusClass(match.status)}
            />
            {match.isFeatured && (
              <Chip size="small" label="★" sx={{ bgcolor: 'rgba(251,191,36,0.2)', color: '#fde68a' }} />
            )}
          </Box>
          {groupLabel && <span className={styles.matchGroupPill}>{groupLabel}</span>}
        </Box>
        <MatchKickoffDisplay match={match} />
      </Box>

      <Box className={styles.matchTeams}>
        <Box className={styles.matchTeam}>
          <CountryFlag teamId={match.teamAId} flagEmoji={match.teamAFlag} size={40} className={styles.matchFlag} alt={teamName(match.teamAId, match.teamAName)} />
          <Typography className={styles.matchTeamName}>{teamName(match.teamAId, match.teamAName)}</Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          {isFinal || isLive ? (
            <Typography className={styles.matchScore}>
              {match.scoreA ?? 0} – {match.scoreB ?? 0}
            </Typography>
          ) : (
            <Typography className={styles.matchVs}>{t('event_hub.vs').toUpperCase()}</Typography>
          )}
        </Box>
        <Box className={styles.matchTeam}>
          <CountryFlag teamId={match.teamBId} flagEmoji={match.teamBFlag} size={40} className={styles.matchFlag} alt={teamName(match.teamBId, match.teamBName)} />
          <Typography className={styles.matchTeamName}>{teamName(match.teamBId, match.teamBName)}</Typography>
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
