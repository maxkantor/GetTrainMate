import React from 'react';
import { motion } from 'framer-motion';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import styles from './BentoFeatures.module.css';

const bento = [
  {
    key: 'ai',
    title: 'AI Matching',
    desc: 'Compatibility scores from your goals, level, and schedule — not just proximity.',
    icon: '✨',
    size: 'large',
  },
  {
    key: 'chat',
    title: 'Live Chat',
    desc: 'Unlock real conversations when both sides are ready.',
    icon: '💬',
    size: 'small',
  },
  {
    key: 'events',
    title: 'Event Meetups',
    desc: 'Train together at events and group sessions.',
    icon: '📍',
    size: 'small',
  },
  {
    key: 'progress',
    title: 'Progress Tracking',
    desc: 'Stay accountable with streaks and session history.',
    icon: '📈',
    size: 'medium',
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

export const Features: React.FC = () => {
  return (
    <Section id="features" background="subtle" paddingSize="xl" className={styles.section}>
      <Container>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.45 }}
        >
          <span className={styles.kicker}>The product</span>
          <h2 className={styles.title}>Built for athletes who show up</h2>
          <p className={styles.subtitle}>Everything in one place — matching, chat, events, and momentum.</p>
        </motion.div>

        <motion.div
          className={styles.bento}
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
        >
          {bento.map((card) => (
            <motion.article
              key={card.key}
              variants={item}
              className={`${styles.card} ${styles[`size_${card.size}`]}`}
              onMouseMove={(e) => {
                const el = e.currentTarget;
                const r = el.getBoundingClientRect();
                el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
                el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
                const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
                const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
                el.style.setProperty('--rx', `${ny * -5}deg`);
                el.style.setProperty('--ry', `${nx * 5}deg`);
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.setProperty('--mx', '50%');
                el.style.setProperty('--my', '50%');
                el.style.setProperty('--rx', '0deg');
                el.style.setProperty('--ry', '0deg');
              }}
            >
              <div className={styles.cardGlow} aria-hidden />
              <span className={styles.cardIcon}>{card.icon}</span>
              <h3 className={styles.cardTitle}>{card.title}</h3>
              <p className={styles.cardDesc}>{card.desc}</p>
            </motion.article>
          ))}
        </motion.div>
      </Container>
    </Section>
  );
};
