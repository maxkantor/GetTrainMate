import React from 'react';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import styles from './sections.module.css';

export const FinalCTA: React.FC = () => {
  return (
    <section className={styles.finalCta}>
      <div className={styles.ctaBackground} />
      <Container size="wide">
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaTitle}>
            Ready to find your perfect training partner?
          </h2>
          <p className={styles.ctaSubtitle}>
            Join thousands of athletes who have already discovered the power of training together.
            Get started for free today.
          </p>
          <div className={styles.ctaButtons}>
            <Button as="link" to="/signup" variant="secondary" size="lg">
              Get started free
            </Button>
            <Button as="link" to="/contact" variant="ghost" size="lg" style={{ color: 'white', borderColor: 'white' }}>
              Contact sales
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
};
