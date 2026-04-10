import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/hooks/useI18n';
import styles from './LiveMatchFeed.module.css';

const FEED_KEYS = [
  'landing.live_feed_1',
  'landing.live_feed_2',
  'landing.live_feed_3',
  'landing.live_feed_4',
  'landing.live_feed_5',
] as const;

export const LiveMatchFeed: React.FC = () => {
  const { t } = useI18n();
  const feedItems = useMemo(
    () =>
      FEED_KEYS.map((key, i) => ({
        id: String(i + 1),
        text: t(key),
      })),
    [t]
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % feedItems.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [feedItems.length]);

  const item = feedItems[index];

  return (
    <div className={styles.wrap} aria-live="polite" aria-atomic="true">
      <div className={styles.label}>
        <span className={styles.pulse} aria-hidden />
        {t('landing.showcase_live')}
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
