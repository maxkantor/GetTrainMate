import React from 'react';
import { Box, Typography } from '@mui/material';
import { WcTrophyLogo } from './WcTrophyLogo';
import styles from '@/pages/WorldCupV2.module.css';

type Props = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export const WcEmptyState: React.FC<Props> = ({ title, description, action }) => (
  <Box className={styles.emptyPremium}>
    <WcTrophyLogo size="xl" faded />
    <Typography className={styles.emptyTitle}>{title}</Typography>
    {description ? <Typography className={styles.emptyDesc}>{description}</Typography> : null}
    {action}
  </Box>
);
