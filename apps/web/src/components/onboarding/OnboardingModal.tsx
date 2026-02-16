import React from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import styles from './OnboardingModal.module.css';

const STORAGE_KEY = 'gettrainmate_onboarding_modal_seen';

export function shouldShowOnboardingModal(profileComplete: boolean): boolean {
  if (profileComplete) return false;
  try {
    return !sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

export function markOnboardingModalSeen(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // ignore
  }
}

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ open, onClose }) => {
  const handleClose = () => {
    markOnboardingModalSeen();
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Complete your profile">
      <div className={styles.content}>
        <p className={styles.desc}>
          Set up your training goals, schedule, and experience level to get better matches.
        </p>
        <ul className={styles.list}>
          <li>Training goals</li>
          <li>Schedule availability</li>
          <li>Location radius</li>
          <li>Experience level</li>
        </ul>
        <div className={styles.actions}>
          <Button as="link" to="/onboarding/profile" variant="primary" fullWidth onClick={handleClose}>
            Complete profile
          </Button>
          <button type="button" className={styles.skipBtn} onClick={handleClose}>
            Maybe later
          </button>
        </div>
      </div>
    </Modal>
  );
};
