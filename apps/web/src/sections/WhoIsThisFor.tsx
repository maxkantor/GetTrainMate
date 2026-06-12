import React from 'react';
import { motion } from 'framer-motion';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { useI18n } from '@/hooks/useI18n';
import styles from './WhoIsThisFor.module.css';

const CARDS = [
  {
    key: 'early',
    icon: '🌅',
  },
  {
    key: 'lifters',
    icon: '🏋️',
  },
  {
    key: 'tired',
    icon: '🎯',
  },
] as const;

export const WhoIsThisFor: React.FC = () => {
  const { t } = useI18n();

  return (
    <Section id="who-its-for" background="subtle" paddingSize="lg" className={`${styles.section} premium-section-bg`}>
      <Container>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.4 }}
        >
          <span className={styles.kicker}>{t('landing.who_for_kicker')}</span>
          <h2 className={styles.title}>{t('landing.who_for_title')}</h2>
          <p className={styles.sub}>{t('landing.who_for_sub')}</p>
        </motion.div>

        <div className={styles.grid}>
          {CARDS.map((c, i) => (
            <motion.article
              key={c.key}
              className={styles.card}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
            >
              <span className={styles.icon} aria-hidden>
                {c.icon}
              </span>
              <h3 className={styles.cardTitle}>{t(`landing.who_for_${c.key}_title`)}</h3>
              <p className={styles.cardBody}>{t(`landing.who_for_${c.key}_body`)}</p>
            </motion.article>
          ))}
        </div>
      </Container>
    </Section>
  );
};
