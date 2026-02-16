import React from 'react';
import styles from './Avatar.module.css';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = '',
  fallback = '?',
  size = 'md',
  className = '',
}) => (
  <div className={`${styles.avatar} ${styles[size]} ${className}`}>
    {src ? (
      <img src={src} alt={alt} referrerPolicy="no-referrer" />
    ) : (
      <span className={styles.fallback}>{fallback}</span>
    )}
  </div>
);
