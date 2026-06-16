import React from 'react';
import { Box, Typography } from '@mui/material';
import { WcTrophyLogo } from './WcTrophyLogo';
import styles from '@/pages/WorldCupV2.module.css';

type Props = {
  children: React.ReactNode;
  className?: string;
};

/** Section title with trophy mark — World Cup pages only. */
export const WcSectionTitle: React.FC<Props> = ({ children, className = '' }) => (
  <Box className={`${styles.wcSectionTitleRow} ${className}`}>
    <WcTrophyLogo size="sm" glow />
    <Typography component="h2" className={styles.sectionTitle} sx={{ mb: 0 }}>
      {children}
    </Typography>
  </Box>
);
