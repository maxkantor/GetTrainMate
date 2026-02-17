import React, { useRef, useState, useCallback } from 'react';
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
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const dragOffset = useRef(0);
  const [dragX, setDragX] = useState(0);
  const prefersReducedMotion = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  if (typeof window !== 'undefined' && window.matchMedia) {
    prefersReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  const levelLabel = profile.level ? profile.level.charAt(0).toUpperCase() + profile.level.slice(1) : null;
  const distanceLabel = profile.city ? profile.city : null; // API doesn't have distance; use city for now
  const commonSports = profile.commonSports ?? profile.sportTags ?? [];
  const displaySports = commonSports.slice(0, MAX_SPORT_CHIPS);
  const extraCount = commonSports.length - MAX_SPORT_CHIPS;

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      touchStart.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY };
      dragOffset.current = 0;
    },
    []
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current || !onSwipeLeft || !onSwipeRight) return;
      const x = e.targetTouches[0].clientX;
      const delta = x - touchStart.current.x;
      dragOffset.current = delta;
      if (!prefersReducedMotion.current) {
        setDragX(Math.max(-120, Math.min(120, delta * 0.5)));
      }
    },
    [onSwipeLeft, onSwipeRight]
  );

  const handleTouchEnd = useCallback(() => {
    if (!touchStart.current) return;
    const delta = dragOffset.current;
    touchStart.current = null;
    setDragX(0);
    const threshold = 60;
    if (delta < -threshold && onSwipeLeft) onSwipeLeft();
    else if (delta > threshold && onSwipeRight) onSwipeRight();
  }, [onSwipeLeft, onSwipeRight]);

  const handlePhotoClick = () => {
    setDetailsOpen(true);
  };

  return (
    <>
      <article
        ref={cardRef}
        className={`${styles.card} ${matched ? styles.matched : ''}`}
        style={
          !prefersReducedMotion.current && dragX !== 0
            ? { transform: `translateX(${dragX}px) rotate(${dragX * 0.03}deg)` }
            : undefined
        }
        aria-label={`Profile card: ${profile.name}. Swipe left to pass, right to like.`}
      >
        <div
          className={styles.mediaWrap}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handlePhotoClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handlePhotoClick();
            }
          }}
          aria-label={`${profile.name}. Tap to view full profile.`}
        >
          <img
            src={photoUrl}
            alt={`${profile.name} — photo ${photoIndex + 1} of ${allPhotoUrls.length}`}
            className={styles.mediaImage}
            onError={onPhotoError}
            referrerPolicy="no-referrer"
            draggable={false}
          />
          <div className={styles.overlay} aria-hidden />
          <div className={styles.overlayContent}>
            <h2 className={styles.name}>{profile.name}</h2>
            <div className={styles.chipsRow}>
              {levelLabel && <span className={styles.chipOverlay}>{levelLabel}</span>}
              {distanceLabel && <span className={styles.chipOverlay}>{distanceLabel}</span>}
            </div>
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
          {profile.bio && (
            <p className={bioExpanded ? styles.bioExpanded : styles.bio}>
              {profile.bio}
              {profile.bio.length > 80 && (
                <button
                  type="button"
                  className={styles.moreBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    setBioExpanded(!bioExpanded);
                  }}
                >
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
          {profile.mode && (
            <span className={styles.modeChip}>Mode: {profile.mode}</span>
          )}
        </div>
      </article>

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
