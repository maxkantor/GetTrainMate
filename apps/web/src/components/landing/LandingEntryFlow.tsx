import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '@/services/authService';
import { saveLandingPrefs } from '@/utils/landingPrefs';
import { useI18n } from '@/hooks/useI18n';
import { formatI18n } from '@/i18n';
import { FooterLegalLinksRow } from '@/components/layout/FooterLegalLinksRow';
import { LANDING_TRAINING_OPTIONS } from '@/config/landingTrainingOptions';
import {
  fetchLandingMatchPreview,
  type LandingMatchPreviewResult,
  type LandingMatchPreviewUser,
} from '@/services/matchPreviewService';
import { DUMMY_USER_PRIMARY_PHOTO } from '@/utils/profilePhotos';
import styles from './LandingEntryFlow.module.css';

const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
const TIMES = ['morning', 'midday', 'evening'] as const;

const DEFAULT_TRAINING = 'Gym';
const DEFAULT_LEVEL: (typeof LEVELS)[number] = 'intermediate';
const DEFAULT_TIME: (typeof TIMES)[number] = 'evening';

const ANALYZE_MESSAGES = ['entry_analyze_1', 'entry_analyze_2', 'entry_analyze_3'] as const;

const MIN_ANALYZE_MS = 1650;

/** Labeled demo when API fails (aligned with seeded dummy-user-1 / server BuildDemoUser). */
const OFFLINE_DEMO: LandingMatchPreviewResult = {
  kind: 'demo',
  matchCount: 1,
  exampleLabel: '',
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
  if (preview.kind === 'empty') return 'entry_headline_empty';
  if (preview.kind === 'demo') return 'entry_headline_demo';
  const n = preview.matchCount;
  if (n <= 0) return 'entry_headline_demo';
  if (n === 1) return 'entry_headline_one';
  return 'entry_headline_many';
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
          <button type="button" className={styles.backdropHit} aria-label={t('common.close')} onClick={handleClose} />
          <motion.div
            className={styles.panel}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            {(step === 2 || step === 3 || (step === 1 && !isAnalyzing)) && (
              <button type="button" className={styles.closeX} onClick={handleClose} aria-label={t('landing.entry_close_dialog')}>
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
                    {t(`landing.${ANALYZE_MESSAGES[analyzeMsgIndex]}`)}
                  </motion.p>
                </AnimatePresence>
                <div className={styles.shimmerBar} aria-hidden />
              </div>
            )}

            {step === 1 && !isAnalyzing && (
              <div className={styles.step}>
                <h2 id="entry-flow-title" className={styles.title}>
                  {t('landing.entry_quick_setup')}
                </h2>
                <p className={styles.lead}>
                  {t('landing.entry_lead')}
                </p>

                <div className={styles.field}>
                  <span className={styles.label}>
                    <span className={styles.labelIcon} aria-hidden>
                      🏋️
                    </span>{' '}
                    {t('landing.entry_training_type')}
                  </span>
                  <div className={styles.selectWrap}>
                    <select
                      className={styles.select}
                      value={training}
                      onChange={(e) => setTraining(e.target.value)}
                      aria-label={t('landing.entry_training_type')}
                    >
                      {LANDING_TRAINING_OPTIONS.map((o) => (
                        <option key={o.label} value={o.label}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className={styles.fieldHint}>{t('landing.entry_field_hint')}</p>
                </div>

                <div className={styles.field}>
                  <span className={styles.label}>
                    <span className={styles.labelIcon} aria-hidden>
                      📊
                    </span>{' '}
                    {t('landing.entry_level_label')}
                  </span>
                  <div className={styles.selectWrap}>
                    <select
                      className={styles.select}
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      aria-label={t('landing.entry_level_label')}
                    >
                      {LEVELS.map((l) => (
                        <option key={l} value={l}>
                          {t(`landing.entry_level_${l}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className={styles.fieldHint}>{t('landing.entry_field_hint')}</p>
                </div>

                <div className={styles.field}>
                  <span className={styles.label}>
                    <span className={styles.labelIcon} aria-hidden>
                      ⏰
                    </span>{' '}
                    {t('landing.entry_time_label')}
                  </span>
                  <div className={styles.selectWrap}>
                    <select
                      className={styles.select}
                      value={timePref}
                      onChange={(e) => setTimePref(e.target.value)}
                      aria-label={t('landing.entry_time_label')}
                    >
                      {TIMES.map((tOpt) => (
                        <option key={tOpt} value={tOpt}>
                          {t(`landing.entry_time_${tOpt}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className={styles.fieldHint}>{t('landing.entry_field_hint')}</p>
                </div>

                <button
                  type="button"
                  className={`${styles.primaryBtn} ${styles.primaryBtnPulse}`}
                  disabled={!step1Valid}
                  onClick={() => void runAnalyze()}
                >
                  {t('landing.landing_primary_cta')}
                </button>
                <p className={styles.ctaMicro}>{t('landing.landing_cta_sub')}</p>
              </div>
            )}

            {step === 2 && preview?.kind === 'empty' && (
              <div className={styles.step}>
                <h2 className={styles.title}>{t(`landing.${previewHeadline(preview)}`)}</h2>
                <p className={styles.lead}>{t('landing.entry_empty_lead')}</p>
                <button type="button" className={`${styles.primaryBtn} ${styles.primaryBtnPulse}`} onClick={goEmptySignup}>
                  {t('landing.entry_create_account')}
                </button>
              </div>
            )}

            {step === 2 && preview && preview.kind !== 'empty' && primaryPreviewUser && (
              <div className={styles.step}>
                <h2 className={styles.title}>
                  {previewHeadline(preview) === 'entry_headline_many'
                    ? formatI18n(t('landing.entry_headline_many'), { count: preview.matchCount })
                    : t(`landing.${previewHeadline(preview)}`)}
                </h2>
                {preview.exampleLabel && (
                  <p className={styles.exampleLabel}>{preview.exampleLabel}</p>
                )}
                {previewLoadFailed && (
                  <p className={styles.loadWarning}>{t('landing.entry_load_warning')}</p>
                )}
                <p className={styles.lead}>{t('landing.entry_based_on')}</p>
                {showMoreCount > 0 && (
                  <p className={styles.moreMatchesHint}>
                    +{showMoreCount} {t(showMoreCount === 1 ? 'landing.entry_more_profile_one' : 'landing.entry_more_profile_many')}
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
                      <li>⚡ {preview.kind === 'demo' ? t('landing.entry_trains_4_5') : t('landing.entry_trains_regularly')}</li>
                      <li>🎯 {primaryPreviewUser.goalLine}</li>
                    </ul>
                    <p className={styles.lockedDataLine}>
                      {t('landing.entry_locked_data_line')}
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
                  {t('landing.entry_continue')}
                </button>
              </div>
            )}

            {step === 3 && (
              <div className={styles.step}>
                <h2 className={styles.title}>{t('landing.entry_unlock_matches')}</h2>
                <p className={styles.lead}>{t('landing.entry_paywall_lead')}</p>
                <p className={styles.paywallTrust}>{t('landing.entry_paywall_trust')}</p>
                <p className={styles.paywallSocial}>{t('landing.entry_paywall_social')}</p>
                <div className={`${styles.deck} ${styles.deckPaywall}`}>
                  <div
                    className={`${styles.deckCard} ${styles.deckBack} ${styles.deckLeft} ${styles.deckLockedHeavy} ${styles.deckGhost}`}
                    aria-hidden
                  >
                    <div className={styles.lockBadge}>
                      <span aria-hidden>🔒</span> {t('landing.entry_locked')}
                    </div>
                  </div>
                  <div
                    className={`${styles.deckCard} ${styles.deckBack} ${styles.deckRight} ${styles.deckLockedHeavy} ${styles.deckGhost}`}
                    aria-hidden
                  >
                    <div className={styles.lockBadge}>
                      <span aria-hidden>🔒</span> {t('landing.entry_locked')}
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
                    <span className={styles.deckName}>{t('landing.entry_sign_up_to_view')}</span>
                  </div>
                </div>
                <button type="button" className={styles.googleBtn} onClick={handleGoogle}>
                  <span className={styles.googleMark} aria-hidden />
                  {t('landing.entry_continue_google')}
                </button>
                <button type="button" className={`${styles.primaryBtn} ${styles.primaryBtnPulse}`} onClick={persistPrefsAndGoSignup}>
                  {t('landing.entry_continue_email')}
                </button>
                <p className={styles.ctaMicro}>{t('landing.landing_cta_sub')}</p>
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
