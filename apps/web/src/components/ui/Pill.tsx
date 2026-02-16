import React from 'react';
import styles from './Pill.module.css';

interface PillProps {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
}

export const Pill: React.FC<PillProps> = ({ children, active = false, className = '' }) => (
  <span className={`${styles.pill} ${active ? styles.active : ''} ${className}`}>{children}</span>
);
