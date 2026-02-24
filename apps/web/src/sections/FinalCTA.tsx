import React from 'react';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/hooks/useI18n';
import styles from './sections.module.css';

export const FinalCTA: React.FC = () => {
  const { t } = useI18n();
  return (
    <section className={styles.finalCta}>
      <div className={styles.ctaBackground} />
      <Container size="wide">
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaTitle}>
            {t('landing.final_cta_title')}
          </h2>
          <p className={styles.ctaSubtitle}>
            {t('landing.final_cta_subtitle')}
          </p>
          <div className={styles.ctaButtons}>
            <Button as="link" to="/signup" variant="primary" size="lg">
              {t('landing.cta_start_matching_free')}
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
};
