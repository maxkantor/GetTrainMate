import React from 'react';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import styles from './sections.module.css';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      title: 'Create Your Profile',
      description: 'Set up your profile with your fitness goals, preferred sports, and availability. Add photos and let others know what makes you unique.',
    },
    {
      title: 'Get Matched',
      description: 'Our AI-powered algorithm finds training partners who match your goals, skill level, and schedule. Browse profiles and connect with people near you.',
    },
    {
      title: 'Start Training Together',
      description: 'Chat, plan sessions, and meet up with your new training partners. Track your progress and achieve your fitness goals together.',
    },
  ];

  return (
    <Section id="how-it-works" background="subtle" paddingSize="xl">
      <Container>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>How It Works</span>
          <h2 className={styles.sectionTitle}>Get started in 3 simple steps</h2>
          <p className={styles.sectionSubtitle}>
            Join thousands of athletes who have found their perfect training partners.
          </p>
        </div>

        <div className={styles.stepsContainer}>
          {steps.map((step, index) => (
            <div key={index} className={styles.step}>
              <div className={styles.stepNumber}>{index + 1}</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDescription}>{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
};
