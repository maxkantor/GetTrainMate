import React from 'react';
import { useI18n } from '@/hooks/useI18n';
import { Container } from '@/components/layout/Container';
import styles from './DemoProfilesSection.module.css';

interface DemoProfile {
  name: string;
  location: string;
  tags: string[];
  schedule: string[];
  avatar: string;
}

const DEMO_PROFILES: DemoProfile[] = [
  { name: 'Alex', location: 'San Francisco, CA', tags: ['Running', 'Yoga', '5K'], schedule: ['Mon/Wed', '6–8 PM'], avatar: '🏃' },
  { name: 'Jordan', location: 'Austin, TX', tags: ['Cycling', 'HIIT', 'CrossFit'], schedule: ['Tue/Thu', '5–7 AM'], avatar: '🚴' },
  { name: 'Sam', location: 'Denver, CO', tags: ['Climbing', 'Hiking', 'Strength'], schedule: ['Weekends'], avatar: '🧗' },
  { name: 'Morgan', location: 'Seattle, WA', tags: ['Swimming', 'Triathlon', 'Running'], schedule: ['Daily', '6 AM'], avatar: '🏊' },
  { name: 'Casey', location: 'Chicago, IL', tags: ['Yoga', 'Pilates', 'Meditation'], schedule: ['Mon/Wed/Fri'], avatar: '🧘' },
];

export const DemoProfilesSection: React.FC = () => {
  const { t } = useI18n();

  return (
    <section className={styles.section} aria-label="Example profiles">
      <Container size="wide">
        <h2 className={styles.heading}>{t('landing.demo_heading')}</h2>
        <div className={styles.cards}>
          {DEMO_PROFILES.map((profile, index) => (
            <div key={profile.name} className={styles.card} role="article">
              <span className={styles.sampleLabel}>{t('landing.sample_profile')}</span>
              <div className={styles.cardHeader}>
                <div className={styles.avatar}>{profile.avatar}</div>
                <div className={styles.nameSection}>
                  <span className={styles.name}>{profile.name}</span>
                </div>
              </div>
              <div className={styles.location}>{profile.location}</div>
              <div className={styles.tags}>
                {profile.tags.map((tag) => (
                  <span key={tag} className={styles.tag}>
                    {tag}
                  </span>
                ))}
              </div>
              <div className={styles.schedule}>
                {profile.schedule.map((s) => (
                  <span key={s} className={styles.scheduleTag}>
                    🗓 {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
};
