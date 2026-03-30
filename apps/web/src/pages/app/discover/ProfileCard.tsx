import React, { useState } from 'react';
import { motion, useReducedMotion, type PanInfo } from 'framer-motion';
import styles from './ProfileCard.module.css';
import { ProfileDetailsModal } from './ProfileDetailsModal';
import type { MatchFeedItem } from '@/services/matchService';
import { NO_PHOTO_PLACEHOLDER } from '@/utils/profilePhotos';

interface ProfileCardProps {
  profile: MatchFeedItem;
  photoUrl: string;
  photoIndex: number;
  allPhotoUrls: string[];
  onPhotoChange: (index: number) => void;
  onPhotoError: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  matched?: boolean;
}

const MAX_BIO_LINES = 2;
const MAX_SPORT_CHIPS = 4;

function MatchRing({ percent }: { percent: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  const offset = c - (p / 100) * c;
  return (
    <svg className={styles.matchRing} viewBox="0 0 48 48" aria-hidden>
      <defs>
        <linearGradient id="matchRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3.5" />
      <circle
        cx="24"
        cy="24"
        r={r}
        fill="none"
        stroke="url(#matchRingGrad)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 24 24)"
      />
      <text x="24" y="27" textAnchor="middle" className={styles.matchRingText}>
        {Math.round(p)}
      </text>
    </svg>
  );
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  photoUrl,
  photoIndex,
  allPhotoUrls,
  onPhotoChange,
  onPhotoError,
  onSwipeLeft,
  onSwipeRight,
  matched = false,
}) => {
  const [bioExpanded, setBioExpanded] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const levelLabel = profile.level ? profile.level.charAt(0).toUpperCase() + profile.level.slice(1) : null;
  const distanceLabel = profile.city ? profile.city : null;
  const commonSports = profile.commonSports ?? profile.sportTags ?? [];
  const displaySports = commonSports.slice(0, MAX_SPORT_CHIPS);
  const extraCount = commonSports.length - MAX_SPORT_CHIPS;
  const tagPills = displaySports.map((s) => `[${String(s).toUpperCase()}]`);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const x = info.offset.x;
    const threshold = 72;
    if (x < -threshold && onSwipeLeft) onSwipeLeft();
    else if (x > threshold && onSwipeRight) onSwipeRight();
  };

  return (
    <>
      <motion.article
        className={`${styles.card} ${matched ? styles.matched : ''}`}
        drag={reduceMotion ? false : 'x'}
        dragConstraints={{ left: -220, right: 220 }}
        dragElastic={0.85}
        dragSnapToOrigin
        onDragEnd={handleDragEnd}
        whileDrag={{ scale: 1.01 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        aria-label={`Profile card: ${profile.name}. Swipe or use keyboard.`}
      >
        <div className={styles.avatarGlow} aria-hidden />
        <div className={styles.mediaWrap} onClick={() => setDetailsOpen(true)} role="button" tabIndex={0} onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setDetailsOpen(true);
          }
        }} aria-label={`${profile.name}. Tap for details.`}>
          <img
            src={photoUrl || NO_PHOTO_PLACEHOLDER}
            alt={`${profile.name} — photo ${photoIndex + 1} of ${allPhotoUrls.length}`}
            className={styles.mediaImage}
            onError={onPhotoError}
            referrerPolicy="no-referrer"
            draggable={false}
            loading="lazy"
          />
          <div className={styles.overlay} aria-hidden />
          <div className={styles.matchRingWrap}>
            <MatchRing percent={profile.compatibilityScore ?? 50} />
          </div>
          <div className={styles.overlayContent}>
            <h2 className={styles.name}>{profile.name}</h2>
            <div className={styles.metaRow}>
              {levelLabel && <span className={styles.chipOverlay}>{levelLabel}</span>}
              {distanceLabel && <span className={styles.chipOverlay}>{distanceLabel}</span>}
            </div>
            <p className={styles.scheduleHint}>Swipe · arrows · buttons</p>
          </div>
          {allPhotoUrls.length > 1 && (
            <div className={styles.photoDots} aria-label="Photo gallery">
              {allPhotoUrls.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`${styles.photoDot} ${i === photoIndex ? styles.photoDotActive : ''}`}
                  aria-label={`Photo ${i + 1}`}
                  aria-pressed={i === photoIndex}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPhotoChange(i);
                  }}
                />
              ))}
            </div>
          )}
        </div>
        <div className={styles.content}>
          <div className={styles.tagStrip}>
            {tagPills.slice(0, 3).map((t) => (
              <span key={t} className={styles.tagPill}>
                {t}
              </span>
            ))}
          </div>
          {profile.bio && (
            <p className={bioExpanded ? styles.bioExpanded : styles.bio}>
              {profile.bio}
              {profile.bio.length > 80 && (
                <button type="button" className={styles.moreBtn} onClick={(e) => { e.stopPropagation(); setBioExpanded(!bioExpanded); }}>
                  {bioExpanded ? ' less' : ' more'}
                </button>
              )}
            </p>
          )}
          {displaySports.length > 0 && (
            <div className={styles.sportsRow}>
              {displaySports.map((s) => (
                <span key={s} className={styles.sportChip}>{s}</span>
              ))}
              {extraCount > 0 && <span className={styles.sportChip}>+{extraCount}</span>}
            </div>
          )}
          {profile.mode && <span className={styles.modeChip}>Mode: {profile.mode}</span>}
        </div>
      </motion.article>

      <ProfileDetailsModal
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        name={profile.name}
        bio={profile.bio}
        sports={profile.sportTags?.length ? profile.sportTags : commonSports}
        level={levelLabel ?? undefined}
        city={distanceLabel ?? undefined}
        mode={profile.mode}
      />
    </>
  );
};
