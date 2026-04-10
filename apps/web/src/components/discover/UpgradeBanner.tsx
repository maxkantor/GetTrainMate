import React from 'react';
import { Link } from 'react-router-dom';
import { analytics } from '@/utils/analytics';
import { useI18n } from '@/hooks/useI18n';
import styles from './UpgradeBanner.module.css';

interface UpgradeBannerProps {
  message?: string;
}

export const UpgradeBanner: React.FC<UpgradeBannerProps> = ({ message }) => {
  const { t } = useI18n();
  const text = message ?? t('credits.upgrade_banner_default');
  return (
    <div className={styles.banner}>
      <p className={styles.text}>{text}</p>
      <Link
        to="/pricing"
        className={styles.btn}
        onClick={() => analytics.pricingOpened('upgrade_banner')}
      >
        {t('header.get_credits')}
      </Link>
    </div>
  );
};
