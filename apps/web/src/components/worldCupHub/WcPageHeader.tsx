import React from 'react';
import { Box, Typography } from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { WcTrophyLogo } from './WcTrophyLogo';
import styles from '@/pages/WorldCupV2.module.css';

type Props = {
  compact?: boolean;
};

/** Shared World Cup page header — non-overview tabs. */
export const WcPageHeader: React.FC<Props> = ({ compact }) => {
  const { t } = useI18n();

  return (
    <Box className={`${styles.wcPageHeader} ${compact ? styles.wcPageHeaderCompact : ''}`}>
      <WcTrophyLogo size={compact ? 'md' : 'hero'} glow hoverable />
      <Box>
        <Typography className={styles.wcPageHeaderTitle}>{t('event_hub.nav_label')}</Typography>
        <Typography className={styles.wcPageHeaderTagline}>{t('event_hub.page_header_tagline')}</Typography>
      </Box>
    </Box>
  );
};
