import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { useI18n } from '@/hooks/useI18n';
import styles from './JourneyProgression.module.css';

const STEPS = [
  { mode: 'TRAIN', titleKey: 'landing.journey_train_title', bodyKey: 'landing.journey_train_body' },
  { mode: 'VIBE', titleKey: 'landing.journey_vibe_title', bodyKey: 'landing.journey_vibe_body' },
  { mode: 'DATE', titleKey: 'landing.journey_date_title', bodyKey: 'landing.journey_date_body' },
] as const;

/** Bold TRAIN → VIBE → DATE differentiation — not three equal SaaS cards. */
export const JourneyProgression: React.FC = () => {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();

  return (
    <Section id="journey" background="subtle" paddingSize="md" className={`${styles.section} premium-section-bg`}>
      <Container size="wide">
        <motion.div
          className={styles.header}
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.4 }}
        >
          <span className={styles.kicker}>{t('landing.journey_kicker')}</span>
          <h2 className={styles.title}>{t('landing.journey_title')}</h2>
          <p className={styles.sub}>{t('landing.journey_sub')}</p>
        </motion.div>

        <ol className={styles.strip}>
          {STEPS.map((step, i) => (
            <li key={step.mode} className={styles.stripItem} data-mode={step.mode}>
              <div className={styles.stripModeRow}>
                <span className={styles.stripMode}>{step.mode}</span>
                {i < STEPS.length - 1 ? <span className={styles.stripArrow} aria-hidden>→</span> : null}
              </div>
              <h3 className={styles.stripTitle}>{t(step.titleKey)}</h3>
              <p className={styles.stripBody}>{t(step.bodyKey)}</p>
            </li>
          ))}
        </ol>

        <p className={styles.contrast}>{t('landing.journey_contrast')}</p>
      </Container>
    </Section>
  );
};
