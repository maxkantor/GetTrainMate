import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Container } from '@/components/layout/Container';
import { useI18n } from '@/hooks/useI18n';
import styles from './TrustSafetySection.module.css';

const ITEMS = [
  { titleKey: 'landing.trust_item_1_title', bodyKey: 'landing.trust_item_1_body' },
  { titleKey: 'landing.trust_item_2_title', bodyKey: 'landing.trust_item_2_body' },
  { titleKey: 'landing.trust_item_3_title', bodyKey: 'landing.trust_item_3_body' },
  { titleKey: 'landing.trust_item_4_title', bodyKey: 'landing.trust_item_4_body' },
] as const;

/** Only claims features that exist: intent modes, Cognito auth, profile controls, support contact. */
export const TrustSafetySection: React.FC = () => {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();

  return (
    <section className={`${styles.section} premium-section-bg`} id="trust">
      <Container>
        <motion.div
          className={styles.header}
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.4 }}
        >
          <span className={styles.kicker}>{t('landing.trust_kicker')}</span>
          <h2 className={styles.title}>{t('landing.trust_title')}</h2>
          <p className={styles.sub}>{t('landing.trust_sub')}</p>
        </motion.div>
        <ul className={styles.list}>
          {ITEMS.map((item) => (
            <li key={item.titleKey} className={styles.item}>
              <h3 className={styles.itemTitle}>{t(item.titleKey)}</h3>
              <p className={styles.itemBody}>{t(item.bodyKey)}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
};
