import React from 'react';
import { Box, Typography } from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { WcTrophyLogo } from './WcTrophyLogo';
import type { WcFanBadgeKind } from '@/utils/wcFanBadges';
import styles from '@/pages/WorldCupV2.module.css';

type Props = {
  kind: WcFanBadgeKind;
};

const I18N_KEY: Record<WcFanBadgeKind, string> = {
  fan: 'event_hub.badge_wc_fan',
  expert: 'event_hub.badge_prediction_expert',
  elite: 'event_hub.badge_elite_predictor',
};

export const WcFanBadge: React.FC<Props> = ({ kind }) => {
  const { t } = useI18n();
  return (
    <Box className={styles.wcFanBadge} component="span">
      <WcTrophyLogo size="nav" />
      <Typography component="span" className={styles.wcFanBadgeText}>
        {t(I18N_KEY[kind])}
      </Typography>
    </Box>
  );
};
