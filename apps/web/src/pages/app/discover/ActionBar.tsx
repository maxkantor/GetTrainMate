import React from 'react';
import { CircularProgress } from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
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
  const { t } = useI18n();
  return (
    <div className={styles.wrapper}>
      <div className={styles.bar}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPass}`}
          onClick={onPass}
          disabled={interestLoading}
          aria-label={t('discover.skip_this_profile')}
        >
          <span className={styles.emoji} aria-hidden>
            ❌
          </span>
          {t('discover.skip')}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnView}`}
          onClick={onViewProfile}
          disabled={interestLoading}
          aria-label={t('discover.view_profile')}
        >
          <span className={styles.emoji} aria-hidden>
            👁
          </span>
          <span className={styles.viewLabel}>{t('discover.view_profile')}</span>
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
        <button type="button" className={styles.rewindBtn} onClick={onRewind} aria-label={t('discover.rewind_aria')}>
          {t('discover.rewind_label')}
        </button>
      )}
    </div>
  );
};
