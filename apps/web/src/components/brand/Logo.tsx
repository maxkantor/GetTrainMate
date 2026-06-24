import React from 'react';
import { GtmMarkSvg, type GtmMarkSvgProps } from './GtmMarkSvg';
import styles from './Logo.module.css';

export type LogoSize = 'xs' | 'sm' | 'nav' | 'md' | 'lg';

const SIZE_PX: Record<LogoSize, number> = {
  xs: 20,
  sm: 24,
  nav: 30,
  md: 32,
  lg: 44,
};

export type LogoIconProps = {
  size?: LogoSize;
  className?: string;
  title?: string;
  variant?: GtmMarkSvgProps['variant'];
};

export const LogoIcon: React.FC<LogoIconProps> = ({
  size = 'md',
  className,
  title,
  variant = 'navbar',
}) => (
  <GtmMarkSvg size={SIZE_PX[size]} className={className} title={title} variant={variant} />
);

export type LogoFullProps = {
  label?: string;
  size?: LogoSize;
  compact?: boolean;
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  variant?: GtmMarkSvgProps['variant'];
};

/** Icon + GetTrainMate wordmark */
export const LogoFull: React.FC<LogoFullProps> = ({
  label = 'GetTrainMate',
  size = 'md',
  compact = false,
  className,
  iconClassName,
  textClassName,
  variant = 'navbar',
}) => (
  <span className={[styles.full, compact ? styles.compact : '', className].filter(Boolean).join(' ')}>
    <LogoIcon
      size={compact ? 'sm' : size}
      variant={variant}
      className={[styles.icon, iconClassName].filter(Boolean).join(' ')}
    />
    <span className={[styles.wordmark, textClassName].filter(Boolean).join(' ')}>{label}</span>
  </span>
);
