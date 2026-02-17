import React from 'react';
import styles from './ProfileDetailsModal.module.css';

interface ProfileDetailsModalProps {
  open: boolean;
  onClose: () => void;
  name: string;
  bio?: string;
  sports: string[];
  level?: string;
  city?: string;
  mode?: string;
}

export const ProfileDetailsModal: React.FC<ProfileDetailsModalProps> = ({
  open,
  onClose,
  name,
  bio,
  sports,
  level,
  city,
  mode,
}) => {
  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="presentation"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="profile-modal-title" className={styles.title}>
          {name}
        </h2>
        {city && <p className={styles.meta}>{city}</p>}
        {level && <span className={styles.chip}>{level}</span>}
        {mode && <span className={styles.chip}>Mode: {mode}</span>}
        {bio && <p className={styles.bio}>{bio}</p>}
        {sports.length > 0 && (
          <div className={styles.sportsSection}>
            <p className={styles.sectionTitle}>Sports</p>
            <div className={styles.chips}>
              {sports.map((s) => (
                <span key={s} className={styles.sportChip}>{s}</span>
              ))}
            </div>
          </div>
        )}
        <button type="button" className={styles.closeBtn} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};
