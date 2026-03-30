import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './CreditsPill.module.css';

interface CreditsPillProps {
  credits: number;
  lifetimeEarned: number;
  className?: string;
}

export const CreditsPill: React.FC<CreditsPillProps> = ({ credits, lifetimeEarned, className }) => {
  const max = Math.max(lifetimeEarned, 1);
  const pct = Math.min(100, Math.round((credits / max) * 100));
  const prev = useRef(credits);
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (credits < prev.current) {
      prev.current = credits;
      return;
    }
    if (credits > prev.current) {
      setBurst(true);
      const t = window.setTimeout(() => setBurst(false), 900);
      prev.current = credits;
      return () => window.clearTimeout(t);
    }
    prev.current = credits;
  }, [credits]);

  return (
    <div className={`${styles.wrap} ${className ?? ''}`}>
      <motion.div
        className={`${styles.pill} ${burst ? styles.pillBurst : ''}`}
        layout
        title="Credits unlock AI matches and priority discovery"
        role="img"
        aria-label={`${credits} of ${max} credits remaining`}
      >
        <div className={styles.shimmer} aria-hidden />
        <div className={styles.inner}>
          <span className={styles.values}>
            <AnimatePresence mode="popLayout">
              <motion.span
                key={credits}
                className={styles.num}
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 8, opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                {credits}
              </motion.span>
            </AnimatePresence>
            <span className={styles.sep}>/</span>
            <span className={styles.den}>{max}</span>
          </span>
          <span className={styles.label}>credits</span>
        </div>
        <div className={styles.barTrack}>
          <motion.div
            className={styles.barFill}
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 22 }}
          />
        </div>
      </motion.div>
      <p className={styles.tooltipHint}>Credits unlock AI matches and priority discovery</p>
    </div>
  );
};
