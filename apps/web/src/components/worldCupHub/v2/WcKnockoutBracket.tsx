import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { formatI18n } from '@/i18n';
import { useI18n } from '@/hooks/useI18n';
import { CountryFlag } from '@/components/worldCupHub/CountryFlag';
import type { EventHubSnapshot } from '@/services/sportsEventLayerService';
import {
  BRACKET_COLUMN_LABELS,
  BRACKET_GRID_COLUMNS,
  BRACKET_GRID_ROWS,
} from '@/config/worldCupBracketLayout';
import {
  buildKnockoutBracketView,
  countKnownKnockoutTeams,
  type BracketMatchView,
} from '@/utils/buildKnockoutBracketView';
import { formatKickoffCompact } from '@/utils/eventMatchUtils';
import styles from '@/pages/WorldCupV2.module.css';

type Props = {
  hub: EventHubSnapshot;
  compact?: boolean;
};

const BracketTeamRow: React.FC<{
  side: BracketMatchView['teamA'];
  score?: number;
  showScore: boolean;
}> = ({ side, score, showScore }) => (
  <Box
    className={`${styles.bracketTeamRow} ${side.isWinner ? styles.bracketTeamWinner : ''} ${side.isLoser ? styles.bracketTeamLoser : ''}`}
  >
    {side.isTbd ? (
      <span className={styles.bracketTbdFlag}>?</span>
    ) : (
      <CountryFlag teamId={side.teamId} flagEmoji={side.flagEmoji} size={18} className={styles.bracketFlag} alt="" />
    )}
    <span className={styles.bracketTeamName}>{side.name}</span>
    {showScore && score != null && (
      <span className={styles.bracketScore}>{score}</span>
    )}
  </Box>
);

const BracketMatchCell: React.FC<{ cell: BracketMatchView; compact?: boolean }> = ({ cell, compact }) => {
  const { t } = useI18n();
  const showScore = cell.isCompleted || cell.isLive;
  const kickoff = formatKickoffCompact(cell.matchDate, cell.matchTime);
  const isFinal = cell.matchId === 'final';
  const isThird = cell.matchId === 'third-place';

  return (
    <Box
      className={`${styles.bracketMatch} ${cell.isLive ? styles.bracketMatchLive : ''} ${isFinal ? styles.bracketMatchFinal : ''} ${isThird ? styles.bracketMatchThird : ''} ${compact ? styles.bracketMatchCompact : ''}`}
      data-col={cell.col}
      style={{
        gridColumn: cell.col + 1,
        gridRow: `${cell.row} / span ${cell.rowSpan}`,
      }}
      title={kickoff ?? undefined}
    >
      {cell.isLive && (
        <span className={styles.bracketLiveBadge}>{t('event_hub.status_live')}</span>
      )}
      <BracketTeamRow side={cell.teamA} score={cell.scoreA} showScore={showScore} />
      <BracketTeamRow side={cell.teamB} score={cell.scoreB} showScore={showScore} />
      {!compact && kickoff && !cell.isCompleted && (
        <span className={styles.bracketKickoff}>{kickoff}</span>
      )}
      {cell.decidedOnPenalties && (
        <span className={styles.bracketPensBadge}>{t('event_hub.won_on_pens')}</span>
      )}
    </Box>
  );
};

export const WcKnockoutBracket: React.FC<Props> = ({ hub, compact = false }) => {
  const { t } = useI18n();
  const cells = useMemo(
    () => buildKnockoutBracketView(hub.matches, hub.teams),
    [hub.matches, hub.teams],
  );
  const knownTeams = useMemo(() => countKnownKnockoutTeams(cells), [cells]);
  const updatedAt = hub.fixturesLastUpdatedAt;

  const updatedLabel = updatedAt
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(updatedAt))
    : null;

  return (
    <Box className={styles.bracketPanel}>
      <Box className={styles.bracketHeader}>
        <Box>
          <Typography className={styles.bracketTitle}>{t('event_hub.knockout_bracket_title')}</Typography>
          <Typography className={styles.bracketLead}>{t('event_hub.knockout_bracket_lead')}</Typography>
        </Box>
        <Box className={styles.bracketMeta}>
          <span className={styles.bracketMetaChip}>
            {formatI18n(t('event_hub.knockout_bracket_teams'), { count: knownTeams })}
          </span>
          {updatedLabel && (
            <span className={styles.bracketMetaUpdated}>
              {formatI18n(t('event_hub.knockout_bracket_updated'), { time: updatedLabel })}
            </span>
          )}
        </Box>
      </Box>

      <Box className={styles.bracketScroll} role="region" aria-label={t('event_hub.knockout_bracket_title')}>
        <Box
          className={styles.bracketColumnLabels}
          style={{ gridTemplateColumns: `repeat(${BRACKET_GRID_COLUMNS}, minmax(7.5rem, 1fr))` }}
        >
          {BRACKET_COLUMN_LABELS.map(({ col, labelKey }) => (
            <span key={`${col}-${labelKey}`} style={{ gridColumn: col + 1 }}>
              {t(labelKey)}
            </span>
          ))}
        </Box>

        <Box
          className={styles.bracketGrid}
          style={{
            gridTemplateColumns: `repeat(${BRACKET_GRID_COLUMNS}, minmax(7.5rem, 1fr))`,
            gridTemplateRows: `repeat(${BRACKET_GRID_ROWS}, minmax(2.6rem, auto))`,
          }}
        >
          {cells.map((cell) => (
            <BracketMatchCell key={cell.matchId} cell={cell} compact={compact} />
          ))}
        </Box>
      </Box>
    </Box>
  );
};
