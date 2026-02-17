import React from 'react';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import StarIcon from '@mui/icons-material/Star';
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
          aria-label="Pass on this profile"
        >
          <ThumbDownIcon className={styles.icon} aria-hidden />
          Pass
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnLike}`}
          onClick={onLike}
          disabled={likeLoading}
          aria-label="Like this profile"
        >
          <ThumbUpIcon className={styles.icon} aria-hidden />
          Like
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnConnect}`}
          onClick={onConnect}
          aria-label="Priority Connect - view full profile"
        >
          <StarIcon className={styles.icon} aria-hidden />
          <span className={styles.connectLabel}>Priority Connect</span>
          {credits >= 1 && (
            <span className={styles.creditHint}>1 credit</span>
          )}
        </button>
      </div>
      {showUndo && canUndo && onUndo && (
        <button
          type="button"
          className={styles.undoBtn}
          onClick={onUndo}
          aria-label="Undo last action"
        >
          Undo
        </button>
      )}
    </div>
  );
};
