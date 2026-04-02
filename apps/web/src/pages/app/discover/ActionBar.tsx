import React from 'react';
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
  /** Mode-driven primary CTA, e.g. Train Together / Hang Out / Go on a Date */
  primaryCtaLabel: string;
  primaryCtaIcon?: string;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  onPass,
  onInterest,
  onViewProfile,
  onRewind,
  interestLoading,
  canRewind = false,
  primaryCtaLabel,
  primaryCtaIcon,
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
          <span className={styles.emoji} aria-hidden>
            ❌
          </span>
          {DISCOVER_STRINGS.skip}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnView}`}
          onClick={onViewProfile}
          disabled={interestLoading}
          aria-label={DISCOVER_STRINGS.viewProfile}
        >
          <span className={styles.emoji} aria-hidden>
            👁
          </span>
          <span className={styles.viewLabel}>{DISCOVER_STRINGS.viewProfile}</span>
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={onInterest}
          disabled={interestLoading}
          aria-label={primaryCtaLabel}
        >
          {interestLoading ? (
            <CircularProgress size={22} color="inherit" aria-hidden />
          ) : (
            <span className={styles.primaryEmoji} aria-hidden>
              {primaryCtaIcon ?? '✨'}
            </span>
          )}
          <span className={styles.primaryLabel}>{primaryCtaLabel}</span>
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
