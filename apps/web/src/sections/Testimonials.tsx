import React from 'react';
import { motion } from 'framer-motion';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import styles from './sections.module.css';

type T = {
  quote: string;
  name: string;
  place: string;
  sport: string;
  avatar: string;
};

const items: T[] = [
  {
    quote: 'Found my HYROX partner in 2 days. Game changer.',
    name: 'Mike',
    place: 'Atlanta',
    sport: '🏃‍♂️',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96&h=96&fit=crop&crop=faces',
  },
  {
    quote: '5AM runs finally stuck — matched with someone who never flakes.',
    name: 'Sofia',
    place: 'Austin',
    sport: '🏃‍♀️',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&fit=crop&crop=faces',
  },
  {
    quote: 'Lifting partner same level as me. We both hit PRs this month.',
    name: 'James',
    place: 'Denver',
    sport: '🏋️',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&fit=crop&crop=faces',
  },
];

export const Testimonials: React.FC = () => {
  return (
    <Section id="testimonials" background="subtle" paddingSize="xl" className={styles.testimonials}>
      <Container>
        <motion.div
          className={styles.sectionHeader}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <span className={styles.sectionLabel}>Real athletes</span>
          <h2 className={styles.sectionTitle}>Sounds like real life — because it is</h2>
          <p className={styles.sectionSubtitle}>Short stories from people who actually train together.</p>
        </motion.div>

        <div className={styles.testimonialsGrid}>
          {items.map((t, i) => (
            <motion.article
              key={t.name}
              className={styles.testimonialCard}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              whileHover={{ scale: 1.02 }}
            >
              <p className={styles.testimonialText}>&ldquo;{t.quote}&rdquo;</p>
              <div className={styles.testimonialAuthor}>
                <img
                  src={t.avatar}
                  alt=""
                  className={styles.testimonialPhoto}
                  width={48}
                  height={48}
                  loading="lazy"
                  decoding="async"
                />
                <div className={styles.testimonialAuthorInfo}>
                  <div className={styles.testimonialName}>
                    {t.name} <span className={styles.testimonialPlace}>· {t.place}</span>
                  </div>
                  <div className={styles.testimonialBadges}>
                    <span className={styles.sportBadge}>{t.sport}</span>
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </Container>
    </Section>
  );
};
