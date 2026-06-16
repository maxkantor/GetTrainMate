import React from 'react';
import { WC_TROPHY_LOGO_SRC } from '@/config/worldCupMedia';
import styles from './WcTrophyLogo.module.css';

export type WcTrophySize = 'nav' | 'sm' | 'md' | 'hero' | 'lg' | 'xl';

type Props = {
  size?: WcTrophySize;
  className?: string;
  glow?: boolean;
  hoverable?: boolean;
  spin?: boolean;
  faded?: boolean;
  podium?: 'gold' | 'silver' | 'bronze';
  alt?: string;
};

const sizeClass: Record<WcTrophySize, string> = {
  nav: styles.nav,
  sm: styles.sm,
  md: styles.md,
  hero: styles.hero,
  lg: styles.lg,
  xl: styles.xl,
};

const podiumClass = {
  gold: styles.podiumGold,
  silver: styles.podiumSilver,
  bronze: styles.podiumBronze,
} as const;

export const WcTrophyLogo: React.FC<Props> = ({
  size = 'nav',
  className = '',
  glow = false,
  hoverable = false,
  spin = false,
  faded = false,
  podium,
  alt = 'FIFA World Cup 2026',
}) => {
  const rootClass = [
    styles.root,
    sizeClass[size],
    glow ? styles.glow : '',
    hoverable ? styles.hoverable : '',
    spin ? styles.spin : '',
    faded ? styles.faded : '',
    podium ? podiumClass[podium] : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <span className={rootClass} aria-hidden={alt === ''}>
      <img className={styles.img} src={WC_TROPHY_LOGO_SRC} alt={alt} decoding="async" />
    </span>
  );
};
