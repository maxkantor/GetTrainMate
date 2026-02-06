import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/hooks/useI18n';
import { LANDING_PROFILES } from '@/data/landingProfiles';
import styles from './PartnerMatchCards.module.css';

export const PartnerMatchCards: React.FC = () => {
  const { t } = useI18n();

  return (
    <div className={styles.cardsWrapper}>
      {LANDING_PROFILES.map((profile, index) => (
        <div
          key={profile.userId}
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

          {/* CTA - links to this profile so View Profile shows the correct person */}
          <div className={styles.cta}>
            <Link
              to={`/app/profile/${profile.userId}`}
              className={styles.ctaText}
              aria-label={`${t('landing.view_profile')} — ${profile.name}`}
            >
              {t('landing.view_profile')} →
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
};
