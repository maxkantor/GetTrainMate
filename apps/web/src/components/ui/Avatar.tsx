import React, { useState, useEffect } from 'react';
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
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(src) && !imgFailed;

  useEffect(() => {
    setImgFailed(false);
  }, [src]);

  return (
    <div className={`${styles.avatar} ${styles[size]} ${className}`}>
      {showImage ? (
        <img
          src={src!}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className={styles.fallback}>{fallback}</span>
      )}
    </div>
  );
};
