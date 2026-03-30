import React, { useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useLandingConversion } from '@/contexts/LandingConversionContext';
import { Container } from '@/components/layout/Container';
import { LANDING_CTA_SUB, LANDING_SCARCITY } from '@/constants/landingCopy';
import styles from './FinalCTA.module.css';

export const FinalCTA: React.FC = () => {
  const cardRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useAuthContext();
  const { openEntryFlow } = useLandingConversion();

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    el.style.setProperty('--mx', `${x}%`);
    el.style.setProperty('--my', `${y}%`);
  }, []);

  const onLeave = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty('--mx', '50%');
    el.style.setProperty('--my', '40%');
  }, []);

  return (
    <section className={styles.section}>
      <div className={styles.bgGrain} aria-hidden />
      <Container size="wide">
        <motion.div
          ref={cardRef}
          className={styles.card}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={styles.cardGlow} aria-hidden />
          <h2 className={styles.title}>Your Next Training Partner Is One Click Away</h2>
          <p className={styles.sub}>Join thousands of athletes matching on schedule, level, and mindset.</p>
          {!isAuthenticated ? (
            <button type="button" className={styles.btn} onClick={openEntryFlow}>
              Start Matching Free
            </button>
          ) : (
            <Link to="/app/discover" className={styles.btn}>
              Start Matching Free
            </Link>
          )}
          <p className={styles.btnSub}>{LANDING_CTA_SUB}</p>
          <p className={styles.scarcityLine}>{LANDING_SCARCITY}</p>
        </motion.div>
      </Container>
    </section>
  );
};
