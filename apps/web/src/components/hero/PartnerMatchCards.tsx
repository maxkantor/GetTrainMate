import React from 'react';
import { useI18n } from '@/hooks/useI18n';
import styles from './PartnerMatchCards.module.css';

interface PartnerProfile {
  name: string;
  age: number;
  location: string;
  distance: string;
  tags: string[];
  schedule: string[];
  match: number;
  verified: boolean;
  avatar: string;
}

const mockProfiles: PartnerProfile[] = [
  {
    name: 'Sofia',
    age: 29,
    location: 'Atlanta, GA',
    distance: '2.4 mi',
    tags: ['HYROX', 'Strength', '5K'],
    schedule: ['Mon/Wed', '6-8 PM'],
    match: 94,
    verified: true,
    avatar: '👩‍🦰',
  },
  {
    name: 'Marcus',
    age: 32,
    location: 'Denver, CO',
    distance: '1.8 mi',
    tags: ['CrossFit', 'Running', 'Rowing'],
    schedule: ['Tue/Thu', '5-7 AM'],
    match: 89,
    verified: true,
    avatar: '🧔',
  },
  {
    name: 'Aisha',
    age: 27,
    location: 'Austin, TX',
    distance: '3.2 mi',
    tags: ['Yoga', 'HIIT', 'Cycling'],
    schedule: ['Daily', '7-9 PM'],
    match: 91,
    verified: false,
    avatar: '👩',
  },
];

export const PartnerMatchCards: React.FC = () => {
  const { t } = useI18n();
  return (
    <div className={styles.cardsWrapper}>
      {mockProfiles.map((profile, index) => (
        <div
          key={profile.name}
          className={`${styles.card} ${styles[`card${index + 1}`]}`}
        >
          {index === 0 && <div className={styles.shine} />}
          
          {/* Header: Avatar + Name + Match Score */}
          <div className={styles.cardHeader}>
            <div className={styles.profileInfo}>
              <div className={styles.avatar}>{profile.avatar}</div>
              <div className={styles.nameSection}>
                <div className={styles.nameRow}>
                  <span className={styles.name}>
                    {profile.name}, {profile.age}
                  </span>
                  {profile.verified && (
                    <svg
                      className={styles.verifiedBadge}
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
            <div className={styles.matchScore}>{profile.match}% {t('landing.match_pct')}</div>
          </div>

          {/* Location */}
          <div className={styles.location}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            <span>
              {profile.location} • {profile.distance} {t('landing.away')}
            </span>
          </div>

          {/* Sport Tags */}
          <div className={styles.tags}>
            {profile.tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>

          {/* Schedule */}
          <div className={styles.schedule}>
            {profile.schedule.map((time) => (
              <span key={time} className={styles.scheduleTag}>
                🗓️ {time}
              </span>
            ))}
          </div>

          {/* CTA */}
          <div className={styles.cta}>
            <a href="#discover" className={styles.ctaText} aria-label={t('landing.view_profile')}>
              {t('landing.view_profile')} →
            </a>
          </div>
        </div>
      ))}
    </div>
  );
};
