import React from 'react';
import { useI18n } from '@/hooks/useI18n';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import styles from './sections.module.css';

export const HowItWorks: React.FC = () => {
  const { t } = useI18n();

  const steps = [
    {
      titleKey: 'landing.how_it_works_step_1_title',
      descKey: 'landing.how_it_works_step_1_desc',
    },
    {
      titleKey: 'landing.how_it_works_step_2_title',
      descKey: 'landing.how_it_works_step_2_desc',
    },
    {
      titleKey: 'landing.how_it_works_step_3_title',
      descKey: 'landing.how_it_works_step_3_desc',
    },
  ];

  return (
    <Section id="how-it-works" background="subtle" paddingSize="xl">
      <Container>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>{t('landing.how_it_works_label')}</span>
          <h2 className={styles.sectionTitle}>{t('landing.how_it_works_title')}</h2>
          <p className={styles.sectionSubtitle}>
            {t('landing.how_it_works_subtitle')}
          </p>
        </div>

        <div className={styles.stepsContainer}>
          {steps.map((step, index) => (
            <div key={index} className={styles.step}>
              <div className={styles.stepNumber}>{index + 1}</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>{t(step.titleKey)}</h3>
                <p className={styles.stepDescription}>{t(step.descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
};
