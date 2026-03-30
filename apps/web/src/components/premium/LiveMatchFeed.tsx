import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './LiveMatchFeed.module.css';

const FEED_ITEMS = [
  { id: '1', text: 'Sofia matched with Marcus — HYROX' },
  { id: '2', text: 'Alex found a 5AM running partner' },
  { id: '3', text: '3 new matches near Atlanta' },
  { id: '4', text: 'Jordan + Riley — same gym, new PRs' },
  { id: '5', text: '12 swimmers connected this hour' },
];

export const LiveMatchFeed: React.FC = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % FEED_ITEMS.length);
    }, 4200);
    return () => window.clearInterval(t);
  }, []);

  const item = FEED_ITEMS[index];

  return (
    <div className={styles.wrap} aria-live="polite" aria-atomic="true">
      <div className={styles.label}>
        <span className={styles.pulse} aria-hidden />
        Live activity
      </div>
      <div className={styles.stack}>
        <AnimatePresence mode="wait">
          <motion.div
            key={item.id}
            className={styles.card}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ scale: 1.02 }}
          >
            {item.text}
          </motion.div>
        </AnimatePresence>
        {/* Decorative floating layers */}
        <motion.div
          className={styles.floatBack}
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden
        />
        <motion.div
          className={styles.floatMid}
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          aria-hidden
        />
      </div>
    </div>
  );
};
