import React from 'react';
import { Box, Typography } from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { formatI18n } from '@/i18n';
import { useMatchCountdown } from '@/hooks/useMatchCountdown';
import type { EventMatch } from '@/services/sportsEventLayerService';
import { formatKickoffCompact } from '@/utils/eventMatchUtils';
import styles from '@/pages/WorldCupV2.module.css';

type Props = {
  match: EventMatch;
};

/** Friendly local date/time plus countdown or final label for match cards. */
export const MatchKickoffDisplay: React.FC<Props> = ({ match }) => {
  const { t } = useI18n();
  const hasKickoff = Boolean(match.matchDate?.trim() && match.matchTime?.trim());
  const countdown = useMatchCountdown(hasKickoff ? match.matchDate : '', hasKickoff ? match.matchTime : undefined);
  const friendly = formatKickoffCompact(match.matchDate, match.matchTime);

  if (!friendly) {
    return (
      <Typography className={styles.matchKickoffTbd}>
        {t('event_hub.kickoff_tbd')}
      </Typography>
    );
  }

  return (
    <Box className={styles.matchKickoff}>
      <Typography className={styles.matchKickoffDate} noWrap title={friendly}>
        {friendly}
      </Typography>
      {match.status === 'Scheduled' && countdown && (
        <Typography className={styles.matchKickoffCountdown}>
          {formatI18n(t('event_hub.starts_in'), { time: countdown })}
        </Typography>
      )}
      {match.status === 'Live' && (
        <Typography className={styles.matchKickoffLive}>
          {t('event_hub.status_live_now')}
        </Typography>
      )}
      {match.status === 'Completed' && (
        <Typography className={styles.matchKickoffFinal}>
          {t('event_hub.status_final')}
        </Typography>
      )}
    </Box>
  );
};
