import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '@/services/authService';
import { saveLandingPrefs } from '@/utils/landingPrefs';
import { useI18n } from '@/hooks/useI18n';
import { FooterLegalLinksRow } from '@/components/layout/FooterLegalLinksRow';
import { LANDING_TRAINING_OPTIONS } from '@/config/landingTrainingOptions';
import styles from './LandingEntryFlow.module.css';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const;
const TIMES = ['Morning (5–9am)', 'Mid-day', 'Evening'] as const;

const DEFAULT_TRAINING = 'Gym';
const DEFAULT_LEVEL: (typeof LEVELS)[number] = 'Intermediate';
const DEFAULT_TIME: (typeof TIMES)[number] = 'Evening';

const ANALYZE_MESSAGES = [
  'Analyzing your training level…',
  'Finding athletes near you…',
  'Matching schedules…',
] as const;

const ANALYZE_MS = 1750;

const PREVIEW_GOAL_FALLBACK = 'Strength & conditioning';

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
  const [training, setTraining] = useState(DEFAULT_TRAINING);
  const [level, setLevel] = useState<string>(DEFAULT_LEVEL);
  const [timePref, setTimePref] = useState<string>(DEFAULT_TIME);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeMsgIndex, setAnalyzeMsgIndex] = useState(0);

  const reset = useCallback(() => {
    setStep(1);
    setTraining(DEFAULT_TRAINING);
    setLevel(DEFAULT_LEVEL);
    setTimePref(DEFAULT_TIME);
    setIsAnalyzing(false);
    setAnalyzeMsgIndex(0);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const step1Valid = Boolean(training && level && timePref);

  const previewGoalLabel = training === 'Gym' ? PREVIEW_GOAL_FALLBACK : training || PREVIEW_GOAL_FALLBACK;

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
      setTraining(DEFAULT_TRAINING);
      setLevel(DEFAULT_LEVEL);
      setTimePref(DEFAULT_TIME);
      setIsAnalyzing(false);
      setAnalyzeMsgIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!isAnalyzing) return;

    let cancelled = false;
    const tMsg0 = window.setTimeout(() => {
      if (!cancelled) setAnalyzeMsgIndex(1);
    }, 520);
    const tMsg1 = window.setTimeout(() => {
      if (!cancelled) setAnalyzeMsgIndex(2);
    }, 1040);
    const tDone = window.setTimeout(() => {
      if (!cancelled) {
        setIsAnalyzing(false);
        setAnalyzeMsgIndex(0);
        setStep(2);
      }
    }, ANALYZE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(tMsg0);
      window.clearTimeout(tMsg1);
      window.clearTimeout(tDone);
    };
  }, [isAnalyzing]);

  const runAnalyze = () => {
    if (!step1Valid) return;
    setAnalyzeMsgIndex(0);
    setIsAnalyzing(true);
  };

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
          aria-busy={isAnalyzing}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
        >
          <button type="button" className={styles.backdropHit} aria-label="Close" onClick={handleClose} />
          <motion.div
            className={styles.panel}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            {(step === 2 || step === 3 || (step === 1 && !isAnalyzing)) && (
              <button type="button" className={styles.closeX} onClick={handleClose} aria-label="Close dialog">
                ×
              </button>
            )}

            {step === 1 && isAnalyzing && (
              <div className={styles.step}>
                <div className={styles.analyzeVisual} aria-hidden>
                  <div className={styles.shimmerRing} />
                  <div className={styles.pulseCore} />
                </div>
                <p className={styles.analyzeKicker}>AI matching</p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={analyzeMsgIndex}
                    className={styles.analyzeText}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                  >
                    {ANALYZE_MESSAGES[analyzeMsgIndex]}
                  </motion.p>
                </AnimatePresence>
                <div className={styles.shimmerBar} aria-hidden />
              </div>
            )}

            {step === 1 && !isAnalyzing && (
              <div className={styles.step}>
                <div className={styles.titleRow}>
                  <h2 id="entry-flow-title" className={styles.title}>
                    Quick setup
                  </h2>
                  <span className={styles.premiumBadge} title="Premium athlete matching">
                    $10M premium
                  </span>
                </div>
                <p className={styles.lead}>
                  Tell us how you train — we&apos;ll surface serious partners who match your rhythm.
                </p>

                <div className={styles.field}>
                  <span className={styles.label}>
                    <span className={styles.labelIcon} aria-hidden>
                      🏋️
                    </span>{' '}
                    Training
                  </span>
                  <div className={styles.selectWrap}>
                    <select
                      className={styles.select}
                      value={training}
                      onChange={(e) => setTraining(e.target.value)}
                      aria-label="Training type"
                    >
                      {LANDING_TRAINING_OPTIONS.map((o) => (
                        <option key={o.label} value={o.label}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className={styles.fieldHint}>Used to match you with serious athletes nearby</p>
                </div>

                <div className={styles.field}>
                  <span className={styles.label}>
                    <span className={styles.labelIcon} aria-hidden>
                      📊
                    </span>{' '}
                    Level
                  </span>
                  <div className={styles.selectWrap}>
                    <select
                      className={styles.select}
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      aria-label="Training level"
                    >
                      {LEVELS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className={styles.fieldHint}>We pair you with people who push at your pace</p>
                </div>

                <div className={styles.field}>
                  <span className={styles.label}>
                    <span className={styles.labelIcon} aria-hidden>
                      ⏰
                    </span>{' '}
                    Time
                  </span>
                  <div className={styles.selectWrap}>
                    <select
                      className={styles.select}
                      value={timePref}
                      onChange={(e) => setTimePref(e.target.value)}
                      aria-label="Preferred training time"
                    >
                      {TIMES.map((tOpt) => (
                        <option key={tOpt} value={tOpt}>
                          {tOpt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className={styles.fieldHint}>So your sessions actually line up in real life</p>
                </div>

                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={!step1Valid}
                  onClick={runAnalyze}
                >
                  Find My Training Partners
                </button>
                <p className={styles.ctaMicro}>Takes 10 seconds • No signup yet</p>
              </div>
            )}

            {step === 2 && (
              <div className={styles.step}>
                <h2 className={styles.title}>🔥 3 serious athletes ready to train with you</h2>
                <p className={styles.lead}>Matched to your level and schedule</p>
                <p className={styles.urgencyLine}>⚡ 1 is available tomorrow morning</p>
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
                    <ul className={styles.deckStats}>
                      <li>📍 0.8 miles away</li>
                      <li>⚡ Trains 4–5x/week</li>
                      <li>🎯 {previewGoalLabel}</li>
                    </ul>
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
                <h2 className={styles.title}>Unlock your matches</h2>
                <p className={styles.lead}>You already have 3 athletes waiting</p>
                <p className={styles.paywallUrgency}>⏳ Matches refresh every 24 hours</p>
                <p className={styles.paywallSocial}>🔥 12,000+ athletes matched this week</p>
                <div className={`${styles.deck} ${styles.deckPaywall}`}>
                  <div className={`${styles.deckCard} ${styles.deckBack} ${styles.deckLeft} ${styles.deckLockedHeavy}`} aria-hidden>
                    <div className={styles.lockBadge}>
                      <span aria-hidden>🔒</span> Locked
                    </div>
                    <img src={PREVIEW_AVATARS[0]} alt="" className={styles.deckAvatar} width={88} height={88} />
                  </div>
                  <div className={`${styles.deckCard} ${styles.deckBack} ${styles.deckRight} ${styles.deckLockedHeavy}`} aria-hidden>
                    <div className={styles.lockBadge}>
                      <span aria-hidden>🔒</span> Locked
                    </div>
                    <img src={PREVIEW_AVATARS[2]} alt="" className={styles.deckAvatar} width={88} height={88} />
                  </div>
                  <div className={`${styles.deckCard} ${styles.deckFront} ${styles.deckDim} ${styles.deckPaywallFront}`}>
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
                <p className={styles.ctaMicro}>Free to start • Takes 10 seconds</p>
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
