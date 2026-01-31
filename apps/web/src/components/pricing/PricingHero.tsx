import React from 'react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';
import styles from './PricingHero.module.css';

export const PricingHero: React.FC = () => (
  <section className={styles.hero}>
    <Container>
      <h1 className={styles.title}>Find the Right Training Partner. Faster.</h1>
      <p className={styles.subtext}>
        Upgrade only when you want unlimited matches, AI compatibility, and priority placement.
      </p>
      <Button as="a" href="/signup" variant="primary" size="lg">
        Start Free
      </Button>
    </Container>
  </section>
);
