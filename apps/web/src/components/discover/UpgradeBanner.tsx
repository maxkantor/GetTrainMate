import React from 'react';
import { Link } from 'react-router-dom';
import { analytics } from '@/utils/analytics';
import styles from './UpgradeBanner.module.css';

interface UpgradeBannerProps {
  message?: string;
}

export const UpgradeBanner: React.FC<UpgradeBannerProps> = ({
  message = 'Get more credits to keep liking and connecting.',
}) => (
  <div className={styles.banner}>
    <p className={styles.text}>{message}</p>
    <Link
      to="/pricing"
      className={styles.btn}
      onClick={() => analytics.pricingOpened('upgrade_banner')}
    >
      Upgrade
    </Link>
  </div>
);
