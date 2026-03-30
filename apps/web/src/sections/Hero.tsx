import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { useLandingConversion } from '@/contexts/LandingConversionContext';
import { Container } from '@/components/layout/Container';
import { HeroFloatingStack } from '@/components/premium/HeroFloatingStack';
import { LANDING_CTA_SUB, LANDING_SCARCITY } from '@/constants/landingCopy';
import styles from './sections.module.css';

const ease = [0.16, 1, 0.3, 1] as const;

function HeroFomoLine() {
  const [n, setN] = useState(27);
  useEffect(() => {
    const id = window.setInterval(() => {
      setN((v) => {
        const delta = Math.floor(Math.random() * 3) - 1;
        return Math.min(34, Math.max(21, v + delta));
      });
    }, 4200);
    return () => clearInterval(id);
  }, []);
  return (
    <motion.p
      className={styles.heroFomoLine}
      initial={{ opacity: 0.85 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      🔥 {n} athletes matching near you right now
    </motion.p>
  );
}

export const Hero: React.FC = () => {
  const { isAuthenticated } = useAuthContext();
  const { openEntryFlow } = useLandingConversion();
  const { me } = useMe();

  const profileComplete = me?.isProfileComplete ?? true;
  const ctaPrimaryHref = !isAuthenticated
    ? '/signup'
    : !profileComplete
      ? '/onboarding/profile'
      : '/app/discover';
  const ctaPrimaryLabel = !isAuthenticated
    ? 'Start Matching Free'
    : !profileComplete
      ? 'Finish profile'
      : 'Start Matching Free';
  const showCtaSubtext = profileComplete;
  const primaryOpensFlow = !isAuthenticated && ctaPrimaryLabel === 'Start Matching Free';

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
              Train With People Who Actually Push You
            </motion.h1>
            <motion.p
              className={styles.heroPremiumSub}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease, delay: 0.06 }}
            >
              AI finds your perfect training partner based on your level, schedule, and mindset — in seconds.
            </motion.p>
            <motion.div
              className={styles.heroPremiumCtas}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease, delay: 0.12 }}
            >
              <div className={styles.heroPrimaryStack}>
                {primaryOpensFlow ? (
                  <button type="button" className={styles.heroBtnPrimary} onClick={openEntryFlow}>
                    {ctaPrimaryLabel}
                  </button>
                ) : (
                  <Link to={ctaPrimaryHref} className={styles.heroBtnPrimary}>
                    {ctaPrimaryLabel}
                  </Link>
                )}
                {showCtaSubtext && (
                  <>
                    <span className={styles.heroCtaSub}>{LANDING_CTA_SUB}</span>
                    <span className={styles.heroScarcityLine}>{LANDING_SCARCITY}</span>
                  </>
                )}
              </div>
              <a href="#how-it-works" className={`${styles.heroBtnGhost} ${styles.landingLinkUnderline}`}>
                See How It Works
              </a>
            </motion.div>
            <motion.p
              className={styles.heroEmotionalHook}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease, delay: 0.14 }}
            >
              Stop training alone. Find your level.
            </motion.p>
            <motion.div
              className={styles.heroExclusivity}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease, delay: 0.14 }}
            >
              <span className={styles.heroExclusivityBadge}>🔥 Serious athletes only</span>
              <p className={styles.heroExclusivityLine}>Join 12,000+ committed athletes</p>
            </motion.div>
            <motion.ul
              className={styles.socialProof}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease, delay: 0.18 }}
              aria-label="Social proof"
            >
              <li>🔥 2,184 matches made this week</li>
              <li>⭐ 4.9 average rating</li>
              <li>💬 Active in 40+ cities</li>
            </motion.ul>
            <HeroFomoLine />
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
