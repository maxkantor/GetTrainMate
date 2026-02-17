import React from 'react';
import styles from './DiscoverLayout.module.css';

interface DiscoverLayoutProps {
  topBar: React.ReactNode;
  headerRow: React.ReactNode;
  progressBar: React.ReactNode;
  card: React.ReactNode;
  panel: React.ReactNode;
  actionBar: React.ReactNode;
  banner?: React.ReactNode;
}

export const DiscoverLayout: React.FC<DiscoverLayoutProps> = ({
  topBar,
  headerRow,
  progressBar,
  card,
  panel,
  actionBar,
  banner,
}) => {
  return (
    <div className={styles.layout}>
      <div className={styles.topBar}>{topBar}</div>
      {banner}
      {headerRow}
      {progressBar}
      <div className={styles.main}>
        <div className={styles.cardCol}>{card}</div>
        <div className={styles.panelCol}>{panel}</div>
      </div>
      <div className={styles.actionBarWrap}>{actionBar}</div>
    </div>
  );
};
