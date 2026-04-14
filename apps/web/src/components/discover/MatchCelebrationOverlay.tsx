import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './MatchCelebrationOverlay.module.css';

export type MatchCelebrationState = {
  userId: string;
  name: string;
  photoUrl: string;
  matchId: string;
};

type Props = {
  open: boolean;
  celebration: MatchCelebrationState | null;
  onSendMessage: () => void;
  onKeepSwiping: () => void;
};

export const MatchCelebrationOverlay: React.FC<Props> = ({
  open,
  celebration,
  onSendMessage,
  onKeepSwiping,
}) => {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && celebration && (
        <motion.div
          className={styles.root}
          role="dialog"
          aria-modal="true"
          aria-labelledby="match-celebration-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className={styles.backdrop} aria-hidden />
          <motion.div
            className={styles.panel}
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          >
            <div className={styles.flame} aria-hidden>
              🔥
            </div>
            <h2 id="match-celebration-title" className={styles.title}>
              It&apos;s a match
            </h2>
            <p className={styles.sub}>You and {celebration.name} both want to train together.</p>
            <div className={styles.avatarWrap}>
              <img src={celebration.photoUrl} alt="" className={styles.avatar} width={120} height={120} />
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={onSendMessage}>
                Send message
              </button>
              <button type="button" className={styles.secondary} onClick={onKeepSwiping}>
                Keep swiping
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
