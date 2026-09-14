import React from 'react';
import { motion } from 'framer-motion';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { useI18n } from '@/hooks/useI18n';
import styles from './GlobalCommunity.module.css';

export const GlobalCommunity: React.FC = () => {
  const { t } = useI18n();

  return (
    <Section id="global" background="subtle" paddingSize="md" className={`${styles.section} premium-section-bg`}>
      <Container>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.4 }}
        >
          <span className={styles.kicker}>{t('landing.global_kicker')}</span>
          <h2 className={styles.title}>{t('landing.global_title')}</h2>
          <p className={styles.sub}>{t('landing.global_sub')}</p>
        </motion.div>

        <ul className={styles.pillars}>
          <li>
            <strong>{t('landing.global_pillar_1_title')}</strong>
            <span>{t('landing.global_pillar_1_body')}</span>
          </li>
          <li>
            <strong>{t('landing.global_pillar_2_title')}</strong>
            <span>{t('landing.global_pillar_2_body')}</span>
          </li>
          <li>
            <strong>{t('landing.global_pillar_3_title')}</strong>
            <span>{t('landing.global_pillar_3_body')}</span>
          </li>
        </ul>
      </Container>
    </Section>
  );
};
