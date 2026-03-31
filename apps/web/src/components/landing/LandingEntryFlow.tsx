import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '@/services/authService';
import { saveLandingPrefs } from '@/utils/landingPrefs';
import { useI18n } from '@/hooks/useI18n';
import { FooterLegalLinksRow } from '@/components/layout/FooterLegalLinksRow';
import styles from './LandingEntryFlow.module.css';

const TRAINING = ['HYROX', 'Strength & conditioning', 'Running / cardio', 'CrossFit / functional'] as const;
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const;
const TIMES = ['Morning (5–9am)', 'Mid-day', 'Evening'] as const;

const PREVIEW_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&h=120&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=120&h=120&fit=crop&crop=faces',
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
};

export const LandingEntryFlow: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [training, setTraining] = useState<string>('');
  const [level, setLevel] = useState<string>('');
  const [timePref, setTimePref] = useState<string>('');

  const reset = useCallback(() => {
    setStep(1);
    setTraining('');
    setLevel('');
    setTimePref('');
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const step1Valid = training && level && timePref;

  const persistPrefsAndGoSignup = useCallback(() => {
    saveLandingPrefs({ training, level, timePref });
    handleClose();
    navigate('/signup');
  }, [training, level, timePref, handleClose, navigate]);

  const handleGoogle = useCallback(async () => {
    saveLandingPrefs({ training, level, timePref });
    const { started, error } = await authService.signInWithGoogle();
    if (!started) {
      console.warn('Google sign-in:', error);
      handleClose();
      navigate('/login', { state: { fromLanding: true, hint: error } });
    }
  }, [training, level, timePref, handleClose, navigate]);

  useEffect(() => {
    if (open) {
      setStep(1);
      setTraining('');
      setLevel('');
      setTimePref('');
    }
  }, [open]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="landing-entry-flow"
          className={styles.backdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="entry-flow-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button type="button" className={styles.backdropHit} aria-label="Close" onClick={handleClose} />
          <motion.div
            className={styles.panel}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            {step !== 3 && (
              <button type="button" className={styles.closeX} onClick={handleClose} aria-label="Close dialog">
                ×
              </button>
            )}

            {step === 1 && (
              <div className={styles.step}>
                <h2 id="entry-flow-title" className={styles.title}>
                  Quick setup
                </h2>
                <p className={styles.lead}>No account yet — we use this to preview partners near you.</p>

                <label className={styles.field}>
                  <span className={styles.label}>Training type</span>
                  <select
                    className={styles.select}
                    value={training}
                    onChange={(e) => setTraining(e.target.value)}
                  >
                    <option value="">Choose one</option>
                    {TRAINING.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Level</span>
                  <select className={styles.select} value={level} onChange={(e) => setLevel(e.target.value)}>
                    <option value="">Choose one</option>
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Preferred time</span>
                  <select className={styles.select} value={timePref} onChange={(e) => setTimePref(e.target.value)}>
                    <option value="">Choose one</option>
                    {TIMES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={!step1Valid}
                  onClick={() => setStep(2)}
                >
                  Show my matches
                </button>
              </div>
            )}

            {step === 2 && (
              <div className={styles.step}>
                <h2 className={styles.title}>🔥 3 athletes found near you</h2>
                <p className={styles.lead}>Here&apos;s who fits your schedule — one profile unlocked.</p>
                <div className={styles.deck}>
                  <div className={`${styles.deckCard} ${styles.deckBack} ${styles.deckLeft}`} aria-hidden>
                    <img src={PREVIEW_AVATARS[0]} alt="" className={styles.deckAvatar} width={88} height={88} />
                  </div>
                  <div className={`${styles.deckCard} ${styles.deckBack} ${styles.deckRight}`} aria-hidden>
                    <img src={PREVIEW_AVATARS[2]} alt="" className={styles.deckAvatar} width={88} height={88} />
                  </div>
                  <div className={`${styles.deckCard} ${styles.deckFront}`}>
                    <img src={PREVIEW_AVATARS[1]} alt="" className={styles.deckAvatar} width={96} height={96} />
                    <span className={styles.deckName}>Jordan, 27</span>
                    <span className={styles.deckMeta}>Near you · {training || 'Your sport'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => {
                    saveLandingPrefs({ training, level, timePref });
                    setStep(3);
                  }}
                >
                  Continue
                </button>
              </div>
            )}

            {step === 3 && (
              <div className={styles.step}>
                <h2 className={styles.title}>Create your account to view your matches</h2>
                <p className={styles.lead}>
                  Continue with Google or email to unlock — your preview is waiting.
                </p>
                <div className={styles.deck}>
                  <div className={`${styles.deckCard} ${styles.deckBack} ${styles.deckLeft}`} aria-hidden>
                    <div className={styles.lockBadge}>
                      <span aria-hidden>🔒</span> Locked
                    </div>
                    <img src={PREVIEW_AVATARS[0]} alt="" className={styles.deckAvatar} width={88} height={88} />
                  </div>
                  <div className={`${styles.deckCard} ${styles.deckBack} ${styles.deckRight}`} aria-hidden>
                    <div className={styles.lockBadge}>
                      <span aria-hidden>🔒</span> Locked
                    </div>
                    <img src={PREVIEW_AVATARS[2]} alt="" className={styles.deckAvatar} width={88} height={88} />
                  </div>
                  <div className={`${styles.deckCard} ${styles.deckFront} ${styles.deckDim}`}>
                    <div className={styles.lockOverlay} aria-hidden>
                      <span className={styles.lockIcon}>🔒</span>
                    </div>
                    <img src={PREVIEW_AVATARS[1]} alt="" className={styles.deckAvatar} width={96} height={96} />
                    <span className={styles.deckName}>Sign up to view</span>
                  </div>
                </div>
                <button type="button" className={styles.googleBtn} onClick={handleGoogle}>
                  <span className={styles.googleMark} aria-hidden />
                  Continue with Google
                </button>
                <button type="button" className={styles.primaryBtn} onClick={persistPrefsAndGoSignup}>
                  Continue with email
                </button>
              </div>
            )}

            <footer className={styles.modalFooter} aria-label={t('footer.legal')}>
              <FooterLegalLinksRow variant="modal" onLinkClick={handleClose} />
              <p className={styles.modalFooterCopyright}>
                © {new Date().getFullYear()} {t('common.appName')}
              </p>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
