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

            {/* Support bullets – AI value props */}
            <ul className={styles.heroSupportBullets} aria-label="AI features">
              <li>{t('landing.hero_support_ai_insights')}</li>
              <li>{t('landing.hero_support_ai_icebreakers')}</li>
              <li>{t('landing.hero_support_ai_workout')}</li>
              <li>{t('landing.hero_support_safer')}</li>
            </ul>

            {/* Powered by AI – minimal, premium */}
            <div className={styles.poweredByAi}>
              <span className={styles.poweredByAiLabel}>{t('landing.powered_by_ai_title')}</span>
              <p className={styles.poweredByAiDesc}>{t('landing.powered_by_ai_desc')}</p>
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
