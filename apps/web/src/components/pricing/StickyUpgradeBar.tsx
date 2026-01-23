import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import styles from './StickyUpgradeBar.module.css';

export const StickyUpgradeBar: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const getPricingThreshold = () => {
      const section = document.getElementById('pricing-plans');
      if (!section) return 600; // fallback
      const rect = section.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const height = rect.height;
      // Show after user has scrolled past most of the pricing cards section
      return top + height - window.innerHeight * 0.4;
    };

    let threshold = getPricingThreshold();

    const handleScroll = () => {
      const isMobile = window.innerWidth <= 768;
      setIsVisible(isMobile && window.scrollY > threshold);
    };

    const handleResize = () => {
      threshold = getPricingThreshold();
      handleScroll();
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleUpgrade = (plan: string) => {
    console.log('Upgrade to:', plan);
    alert(`Upgrading to ${plan} plan. Stripe integration coming soon!`);
  };

  return (
    <div className={`${styles.stickyBar} ${isVisible ? styles.visible : ''}`}>
      <div className={styles.barContent}>
        <div className={styles.barText}>
          <div className={styles.barTitle}>Ready to upgrade?</div>
          <div className={styles.barSubtitle}>Unlock unlimited matches & AI scoring</div>
        </div>
        <div className={styles.barButtons}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleUpgrade('pro')}
          >
            Pro
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleUpgrade('elite')}
          >
            Elite
          </Button>
        </div>
      </div>
    </div>
  );
};
