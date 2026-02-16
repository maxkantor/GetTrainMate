import React from 'react';
import styles from './Card.module.css';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  elevated = true,
  padding = 'md',
}) => (
  <div
    className={`${styles.card} ${elevated ? styles.elevated : ''} ${styles[padding]} ${className}`}
  >
    {children}
  </div>
);
