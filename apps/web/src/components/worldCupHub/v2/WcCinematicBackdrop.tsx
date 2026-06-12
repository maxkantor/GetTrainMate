import React from 'react';
import styles from '@/pages/WorldCupV2.module.css';

/** Fixed soccer stadium layers — visible across all World Cup hub tabs. */
export const WcCinematicBackdrop: React.FC = () => (
  <div className={styles.cinematicBackdrop} aria-hidden>
    <div className={styles.cinematicPhotoPrimary} />
    <div className={styles.cinematicPhotoAccent} />
    <div className={styles.cinematicVeil} />
    <div className={styles.cinematicGlow} />
    <div className={styles.cinematicGrain} />
    <div className={styles.cinematicVignette} />
  </div>
);
