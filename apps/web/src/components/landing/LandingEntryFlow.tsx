import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '@/services/authService';
import { saveLandingPrefs } from '@/utils/landingPrefs';
import { useI18n } from '@/hooks/useI18n';
import { FooterLegalLinksRow } from '@/components/layout/FooterLegalLinksRow';
import { LANDING_TRAINING_OPTIONS } from '@/config/landingTrainingOptions';
import {
  fetchLandingMatchPreview,
  type LandingMatchPreviewResult,
  type LandingMatchPreviewUser,
} from '@/services/matchPreviewService';
import { DUMMY_USER_PRIMARY_PHOTO } from '@/utils/profilePhotos';
import styles from './LandingEntryFlow.module.css';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const;
const TIMES = ['Morning (5–9am)', 'Mid-day', 'Evening'] as const;

const DEFAULT_TRAINING = 'Gym';
const DEFAULT_LEVEL: (typeof LEVELS)[number] = 'Intermediate';
const DEFAULT_TIME: (typeof TIMES)[number] = 'Evening';

const ANALYZE_MESSAGES = [
  'Analyzing your training style…',
  'Finding compatible athletes…',
  'Building your matches…',
] as const;

const MIN_ANALYZE_MS = 1650;

/** Labeled demo when API fails (aligned with seeded dummy-user-1 / server BuildDemoUser). */
const OFFLINE_DEMO: LandingMatchPreviewResult = {
  kind: 'demo',
  matchCount: 1,
  exampleLabel: 'Example match based on your preferences',
  users: [
    {
      name: 'Sarah Runner',
      age: 28,
      trainingSummary: 'Running · Yoga · Hiking',
      goalLine: 'Complete a sub-4 hour marathon',
      photoUrl: DUMMY_USER_PRIMARY_PHOTO['dummy-user-1'],
    },
  ],
};

function previewHeadline(preview: LandingMatchPreviewResult | null): string {
  if (!preview) return '';
  if (preview.kind === 'empty') return 'No athletes available yet';
  if (preview.kind === 'demo') return '🔥 Example athlete based on your preferences';
  const n = preview.matchCount;
  if (n <= 0) return '🔥 Example athlete based on your preferences';
  if (n === 1) return '🔥 1 athlete matches your training preferences';
  return `🔥 ${n} athletes match your training preferences`;
}

function formatCardName(u: LandingMatchPreviewUser): string {
  const agePart = u.age != null && u.age > 0 ? `, ${u.age}` : '';
  return `${u.name.trim()}${agePart}`;
}

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
  const [preview, setPreview] = useState<LandingMatchPreviewResult | null>(null);
  const [previewLoadFailed, setPreviewLoadFailed] = useState(false);

  const reset = useCallback(() => {
    setStep(1);
    setTraining(DEFAULT_TRAINING);
    setLevel(DEFAULT_LEVEL);
    setTimePref(DEFAULT_TIME);
    setIsAnalyzing(false);
    setAnalyzeMsgIndex(0);
    setPreview(null);
    setPreviewLoadFailed(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const step1Valid = Boolean(training && level && timePref);

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

  const goEmptySignup = useCallback(() => {
    saveLandingPrefs({ training, level, timePref });
    handleClose();
    navigate('/signup');
  }, [training, level, timePref, handleClose, navigate]);

  useEffect(() => {
    if (open) {
      setStep(1);
      setTraining(DEFAULT_TRAINING);
      setLevel(DEFAULT_LEVEL);
      setTimePref(DEFAULT_TIME);
      setIsAnalyzing(false);
      setAnalyzeMsgIndex(0);
      setPreview(null);
      setPreviewLoadFailed(false);
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

    return () => {
      cancelled = true;
      window.clearTimeout(tMsg0);
      window.clearTimeout(tMsg1);
    };
  }, [isAnalyzing]);

  const runAnalyze = async () => {
    if (!step1Valid) return;
    setAnalyzeMsgIndex(0);
    setIsAnalyzing(true);
    setPreviewLoadFailed(false);

    const minDelay = new Promise<void>((r) => window.setTimeout(r, MIN_ANALYZE_MS));
    const apiResult = fetchLandingMatchPreview({
      trainingLabel: training,
      level,
      timePref,
    });

    const [, fetched] = await Promise.all([minDelay, apiResult]);

    let next: LandingMatchPreviewResult;
    let loadFailed = false;
    if (fetched) {
      next = fetched;
    } else {
      loadFailed = true;
      next = OFFLINE_DEMO;
    }

    setPreview(next);
    setPreviewLoadFailed(loadFailed);
    setIsAnalyzing(false);
    setAnalyzeMsgIndex(0);
    setStep(2);
  };

  const primaryPreviewUser = preview?.users?.[0];
  const showMoreCount =
    preview && preview.kind === 'real' && preview.matchCount > 1 ? preview.matchCount - 1 : 0;

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
                <p className={styles.analyzeKicker}>Compatibility matching</p>
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
                  Tell us how you train — we&apos;ll show compatible athletes from the network.
                </p>

                <div className={styles.field}>
                  <span className={styles.label}>
                    <span className={styles.labelIcon} aria-hidden>
                      🏋️
                    </span>{' '}
                    Training type
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
                  <p className={styles.fieldHint}>Used to match you with compatible athletes</p>
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
                  <p className={styles.fieldHint}>Used to match you with compatible athletes</p>
                </div>

                <div className={styles.field}>
                  <span className={styles.label}>
                    <span className={styles.labelIcon} aria-hidden>
                      ⏰
                    </span>{' '}
                    Preferred time
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
                  <p className={styles.fieldHint}>Used to match you with compatible athletes</p>
                </div>

                <button
                  type="button"
                  className={`${styles.primaryBtn} ${styles.primaryBtnPulse}`}
                  disabled={!step1Valid}
                  onClick={() => void runAnalyze()}
                >
                  Find My Training Partners
                </button>
                <p className={styles.ctaMicro}>Takes 10 seconds • No signup required</p>
              </div>
            )}

            {step === 2 && preview?.kind === 'empty' && (
              <div className={styles.step}>
                <h2 className={styles.title}>{previewHeadline(preview)}</h2>
                <p className={styles.lead}>Be the first to join or invite others</p>
                <button type="button" className={`${styles.primaryBtn} ${styles.primaryBtnPulse}`} onClick={goEmptySignup}>
                  Create your account
                </button>
              </div>
            )}

            {step === 2 && preview && preview.kind !== 'empty' && primaryPreviewUser && (
              <div className={styles.step}>
                <h2 className={styles.title}>{previewHeadline(preview)}</h2>
                {preview.exampleLabel && (
                  <p className={styles.exampleLabel}>{preview.exampleLabel}</p>
                )}
                {previewLoadFailed && (
                  <p className={styles.loadWarning}>Couldn&apos;t load live data — showing a labeled example.</p>
                )}
                <p className={styles.lead}>Based on your training type, level, and schedule</p>
                {showMoreCount > 0 && (
                  <p className={styles.moreMatchesHint}>
                    +{showMoreCount} more compatible {showMoreCount === 1 ? 'profile' : 'profiles'} after signup
                  </p>
                )}
                <div className={styles.deck}>
                  <div
                    className={`${styles.deckCard} ${styles.deckBack} ${styles.deckLeft} ${styles.deckGhost}`}
                    aria-hidden
                  />
                  <div
                    className={`${styles.deckCard} ${styles.deckBack} ${styles.deckRight} ${styles.deckGhost}`}
                    aria-hidden
                  />
                  <div className={`${styles.deckCard} ${styles.deckFront}`}>
                    {primaryPreviewUser.photoUrl ? (
                      <img
                        src={primaryPreviewUser.photoUrl}
                        alt=""
                        className={styles.deckAvatar}
                        width={96}
                        height={96}
                      />
                    ) : (
                      <div className={styles.deckAvatarPlaceholder} aria-hidden />
                    )}
                    <span className={styles.deckName}>{formatCardName(primaryPreviewUser)}</span>
                    <span className={styles.deckMeta}>{primaryPreviewUser.trainingSummary}</span>
                    <ul className={styles.deckStats}>
                      <li>⚡ {preview.kind === 'demo' ? 'Trains 4–5x/week' : 'Trains regularly'}</li>
                      <li>🎯 {primaryPreviewUser.goalLine}</li>
                    </ul>
                    <p className={styles.lockedDataLine}>
                      🔒 Distance, location, and availability unlock after signup
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className={`${styles.primaryBtn} ${styles.primaryBtnPulse}`}
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
                <p className={styles.lead}>You already have compatible athletes waiting</p>
                <p className={styles.paywallTrust}>We&apos;ll show distance and availability after signup</p>
                <p className={styles.paywallUrgency}>⏳ Matches update daily</p>
                <p className={styles.paywallSocial}>New athletes join every day — your matches update as the network grows.</p>
                <div className={`${styles.deck} ${styles.deckPaywall}`}>
                  <div
                    className={`${styles.deckCard} ${styles.deckBack} ${styles.deckLeft} ${styles.deckLockedHeavy} ${styles.deckGhost}`}
                    aria-hidden
                  >
                    <div className={styles.lockBadge}>
                      <span aria-hidden>🔒</span> Locked
                    </div>
                  </div>
                  <div
                    className={`${styles.deckCard} ${styles.deckBack} ${styles.deckRight} ${styles.deckLockedHeavy} ${styles.deckGhost}`}
                    aria-hidden
                  >
                    <div className={styles.lockBadge}>
                      <span aria-hidden>🔒</span> Locked
                    </div>
                  </div>
                  <div className={`${styles.deckCard} ${styles.deckFront} ${styles.deckDim} ${styles.deckPaywallFront}`}>
                    <div className={styles.lockOverlay} aria-hidden>
                      <span className={styles.lockIcon}>🔒</span>
                    </div>
                    {primaryPreviewUser?.photoUrl ? (
                      <img
                        src={primaryPreviewUser.photoUrl}
                        alt=""
                        className={styles.deckAvatar}
                        width={96}
                        height={96}
                      />
                    ) : (
                      <div className={styles.deckAvatarPlaceholder} aria-hidden />
                    )}
                    <span className={styles.deckName}>Sign up to view</span>
                  </div>
                </div>
                <button type="button" className={styles.googleBtn} onClick={handleGoogle}>
                  <span className={styles.googleMark} aria-hidden />
                  Continue with Google
                </button>
                <button type="button" className={`${styles.primaryBtn} ${styles.primaryBtnPulse}`} onClick={persistPrefsAndGoSignup}>
                  Continue with email
                </button>
                <p className={styles.ctaMicro}>Free to start • Takes 10 seconds</p>
              </div>
            )}

            <footer className={styles.modalFooter} aria-label={t('footer.legal')}>
              <FooterLegalLinksRow variant="modal" onLinkClick={handleClose} />
              <p className={styles.modalFooterCopyright}>
                © {new Date().getFullYear()} {t('common.appName')}. {t('footer.all_rights_reserved')}
              </p>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
