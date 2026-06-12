import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { useI18n } from '@/hooks/useI18n';
import { Container } from '@/components/layout/Container';
import { HeroFloatingStack } from '@/components/premium/HeroFloatingStack';
import { trackEvent } from '@/utils/analytics';
import styles from './sections.module.css';

const ease = [0.16, 1, 0.3, 1] as const;
const ENGLISH_ACCENT_PHRASE = 'Maybe More.';

function renderHeroTitle(title: string) {
  const englishAccentIndex = title.indexOf(ENGLISH_ACCENT_PHRASE);
  if (englishAccentIndex >= 0) {
    return (
      <>
        <span className={styles.heroTitleLine}>{title.slice(0, englishAccentIndex).trim()}</span>
        <span className={styles.heroTitleAccent}>{ENGLISH_ACCENT_PHRASE}</span>
      </>
    );
  }

  const sentences = title.match(/[^.!?।。]+[.!?।。]?/g)?.map((part) => part.trim()).filter(Boolean);
  if (!sentences || sentences.length < 2) {
    return title;
  }

  return (
    <>
      <span className={styles.heroTitleLine}>{sentences.slice(0, -1).join(' ')}</span>
      <span className={styles.heroTitleAccent}>{sentences.at(-1)}</span>
    </>
  );
}

export const Hero: React.FC = () => {
  const { isAuthenticated } = useAuthContext();
  const { me } = useMe();
  const { t } = useI18n();

  const profileComplete = me?.isProfileComplete ?? true;
  const ctaPrimaryHref = !isAuthenticated ? '/signup' : '/app';
  const primaryCta = t('landing.landing_primary_cta');
  const ctaPrimaryLabel = !isAuthenticated
    ? primaryCta
    : !profileComplete
      ? t('landing.cta_finish_profile')
      : t('nav.dashboard');
  const showCtaSubtext = !isAuthenticated || profileComplete;
  const heroTitle = t('landing.hero_premium_title');

  return (
    <section className={styles.heroPremium}>
      <div className={styles.heroPremiumBg} aria-hidden />
      <div className={styles.heroGrain} aria-hidden />
      <div className={styles.heroRadialAccent} aria-hidden />

      <Container size="wide">
        <div className={styles.heroPremiumGrid}>
          <div className={styles.heroPremiumLeft}>
            <motion.h1
              className={styles.heroPremiumTitle}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease }}
            >
              {renderHeroTitle(heroTitle)}
            </motion.h1>
            <motion.p
              className={styles.heroPremiumSub}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease, delay: 0.06 }}
            >
              {t('landing.hero_premium_sub')}
            </motion.p>
            <motion.div
              className={styles.heroPremiumCtas}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease, delay: 0.12 }}
            >
              <div className={styles.heroPrimaryStack}>
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
                  {ctaPrimaryLabel}
                </Link>
                {!isAuthenticated && (
                  <span className={styles.heroCtaSub}>{t('landing.landing_hero_sub_guest')}</span>
                )}
                {isAuthenticated && showCtaSubtext && (
                  <>
                    <span className={styles.heroCtaSub}>{t('landing.landing_cta_sub')}</span>
                    <span className={styles.heroScarcityLine}>{t('landing.landing_scarcity')}</span>
                  </>
                )}
              </div>
              <a
                href="#how-it-works"
                className={`${styles.heroBtnGhost} ${styles.landingLinkUnderline}`}
                onClick={() => {
                  trackEvent('see_how_it_works_clicked', {
                    source_page: '/',
                    user_status: isAuthenticated ? 'authenticated' : 'guest',
                  });
                }}
              >
                {t('landing.hero_see_how')}
              </a>
            </motion.div>
            <motion.div
              className={styles.heroTrustStrip}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease, delay: 0.14 }}
            >
              <span className={styles.heroExclusivityBadge}>{t('landing.hero_badge_serious')}</span>
              <p className={styles.heroTrustStripText}>{t('landing.hero_hook')}</p>
            </motion.div>
            <motion.ul
              className={styles.socialProof}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease, delay: 0.18 }}
              aria-label={t('landing.hero_proof_aria')}
            >
              <li>{t('landing.hero_proof_1')}</li>
              <li>{t('landing.hero_proof_2')}</li>
              <li>{t('landing.hero_proof_3')}</li>
            </motion.ul>
          </div>

          <motion.div
            className={styles.heroPremiumRight}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.65, ease, delay: 0.1 }}
          >
            <HeroFloatingStack />
          </motion.div>
        </div>
      </Container>
    </section>
  );
};
