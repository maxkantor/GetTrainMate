import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './LandingEntryFlow.module.css';

const TRAINING = ['HYROX', 'Strength & conditioning', 'Running / cardio', 'CrossFit / functional'] as const;
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const;
const TIMES = ['Early (5–7am)', 'Mid-day', 'Evening'] as const;

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

  const goSignup = useCallback(() => {
    handleClose();
    navigate('/signup');
  }, [handleClose, navigate]);

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
            <button type="button" className={styles.closeX} onClick={handleClose} aria-label="Close dialog">
              ×
            </button>

            {step === 1 && (
              <div className={styles.step}>
                <h2 id="entry-flow-title" className={styles.title}>
                  Quick fit — 3 questions
                </h2>
                <p className={styles.lead}>We use this to preview matches near you.</p>

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
                <h2 className={styles.title}>3 matches found near you</h2>
                <p className={styles.lead}>Here&apos;s a preview — the middle profile is unlocked.</p>
                <div className={styles.matchRow}>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={`${styles.matchCard} ${i !== 1 ? styles.matchCardBlur : styles.matchCardClear}`}
                    >
                      <img src={PREVIEW_AVATARS[i]} alt="" className={styles.matchAvatar} width={72} height={72} />
                      <span className={styles.matchName}>{i === 1 ? 'Alex, 29' : '••• ••'}</span>
                    </div>
                  ))}
                </div>
                <button type="button" className={styles.primaryBtn} onClick={() => setStep(3)}>
                  Continue
                </button>
              </div>
            )}

            {step === 3 && (
              <div className={styles.step}>
                <h2 className={styles.title}>Unlock the rest</h2>
                <p className={styles.lead}>Free account — see everyone we matched for you.</p>
                <div className={styles.matchRow}>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={`${styles.matchCard} ${i !== 1 ? styles.matchCardBlur : styles.matchCardClear}`}
                    >
                      {i !== 1 && (
                        <div className={styles.lockBadge}>
                          <span aria-hidden>🔒</span> Locked
                        </div>
                      )}
                      <img src={PREVIEW_AVATARS[i]} alt="" className={styles.matchAvatar} width={72} height={72} />
                      <span className={styles.matchName}>{i === 1 ? 'Alex, 29' : 'Sign up to view'}</span>
                    </div>
                  ))}
                </div>
                <button type="button" className={styles.primaryBtn} onClick={goSignup}>
                  Create free account
                </button>
                <button type="button" className={styles.textBtn} onClick={handleClose}>
                  Maybe later
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
