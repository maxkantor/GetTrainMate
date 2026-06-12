import React from 'react';
import { WC_BACKDROP_IMAGES } from '@/config/worldCupMedia';
import styles from '@/pages/WorldCupV2.module.css';

/** Fixed soccer stadium layers — visible across all World Cup hub tabs. */
export const WcCinematicBackdrop: React.FC = () => (
  <div className={styles.cinematicBackdrop} aria-hidden>
    <div
      className={styles.cinematicPhotoPrimary}
      style={{ backgroundImage: `url('${WC_BACKDROP_IMAGES.stadiumAerial}')` }}
    />
    <div
      className={styles.cinematicPhotoCrowd}
      style={{ backgroundImage: `url('${WC_BACKDROP_IMAGES.stadiumCrowd}')` }}
    />
    <div
      className={styles.cinematicPhotoPitch}
      style={{ backgroundImage: `url('${WC_BACKDROP_IMAGES.pitchAction}')` }}
    />
    <div
      className={styles.cinematicPhotoLights}
      style={{ backgroundImage: `url('${WC_BACKDROP_IMAGES.stadiumLights}')` }}
    />
    <div className={styles.cinematicVeil} />
    <div className={styles.cinematicGlow} />
    <div className={styles.cinematicGrain} />
    <div className={styles.cinematicVignette} />
  </div>
);
