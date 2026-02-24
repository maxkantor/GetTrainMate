import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { PartnerMatchCards } from '@/components/hero/PartnerMatchCards';
import styles from './sections.module.css';

export const Hero: React.FC = () => {
  const { t } = useI18n();
  const { isAuthenticated } = useAuthContext();
  const { me } = useMe();
  const [isVisible] = useState(true);

  const profileComplete = me?.isProfileComplete ?? true;
  const ctaPrimaryHref = !isAuthenticated
    ? '/signup'
    : !profileComplete
      ? '/onboarding/profile'
      : '/app/discover';
  const ctaPrimaryLabel = !isAuthenticated
    ? t('landing.cta_start_matching_free')
    : !profileComplete
      ? t('landing.cta_finish_profile')
      : t('landing.cta_start_discovering');

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

            {/* CTA Buttons */}
            <div className={styles.heroButtons}>
              <Link to={ctaPrimaryHref} style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="lg" as="button">
                  {ctaPrimaryLabel}
                </Button>
              </Link>
            </div>

            {/* Trust Row */}
            <div className={styles.trustRow}>
              <span className={styles.trustRowItem}>
                <svg className={styles.trustRowIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('landing.trust_verified')}
              </span>
              <span className={styles.trustRowDot}>•</span>
              <span className={styles.trustRowItem}>
                <svg className={styles.trustRowIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                {t('landing.trust_safe')}
              </span>
              <span className={styles.trustRowDot}>•</span>
              <span className={styles.trustRowItem}>
                <svg className={styles.trustRowIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                {t('landing.trust_fast')}
              </span>
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
