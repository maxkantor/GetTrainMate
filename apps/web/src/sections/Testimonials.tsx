import React from 'react';
import { motion } from 'framer-motion';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { useI18n } from '@/hooks/useI18n';
import { DUMMY_USER_PRIMARY_PHOTO } from '@/utils/profilePhotos';
import styles from './sections.module.css';

type T = {
  name: string;
  place: string;
  sport: string;
  avatar: string;
};

const thumb = (url: string) => (url.includes('?') ? `${url}&w=96&h=96&fit=crop&crop=faces` : `${url}?w=96&h=96&fit=crop&crop=faces`);

/** Avatars align with seeded demo users for visual continuity. */
const items: T[] = [
  {
    name: 'Mike',
    place: 'London',
    sport: '🚴',
    avatar: thumb(DUMMY_USER_PRIMARY_PHOTO['dummy-user-2']),
  },
  {
    name: 'Sarah',
    place: 'Toronto',
    sport: '🏃‍♀️',
    avatar: thumb(DUMMY_USER_PRIMARY_PHOTO['dummy-user-1']),
  },
  {
    name: 'Emma',
    place: 'Barcelona',
    sport: '🧘',
    avatar: thumb(DUMMY_USER_PRIMARY_PHOTO['dummy-user-3']),
  },
];

export const Testimonials: React.FC = () => {
  const { t } = useI18n();

  return (
    <Section id="testimonials" background="subtle" paddingSize="lg" className={`${styles.testimonials} premium-section-bg`}>
      <Container>
        <motion.div
          className={styles.sectionHeader}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <span className={styles.sectionLabel}>{t('landing.testimonials_section_label')}</span>
          <h2 className={styles.sectionTitle}>{t('landing.testimonials_section_title')}</h2>
          <p className={styles.sectionSubtitle}>{t('landing.testimonials_section_sub')}</p>
        </motion.div>

        <div className={styles.testimonialsGrid}>
          {items.map((item, i) => (
            <motion.article
              key={item.name}
              className={styles.testimonialCard}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              onMouseMove={(e) => {
                const el = e.currentTarget;
                const r = el.getBoundingClientRect();
                const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
                const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
                el.style.setProperty('--rx', `${ny * -6}deg`);
                el.style.setProperty('--ry', `${nx * 6}deg`);
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.setProperty('--rx', '0deg');
                el.style.setProperty('--ry', '0deg');
              }}
            >
              <p className={styles.testimonialText}>&ldquo;{t(`landing.testimonial_${i + 1}_quote`)}&rdquo;</p>
              <div className={styles.testimonialAuthor}>
                <img
                  src={item.avatar}
                  alt=""
                  className={styles.testimonialPhoto}
                  width={48}
                  height={48}
                  loading="lazy"
                  decoding="async"
                />
                <div className={styles.testimonialAuthorInfo}>
                  <div className={styles.testimonialName}>
                    {item.name} <span className={styles.testimonialPlace}>· {item.place}</span>
                  </div>
                  <div className={styles.testimonialBadges}>
                    <span className={styles.sportBadge}>{item.sport}</span>
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
