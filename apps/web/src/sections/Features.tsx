import React from 'react';
import { useI18n } from '@/hooks/useI18n';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import styles from './sections.module.css';

export const Features: React.FC = () => {
  const { t } = useI18n();

  const features = [
    {
      icon: '🎯',
      title: t('landing.feature_1_title'),
      description: t('landing.feature_1_desc'),
    },
    {
      icon: '💬',
      title: t('landing.feature_2_title'),
      description: t('landing.feature_2_desc'),
    },
    {
      icon: '🏆',
      title: t('landing.feature_3_title'),
      description: t('landing.feature_3_desc'),
    },
  ];

  return (
    <Section id="features" background="white" paddingSize="xl">
      <Container>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t('landing.features_title')}</h2>
          <p className={styles.sectionSubtitle}>
            Everything you need to find the perfect training partner and reach your fitness goals faster.
          </p>
        </div>

        <div className={styles.featuresGrid}>
          {features.map((feature, index) => (
            <div key={index} className={styles.featureCard}>
              <div className={styles.featureIcon}>
                {feature.icon}
              </div>
              <h3 className={styles.featureTitle}>{feature.title}</h3>
              <p className={styles.featureDescription}>{feature.description}</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
};
