import React from 'react';
import { Link } from 'react-router-dom';
import FitnessCenterOutlinedIcon from '@mui/icons-material/FitnessCenterOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { useI18n } from '@/hooks/useI18n';
import { Container } from '@/components/layout/Container';
import { trackEvent } from '@/utils/analytics';
import styles from './sections.module.css';

/** Same asset + filter as authenticated /app (.app-hero-bg). */
const APP_HERO_PHOTO = '/images/hero-couples-night-waterfront.png';

/**
 * HERO ONLY — center lockup reproduced from reference.
 * Geometry unchanged (/app-equivalent cover canvas).
 */
export const Hero: React.FC = () => {
  const { isAuthenticated } = useAuthContext();
  const { me } = useMe();
  const { t } = useI18n();

  const profileComplete = me?.isProfileComplete ?? true;
  const ctaPrimaryHref = !isAuthenticated ? '/signup?src=homepage' : '/app';
  const ctaPrimaryLabel = !isAuthenticated
    ? t('landing.landing_primary_cta')
    : !profileComplete
      ? t('landing.cta_finish_profile')
      : t('nav.dashboard');

  return (
    <section className={styles.heroPremium} data-hero-variant="app">
      <div className={styles.heroMedia} aria-hidden>
        <img
          className={styles.heroPhoto}
          src={APP_HERO_PHOTO}
          alt=""
          width={1024}
          height={546}
          decoding="async"
          fetchPriority="high"
        />
        <div className={styles.heroScrim} />
      </div>

      <Container size="wide" className={styles.heroContainer}>
        <div className={styles.heroCenter}>
          <p className={styles.heroEyebrow}>
            <span>{t('landing.hero_campaign_eyebrow_1')}</span>{' '}
            <span className={styles.heroEyebrowAccent}>{t('landing.hero_campaign_eyebrow_2')}</span>
          </p>

          <h1 className={styles.heroCampaign}>
            <span className={styles.heroSansLine}>{t('landing.hero_campaign_title_1')}</span>
            <span className={styles.heroSerifLockup}>
              <span className={styles.heroSerifWhite}>{t('landing.hero_campaign_title_2')}</span>
              <span className={styles.heroSerifAccent}>
                <span className={styles.heroWordGradient}>{t('landing.hero_campaign_title_3')}</span>
                <svg
                  className={styles.heroSwoosh}
                  viewBox="0 0 280 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <path
                    d="M10 12.5C48 5.5 96 3 140 4.5C184 6 228 11.5 270 8"
                    stroke="url(#heroSwooshGrad)"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient
                      id="heroSwooshGrad"
                      x1="10"
                      y1="9"
                      x2="270"
                      y2="9"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor="#D8A7FF" />
                      <stop offset="0.5" stopColor="#9B5CFF" />
                      <stop offset="1" stopColor="#F02DAF" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </span>
          </h1>

          <p className={styles.heroPremiumSub}>
            {t('landing.hero_campaign_sub_1')}
            <br />
            {t('landing.hero_campaign_sub_2')}
          </p>

          <div className={styles.heroPremiumCtas}>
            <Link
              to={ctaPrimaryHref}
              className={styles.heroBtnPrimary}
              onClick={() => {
                trackEvent('hero_cta_clicked', {
                  source_page: '/',
                  user_status: isAuthenticated ? 'authenticated' : 'guest',
                });
                if (isAuthenticated) {
                  trackEvent('app_open_clicked', {
                    source_page: '/',
                    user_status: 'authenticated',
                  });
                } else {
                  trackEvent('sign_up_clicked', {
                    source_page: '/',
                    user_status: 'guest',
                  });
                }
              }}
            >
              <span>{ctaPrimaryLabel}</span>
              <span className={styles.heroBtnArrow} aria-hidden>
                →
              </span>
            </Link>
          </div>

          <div className={styles.heroJourneyStrip} aria-label={t('landing.hero_journey_aria')}>
            <span className={styles.heroJourneyItem}>
              <FitnessCenterOutlinedIcon className={styles.heroJourneyIcon} aria-hidden />
              <span className={styles.heroJourneyLabel}>{t('landing.hero_mode_train_label')}</span>
            </span>
            <span className={styles.heroJourneyDivider} aria-hidden />
            <span className={styles.heroJourneyItem}>
              <GroupsOutlinedIcon className={styles.heroJourneyIcon} aria-hidden />
              <span className={styles.heroJourneyLabel}>{t('landing.hero_mode_vibe_label')}</span>
            </span>
            <span className={styles.heroJourneyDivider} aria-hidden />
            <span className={styles.heroJourneyItem}>
              <FavoriteBorderOutlinedIcon className={styles.heroJourneyIcon} aria-hidden />
              <span className={styles.heroJourneyLabel}>{t('landing.hero_mode_date_label')}</span>
            </span>
          </div>
        </div>
      </Container>
    </section>
  );
};
