import React from 'react';
import { Alert, Snackbar } from '@mui/material';
import { WcTrophyLogo } from './WcTrophyLogo';
import styles from '@/pages/WorldCupV2.module.css';

type Props = {
  open: boolean;
  message: string | null;
  onClose: () => void;
  duration?: number;
};

/** World Cup toast with trophy avatar — predictions, leaderboard, match alerts. */
export const WcToast: React.FC<Props> = ({ open, message, onClose, duration = 4000 }) => (
  <Snackbar
    open={open && Boolean(message)}
    autoHideDuration={duration}
    onClose={onClose}
    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
  >
    <Alert
      severity="success"
      onClose={onClose}
      icon={<WcTrophyLogo size="nav" />}
      sx={{ width: '100%', alignItems: 'center' }}
      className={styles.wcToast}
    >
      {message}
    </Alert>
  </Snackbar>
);
