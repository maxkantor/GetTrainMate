import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { Container } from '@/components/layout/Container';
import { LiveMatchFeed } from '@/components/premium/LiveMatchFeed';
import styles from './sections.module.css';

const ease = [0.16, 1, 0.3, 1] as const;

export const Hero: React.FC = () => {
  const { isAuthenticated } = useAuthContext();
  const { me } = useMe();

  const profileComplete = me?.isProfileComplete ?? true;
  const ctaPrimaryHref = !isAuthenticated
    ? '/signup'
    : !profileComplete
      ? '/onboarding/profile'
      : '/app/discover';
  const ctaPrimaryLabel = !isAuthenticated
    ? 'Find My Match'
    : !profileComplete
      ? 'Finish profile'
      : 'Find My Match';

  return (
    <section className={styles.heroPremium}>
      <div className={styles.heroPremiumBg} aria-hidden />
      <div className={styles.heroGrain} aria-hidden />

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
              <Link to={ctaPrimaryHref} className={styles.heroBtnPrimary}>
                {ctaPrimaryLabel}
              </Link>
              <a href="#features" className={styles.heroBtnGhost}>
                See How It Works
              </a>
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
              <li>💬 12,000+ active athletes</li>
            </motion.ul>
          </div>

          <motion.div
            className={styles.heroPremiumRight}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.65, ease, delay: 0.1 }}
          >
            <LiveMatchFeed />
          </motion.div>
        </div>
      </Container>
    </section>
  );
};
