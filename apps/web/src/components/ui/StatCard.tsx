import React from 'react';
import styles from './StatCard.module.css';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, subtitle, trend }) => (
  <div className={styles.root}>
    <span className={styles.label}>{label}</span>
    <span className={styles.value}>{value}</span>
    {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
    {trend && <span className={`${styles.trend} ${styles[trend]}`} />}
  </div>
);
