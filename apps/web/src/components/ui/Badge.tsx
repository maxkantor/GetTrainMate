import React from 'react';
import styles from './Badge.module.css';

type Variant = 'primary' | 'success' | 'warning' | 'neutral' | 'accent' | 'error';

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', className = '' }) => (
  <span className={`${styles.badge} ${styles[variant]} ${className}`}>{children}</span>
);
