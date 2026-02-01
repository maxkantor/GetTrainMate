import React, { useState } from 'react';
import { useI18n } from '@/hooks/useI18n';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { PartnerMatchCards } from '@/components/hero/PartnerMatchCards';
import styles from './sections.module.css';

export const Hero: React.FC = () => {
  const { t } = useI18n();
  const [isVisible] = useState(true);

  return (
    <section className={styles.hero}>
      {/* Background Effects */}
      <div className={styles.heroBackground}>
        <div className={styles.heroGradient} />
        <div className={styles.heroNoise} />
        <div className={styles.heroBlob} />
      </div>

      <Container size="wide">
        <div className={styles.heroContent}>
          {/* Left Content */}
          <div className={`${styles.heroText} ${isVisible ? styles.heroTextVisible : ''}`}>
            <div className={styles.heroBadge}>
              <span className={styles.badgeIcon}>✨</span>
              <span>{t('landing.hero_badge')}</span>
            </div>

            <h1 className={styles.heroTitle}>
              {t('landing.hero_title')}
            </h1>

            <p className={styles.heroSubtitle}>
              {t('landing.hero_subtitle')}
            </p>

            {/* Value Props */}
            <div className={styles.valueProps}>
              <div className={styles.valueProp}>
                <svg className={styles.valuePropIcon} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                <span>{t('landing.value_1')}</span>
              </div>
              <div className={styles.valueProp}>
                <svg className={styles.valuePropIcon} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                <span>{t('landing.value_2')}</span>
              </div>
              <div className={styles.valueProp}>
                <svg className={styles.valuePropIcon} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                <span>{t('landing.value_3')}</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className={styles.heroButtons}>
              <Button 
                as="a" 
                href="/signup" 
                variant="primary" 
                size="lg"
              >
                {t('landing.cta_primary')}
              </Button>
              <Button 
                as="a" 
                href="#how-it-works" 
                variant="secondary" 
                size="lg"
              >
                {t('landing.cta_secondary')}
              </Button>
            </div>

            {/* Trust Logos */}
            <div className={styles.trustLogos}>
              <span className={styles.trustLabel}>{t('landing.featured_in')}</span>
              <div className={styles.logoGrid}>
                <div className={styles.trustLogo}>TechCrunch</div>
                <div className={styles.trustLogo}>Forbes</div>
                <div className={styles.trustLogo}>Wired</div>
                <div className={styles.trustLogo}>Product Hunt</div>
              </div>
            </div>
          </div>

          {/* Right Visual - Partner Match Cards */}
          <div className={`${styles.heroVisual} ${isVisible ? styles.heroVisualVisible : ''}`}>
            <PartnerMatchCards />
          </div>
        </div>
      </Container>
    </section>
  );
};
