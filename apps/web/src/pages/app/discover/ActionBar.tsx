import React from 'react';
import CloseIcon from '@mui/icons-material/Close';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import styles from './ActionBar.module.css';

interface ActionBarProps {
  onPass: () => void;
  onLike: () => void;
  onConnect: () => void;
  onUndo?: () => void;
  likeLoading: boolean;
  credits: number;
  /** Match % for the current card; drives Connect button label (no default “strong” for low scores). */
  compatibilityScore?: number;
  canUndo: boolean;
  showUndo: boolean;
}

function connectLabel(score: number | undefined): string {
  if (score === undefined) return 'Connect';
  if (score >= 80) return 'Strong Match';
  if (score >= 60) return 'Good Match';
  return 'Connect';
}

export const ActionBar: React.FC<ActionBarProps> = ({
  onPass,
  onLike,
  onConnect,
  onUndo,
  likeLoading,
  credits,
  compatibilityScore,
  canUndo,
  showUndo,
}) => {
  const connect = connectLabel(compatibilityScore);
  const connectAria =
    compatibilityScore === undefined
      ? 'Connect — open profile'
      : compatibilityScore >= 80
        ? 'Strong match — open profile'
        : compatibilityScore >= 60
          ? 'Good match — open profile'
          : 'Connect — open profile';

  return (
    <div className={styles.wrapper}>
      <div className={styles.bar}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPass}`}
          onClick={onPass}
          disabled={likeLoading}
          aria-label="Skip this profile"
        >
          <CloseIcon className={styles.icon} aria-hidden />
          Skip
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnLike}`}
          onClick={onLike}
          disabled={likeLoading}
          aria-label="Train — like this profile"
        >
          <FitnessCenterIcon className={styles.icon} aria-hidden />
          Train
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnConnect}`}
          onClick={onConnect}
          aria-label={connectAria}
        >
          <WhatshotIcon className={styles.icon} aria-hidden />
          <span className={styles.connectLabel}>{connect}</span>
          {credits >= 1 && <span className={styles.creditHint}>1 credit</span>}
        </button>
      </div>
      {showUndo && canUndo && onUndo && (
        <button type="button" className={styles.undoBtn} onClick={onUndo} aria-label="Undo last action">
          Undo
        </button>
      )}
    </div>
  );
};
