import React from 'react';
import { motion } from 'framer-motion';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import styles from './WhoIsThisFor.module.css';

const CARDS = [
  {
    key: 'early',
    title: 'Early-morning grinders',
    body: 'People who want a partner who shows up when the alarm goes off.',
    icon: '🌅',
  },
  {
    key: 'lifters',
    title: 'Lifters who want consistency',
    body: 'Same intensity and standards — without the ghosting between sessions.',
    icon: '🏋️',
  },
  {
    key: 'tired',
    title: 'Done with flaky training partners',
    body: 'If you train like it matters, you are in the right place.',
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
          <span className={styles.kicker}>Built for you if</span>
          <h2 className={styles.title}>Who this is for</h2>
          <p className={styles.sub}>People who care, show up, and want real accountability.</p>
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
