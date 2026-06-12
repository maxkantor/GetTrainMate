import React from 'react';
import { Box, Typography } from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import styles from '@/pages/EventHub.module.css';

type Props = {
  title: string;
  description?: string;
  icon?: string;
};

export const ComingSoon: React.FC<Props> = ({ title, description, icon = '⚽' }) => {
  const { t } = useI18n();
  return (
    <Box className={styles.comingSoon}>
      <span className={styles.comingSoonIcon} aria-hidden>{icon}</span>
      <Typography variant="h5" className={styles.comingSoonTitle}>{title}</Typography>
      <Typography color="text.secondary" className={styles.comingSoonDesc}>
        {description ?? t('event_hub.coming_soon_default')}
      </Typography>
    </Box>
  );
};
