import React from 'react';
import { motion } from 'framer-motion';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { useI18n } from '@/hooks/useI18n';
import styles from './AiMatchingShowcase.module.css';

export const AiMatchingShowcase: React.FC = () => {
  const { t } = useI18n();

  return (
    <Section id="ai-matching" background="subtle" paddingSize="md" className={`${styles.section} premium-section-bg`}>
      <Container>
        <div className={styles.grid}>
          <motion.div
            className={styles.copy}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4 }}
          >
            <span className={styles.kicker}>{t('landing.ai_match_kicker')}</span>
            <h2 className={styles.title}>{t('landing.ai_match_title')}</h2>
            <p className={styles.sub}>{t('landing.ai_match_sub')}</p>
            <p className={styles.disclaimer}>{t('landing.ai_match_disclaimer')}</p>
          </motion.div>

          <motion.aside
            className={styles.card}
            aria-label={t('landing.ai_match_card_aria')}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.45, delay: 0.06 }}
          >
            <div className={styles.matchRing}>
              <span className={styles.matchPct}>87%</span>
              <span className={styles.matchLabel}>{t('landing.ai_match_pct_label')}</span>
            </div>
            <p className={styles.bothLabel}>{t('landing.ai_match_both')}</p>
            <ul className={styles.reasons}>
              <li>{t('landing.ai_match_reason_1')}</li>
              <li>{t('landing.ai_match_reason_2')}</li>
              <li>{t('landing.ai_match_reason_3')}</li>
            </ul>
          </motion.aside>
        </div>
      </Container>
    </Section>
  );
};
