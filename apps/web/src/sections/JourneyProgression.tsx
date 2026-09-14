import React from 'react';
import { motion } from 'framer-motion';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { useI18n } from '@/hooks/useI18n';
import styles from './JourneyProgression.module.css';

const STEPS = [
  { mode: 'TRAIN', titleKey: 'landing.journey_train_title', bodyKey: 'landing.journey_train_body' },
  { mode: 'VIBE', titleKey: 'landing.journey_vibe_title', bodyKey: 'landing.journey_vibe_body' },
  { mode: 'DATE', titleKey: 'landing.journey_date_title', bodyKey: 'landing.journey_date_body' },
] as const;

export const JourneyProgression: React.FC = () => {
  const { t } = useI18n();

  return (
    <Section id="journey" background="subtle" paddingSize="md" className={`${styles.section} premium-section-bg`}>
      <Container>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.4 }}
        >
          <span className={styles.kicker}>{t('landing.journey_kicker')}</span>
          <h2 className={styles.title}>{t('landing.journey_title')}</h2>
          <p className={styles.sub}>{t('landing.journey_sub')}</p>
        </motion.div>

        <div className={styles.flow} role="list">
          {STEPS.map((step, i) => (
            <React.Fragment key={step.mode}>
              {i > 0 ? (
                <div className={styles.arrow} aria-hidden>
                  →
                </div>
              ) : null}
              <motion.article
                role="listitem"
                className={styles.step}
                data-mode={step.mode}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
              >
                <span className={styles.mode}>{step.mode}</span>
                <h3 className={styles.stepTitle}>{t(step.titleKey)}</h3>
                <p className={styles.stepBody}>{t(step.bodyKey)}</p>
              </motion.article>
            </React.Fragment>
          ))}
        </div>

        <p className={styles.contrast}>{t('landing.journey_contrast')}</p>
      </Container>
    </Section>
  );
};
