import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useI18n } from '@/hooks/useI18n';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import styles from './sections.module.css';

export const Hero: React.FC = () => {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section className={styles.hero}>
      {/* Background Effects */}
      <div className={styles.heroBackground}>
        <div className={styles.heroGradient} />
        <div className={styles.heroNoise} />
        <div className={styles.heroBlob} />
      </div>

      <Container>
        <div className={styles.heroContent}>
          {/* Left Content */}
          <div className={`${styles.heroText} ${isVisible ? styles.heroTextVisible : ''}`}>
            <div className={styles.heroBadge}>
              <span className={styles.badgeIcon}>✨</span>
              <span>Trusted by 10,000+ athletes</span>
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
                <span>AI-powered matching</span>
              </div>
              <div className={styles.valueProp}>
                <svg className={styles.valuePropIcon} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                <span>Verified profiles</span>
              </div>
              <div className={styles.valueProp}>
                <svg className={styles.valuePropIcon} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                <span>Safe & secure</span>
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
              <span className={styles.trustLabel}>Featured in</span>
              <div className={styles.logoGrid}>
                <div className={styles.trustLogo}>TechCrunch</div>
                <div className={styles.trustLogo}>Forbes</div>
                <div className={styles.trustLogo}>Wired</div>
                <div className={styles.trustLogo}>Product Hunt</div>
              </div>
            </div>
          </div>

          {/* Right Visual - Mock Cards */}
          <div className={`${styles.heroVisual} ${isVisible ? styles.heroVisualVisible : ''}`}>
            <div className={styles.mockCards}>
              <div className={`${styles.mockCard} ${styles.mockCard1}`}>
                <div className={styles.mockCardImage} />
                <div className={styles.mockCardContent}>
                  <div className={styles.mockCardTitle} />
                  <div className={styles.mockCardMeta} />
                  <div className={styles.mockCardTags}>
                    <div className={styles.mockTag} />
                    <div className={styles.mockTag} />
                  </div>
                </div>
              </div>
              <div className={`${styles.mockCard} ${styles.mockCard2}`}>
                <div className={styles.mockCardImage} />
                <div className={styles.mockCardContent}>
                  <div className={styles.mockCardTitle} />
                  <div className={styles.mockCardMeta} />
                  <div className={styles.mockCardTags}>
                    <div className={styles.mockTag} />
                    <div className={styles.mockTag} />
                  </div>
                </div>
              </div>
              <div className={`${styles.mockCard} ${styles.mockCard3}`}>
                <div className={styles.mockCardImage} />
                <div className={styles.mockCardContent}>
                  <div className={styles.mockCardTitle} />
                  <div className={styles.mockCardMeta} />
                  <div className={styles.mockCardTags}>
                    <div className={styles.mockTag} />
                    <div className={styles.mockTag} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
};
