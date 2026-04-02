import React from 'react';
import CloseIcon from '@mui/icons-material/Close';
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { CircularProgress } from '@mui/material';
import { DISCOVER_STRINGS } from './constants';
import styles from './ActionBar.module.css';

interface ActionBarProps {
  onPass: () => void;
  onInterest: () => void;
  onViewProfile: () => void;
  onRewind?: () => void;
  interestLoading: boolean;
  canRewind?: boolean;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  onPass,
  onInterest,
  onViewProfile,
  onRewind,
  interestLoading,
  canRewind = false,
}) => {
  return (
    <div className={styles.wrapper}>
      <div className={styles.bar}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPass}`}
          onClick={onPass}
          disabled={interestLoading}
          aria-label={`${DISCOVER_STRINGS.skip} this profile`}
        >
          <CloseIcon className={styles.icon} aria-hidden />
          {DISCOVER_STRINGS.skip}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnView}`}
          onClick={onViewProfile}
          disabled={interestLoading}
          aria-label={DISCOVER_STRINGS.viewProfile}
        >
          <InfoOutlinedIcon className={styles.icon} aria-hidden />
          <span className={styles.viewLabel}>{DISCOVER_STRINGS.viewProfile}</span>
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={onInterest}
          disabled={interestLoading}
          aria-label={DISCOVER_STRINGS.wantToTrain}
        >
          {interestLoading ? (
            <CircularProgress size={22} color="inherit" aria-hidden />
          ) : (
            <FavoriteBorderOutlinedIcon className={styles.icon} aria-hidden />
          )}
          <span className={styles.primaryLabel}>{DISCOVER_STRINGS.wantToTrain}</span>
        </button>
      </div>
      {canRewind && onRewind && (
        <button type="button" className={styles.rewindBtn} onClick={onRewind} aria-label="Restore last skipped profile">
          Rewind last skip
        </button>
      )}
    </div>
  );
};
