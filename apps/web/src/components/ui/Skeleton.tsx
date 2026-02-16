import React from 'react';
import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height,
  borderRadius = 'var(--radius-md)',
  className = '',
}) => (
  <div
    className={`${styles.skeleton} ${className}`}
    style={{
      width: typeof width === 'number' ? `${width}px` : width,
      height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
      borderRadius,
    }}
    aria-hidden
  />
);

export const ProfileCardSkeleton: React.FC = () => (
  <div className={styles.profileCardSkeleton}>
    <Skeleton height={400} borderRadius="0" />
    <div className={styles.profileCardContent}>
      <Skeleton width="60%" height={28} />
      <Skeleton width="40%" height={20} />
      <Skeleton width="100%" height={48} />
      <Skeleton width="80%" height={48} />
    </div>
  </div>
);
