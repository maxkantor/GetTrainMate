import React from 'react';
import styles from './DashboardStatCards.module.css';

type Stat = {
  label: string;
  value: string | number;
  highlight?: boolean;
};

type Props = {
  stats: Stat[];
};

export const DashboardStatCards: React.FC<Props> = ({ stats }) => (
  <div className={styles.grid}>
    {stats.map((stat) => (
      <div key={stat.label} className={styles.card}>
        <div className={styles.label}>{stat.label}</div>
        <div className={`${styles.value} ${stat.highlight ? styles.valueHighlight : ''}`}>
          {stat.value}
        </div>
      </div>
    ))}
  </div>
);
