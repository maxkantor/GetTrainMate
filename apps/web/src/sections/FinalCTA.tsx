import React, { useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useI18n } from '@/hooks/useI18n';
import { Container } from '@/components/layout/Container';
import styles from './FinalCTA.module.css';

export const FinalCTA: React.FC = () => {
  const cardRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useAuthContext();
  const { t } = useI18n();

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
    <section className={`${styles.section} premium-section-bg`}>
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
          <h2 className={styles.title}>{t('landing.final_cta_card_title')}</h2>
          <p className={styles.sub}>{t('landing.final_cta_card_sub')}</p>
          {!isAuthenticated ? (
            <Link to="/signup" className={styles.btn}>
              {t('landing.landing_primary_cta')}
            </Link>
          ) : (
            <Link to="/app/discover" className={styles.btn}>
              {t('landing.landing_primary_cta')}
            </Link>
          )}
          <p className={styles.btnSub}>{t('landing.landing_cta_sub')}</p>
          <p className={styles.scarcityLine}>{t('landing.landing_scarcity')}</p>
        </motion.div>
      </Container>
    </section>
  );
};
