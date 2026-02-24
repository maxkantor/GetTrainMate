import React from 'react';
import { useI18n } from '@/hooks/useI18n';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { TestimonialCarousel, type TestimonialItem } from '@/components/ui/TestimonialCarousel';
import styles from './sections.module.css';

const testimonials: TestimonialItem[] = [
  {
    name: 'Sarah Johnson',
    role: 'Marathon Runner',
    location: 'Austin, TX',
    avatar: 'S',
    text: 'Found an amazing running partner who matches my pace perfectly. We\'ve completed 3 marathons together already!',
    rating: 5,
  },
  {
    name: 'Mike Chen',
    role: 'CrossFit Athlete',
    location: 'San Francisco, CA',
    avatar: 'M',
    text: 'GetTrainMate helped me find a gym buddy with similar goals. Training together has pushed both of us to new PRs!',
    rating: 5,
  },
  {
    name: 'Emma Davis',
    role: 'Yoga Enthusiast',
    location: 'Seattle, WA',
    avatar: 'E',
    text: 'I love the community vibe. Found several people for morning yoga sessions and made great friends in the process.',
    rating: 5,
  },
];

export const Testimonials: React.FC = () => {
  const { t } = useI18n();

  return (
    <Section id="testimonials" background="subtle" paddingSize="xl" className={styles.testimonials}>
      <Container>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>{t('landing.testimonials_label')}</span>
          <h2 className={styles.sectionTitle}>{t('landing.testimonials_title')}</h2>
          <p className={styles.sectionSubtitle}>
            {t('landing.testimonials_subtitle')}
          </p>
        </div>

        <TestimonialCarousel
          items={testimonials}
          renderCard={(testimonial) => (
            <div className={styles.testimonialCard}>
              <div className={styles.testimonialStars}>
                {[...Array(testimonial.rating)].map((_, i) => (
                  <span key={i}>★</span>
                ))}
              </div>
              <p className={styles.testimonialText}>"{testimonial.text}"</p>
              <div className={styles.testimonialAuthor}>
                <div className={styles.testimonialAvatar}>{testimonial.avatar}</div>
                <div className={styles.testimonialAuthorInfo}>
                  <div className={styles.testimonialName}>{testimonial.name}</div>
                  <div className={styles.testimonialMeta}>
                    {testimonial.role}
                    {testimonial.location && ` • ${testimonial.location}`}
                  </div>
                </div>
              </div>
            </div>
          )}
        />
      </Container>
    </Section>
  );
};
