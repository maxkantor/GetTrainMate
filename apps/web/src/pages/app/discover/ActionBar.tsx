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
  canUndo: boolean;
  showUndo: boolean;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  onPass,
  onLike,
  onConnect,
  onUndo,
  likeLoading,
  credits,
  canUndo,
  showUndo,
}) => {
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
          aria-label="Strong match — open profile"
        >
          <WhatshotIcon className={styles.icon} aria-hidden />
          <span className={styles.connectLabel}>Strong Match</span>
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
