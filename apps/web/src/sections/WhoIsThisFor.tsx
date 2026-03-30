import React from 'react';
import { motion } from 'framer-motion';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import styles from './WhoIsThisFor.module.css';

const CARDS = [
  {
    key: 'early',
    title: '5AM grinders',
    body: 'Alarm-setters who want someone who shows up before the sun.',
    icon: '🌅',
  },
  {
    key: 'lifters',
    title: 'Competitive lifters',
    body: 'Same intensity, same standards — spotters who actually count reps.',
    icon: '🏋️',
  },
  {
    key: 'tired',
    title: 'Done with flaky partners',
    body: 'If you’re tired of last-minute bailouts, you’re in the right place.',
    icon: '🎯',
  },
] as const;

export const WhoIsThisFor: React.FC = () => {
  return (
    <Section id="who-its-for" background="subtle" paddingSize="xl" className={styles.section}>
      <Container>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.4 }}
        >
          <span className={styles.kicker}>Exclusive fit</span>
          <h2 className={styles.title}>Who this is for</h2>
          <p className={styles.sub}>Not everyone — just people who train like it matters.</p>
        </motion.div>

        <div className={styles.grid}>
          {CARDS.map((c, i) => (
            <motion.article
              key={c.key}
              className={styles.card}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
            >
              <span className={styles.icon} aria-hidden>
                {c.icon}
              </span>
              <h3 className={styles.cardTitle}>{c.title}</h3>
              <p className={styles.cardBody}>{c.body}</p>
            </motion.article>
          ))}
        </div>
      </Container>
    </Section>
  );
};
