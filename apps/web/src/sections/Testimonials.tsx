import React from 'react';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import styles from './sections.module.css';

export const Testimonials: React.FC = () => {
  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Marathon Runner',
      avatar: 'S',
      text: 'Found an amazing running partner who matches my pace perfectly. We\'ve completed 3 marathons together already!',
      rating: 5,
    },
    {
      name: 'Mike Chen',
      role: 'CrossFit Athlete',
      avatar: 'M',
      text: 'GetTrainMate helped me find a gym buddy with similar goals. Training together has pushed both of us to new PRs!',
      rating: 5,
    },
    {
      name: 'Emma Davis',
      role: 'Yoga Enthusiast',
      avatar: 'E',
      text: 'I love the community vibe. Found several people for morning yoga sessions and made great friends in the process.',
      rating: 5,
    },
  ];

  return (
    <Section id="testimonials" background="white" paddingSize="xl">
      <Container>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>Testimonials</span>
          <h2 className={styles.sectionTitle}>Loved by athletes worldwide</h2>
          <p className={styles.sectionSubtitle}>
            Don't just take our word for it. Here's what our community has to say.
          </p>
        </div>

        <div className={styles.testimonialsGrid}>
          {testimonials.map((testimonial, index) => (
            <div key={index} className={styles.testimonialCard}>
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
                  <div className={styles.testimonialRole}>{testimonial.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
};
