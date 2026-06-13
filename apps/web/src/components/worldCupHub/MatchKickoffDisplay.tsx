import React from 'react';
import { Box } from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { formatI18n } from '@/i18n';
import { useMatchCountdown, MATCH_COUNTDOWN_IN_PROGRESS } from '@/hooks/useMatchCountdown';
import type { EventMatch } from '@/services/sportsEventLayerService';
import { formatKickoffCard } from '@/utils/eventMatchUtils';
import styles from '@/pages/WorldCupV2.module.css';

type Props = {
  match: EventMatch;
};

/** Local date/time + countdown for premium match cards. */
export const MatchKickoffDisplay: React.FC<Props> = ({ match }) => {
  const { t } = useI18n();
  const hasKickoff = Boolean(match.matchDate?.trim() && match.matchTime?.trim());
  const countdown = useMatchCountdown(hasKickoff ? match.matchDate : '', hasKickoff ? match.matchTime : undefined);
  const kickoff = formatKickoffCard(match.matchDate, match.matchTime);

  if (!kickoff) {
    return <span className={styles.matchKickoffTbd}>{t('event_hub.kickoff_tbd')}</span>;
  }

  const dateLabel = kickoff.dateLabel === 'Today'
    ? t('event_hub.kickoff_today')
    : kickoff.dateLabel === 'Tomorrow'
      ? t('event_hub.kickoff_tomorrow')
      : kickoff.dateLabel;
  const fullLabel = `${dateLabel} · ${kickoff.timeLabel}`;

  return (
    <Box className={styles.matchKickoff}>
      <Box className={styles.matchKickoffBar} title={fullLabel}>
        <span className={styles.matchKickoffDate}>{dateLabel}</span>
        <span className={styles.matchKickoffTime}>{kickoff.timeLabel}</span>
      </Box>
      {match.status === 'Scheduled' && countdown && (
        countdown === MATCH_COUNTDOWN_IN_PROGRESS ? (
          <span className={styles.matchKickoffAwaiting}>{t('event_hub.kickoff_awaiting')}</span>
        ) : (
          <span className={styles.matchKickoffCountdown}>
            {formatI18n(t('event_hub.starts_in'), { time: countdown })}
          </span>
        )
      )}
      {match.status === 'Live' && (
        <span className={styles.matchKickoffLive}>{t('event_hub.status_live_now')}</span>
      )}
      {match.status === 'Completed' && (
        <span className={styles.matchKickoffFinal}>{t('event_hub.status_final')}</span>
      )}
    </Box>
  );
};
