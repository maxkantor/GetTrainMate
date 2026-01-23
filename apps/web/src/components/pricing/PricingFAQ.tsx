import React from 'react';
import { Container } from '@/components/layout/Container';
import { pricingFAQs } from '@/data/pricingData';
import styles from './PricingFAQ.module.css';

export const PricingFAQ: React.FC = () => {
  return (
    <section className={styles.faqSection}>
      <Container size="xl">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Frequently asked questions</h2>
          <p className={styles.sectionSubtitle}>
            Everything you need to know about pricing and billing
          </p>
        </div>

        <div className={styles.faqGrid}>
          {pricingFAQs.map((faq, idx) => (
            <div key={idx} className={styles.faqItem}>
              <h3 className={styles.question}>
                <span className={styles.questionIcon}>?</span>
                <span>{faq.question}</span>
              </h3>
              <p className={styles.answer}>{faq.answer}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
};
