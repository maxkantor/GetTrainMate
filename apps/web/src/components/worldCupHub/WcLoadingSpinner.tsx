import React from 'react';
import { Box, Typography } from '@mui/material';
import { WcTrophyLogo } from './WcTrophyLogo';
import styles from '@/pages/WorldCupV2.module.css';

type Props = {
  label?: string;
  minHeight?: string | number;
};

export const WcLoadingSpinner: React.FC<Props> = ({ label, minHeight = '60vh' }) => (
  <Box className={styles.wcLoadingWrap} sx={{ minHeight }}>
    <WcTrophyLogo size="lg" glow spin />
    {label ? <Typography className={styles.wcLoadingLabel}>{label}</Typography> : null}
  </Box>
);
