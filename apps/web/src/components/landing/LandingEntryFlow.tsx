import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '@/services/authService';
import { saveLandingPrefs } from '@/utils/landingPrefs';
import { useI18n } from '@/hooks/useI18n';
import { LANDING_TRAINING_OPTIONS } from '@/config/landingTrainingOptions';
import {
  fetchLandingMatchPreview,
  type LandingMatchPreviewResult,
  type LandingMatchPreviewUser,
} from '@/services/matchPreviewService';
import { DUMMY_USER_PRIMARY_PHOTO } from '@/utils/profilePhotos';
import { analytics } from '@/utils/analytics';
import styles from './LandingEntryFlow.module.css';

const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
const TIMES = ['morning', 'midday', 'evening'] as const;

const DEFAULT_TRAINING = 'Gym';
const DEFAULT_LEVEL: (typeof LEVELS)[number] = 'intermediate';
const DEFAULT_TIME: (typeof TIMES)[number] = 'evening';

const ANALYZE_MESSAGES = ['entry_analyze_1', 'entry_analyze_2', 'entry_analyze_3'] as const;

const MIN_ANALYZE_MS = 1650;

function humanizeTimePref(timePref: string): string {
  const s = timePref.toLowerCase();
  if (s.includes('morning')) return 'Morning';
  if (s.includes('mid')) return 'Midday';
  if (s.includes('evening')) return 'Evening';
  return 'Evening';
}

/** Honest guest line: visitor’s training + level + time only (no location). */
function guestPreferenceLine(training: string, level: string, timePref: string, t: (key: string) => string): string {
  const levelText =
    level === 'beginner' || level === 'intermediate' || level === 'advanced'
      ? t(`landing.entry_level_${level}`)
      : `${level.charAt(0).toUpperCase()}${level.slice(1).toLowerCase()}`;
  const timeText =
    timePref === 'morning' || timePref === 'midday' || timePref === 'evening'
      ? t(`landing.entry_pref_time_${timePref}`)
      : humanizeTimePref(timePref);
  return `${training.trim()} • ${levelText} • ${timeText}`;
}

/** Offline deck when the preview API is unreachable (mirrors server padding shape). */
function buildOfflinePreviewDeck(training: string, level: string, timePref: string): LandingMatchPreviewResult {
  const sport = training.trim() || 'Gym';
  const levelTitle = level ? level.charAt(0).toUpperCase() + level.slice(1).toLowerCase() : 'Intermediate';
  const timeDisplay = humanizeTimePref(timePref);
  const row = (
    name: string,
    photoKey: keyof typeof DUMMY_USER_PRIMARY_PHOTO,
    trainingSummary: string,
    goalLine: string,
    age: number
  ): LandingMatchPreviewUser => ({
    name,
    age,
    trainingSummary,
    goalLine,
    photoUrl: DUMMY_USER_PRIMARY_PHOTO[photoKey],
    levelLabel: levelTitle,
    timePrefLabel: timeDisplay,
  });

  const users: LandingMatchPreviewUser[] = [
    row('Alex Drogba', 'dummy-user-7', `${sport} · Soccer · Conditioning`, 'Stay match-fit year round', 29),
    row('Sarah Runner', 'dummy-user-1', 'Running · Yoga · Hiking', 'Complete a sub-4 hour marathon', 28),
    row('Maria Chen', 'dummy-user-2', `${sport} · Strength · Mobility`, 'Build consistent gym habits', 27),
    row('Jordan Blake', 'dummy-user-5', `${sport} · HIIT · Core`, 'Improve work capacity for events', 26),
    row('Ken Okada', 'dummy-user-6', 'Swimming · Core · Recovery', 'Open-water confidence', 31),
  ];

  return { kind: 'demo', matchCount: users.length, exampleLabel: '', users };
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

  const goToPaywall = useCallback(
    (surface: 'overlay' | 'match_card' | 'sticky') => {
      analytics.landingEntryUnlockClick(surface);
      saveLandingPrefs({ training, level, timePref });
      setStep(3);
    },
    [training, level, timePref]
  );

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
      next = buildOfflinePreviewDeck(training, level, timePref);
    }

    setPreview(next);
    setPreviewLoadFailed(loadFailed);
    setIsAnalyzing(false);
    setAnalyzeMsgIndex(0);
    setStep(2);
    analytics.landingEntrySetupComplete({ kind: next.kind });
  };

  const primaryPreviewUser = preview?.users?.[0];
  const previewUsers = preview?.users ?? [];
  const unlockedCardCount = Math.min(2, Math.max(1, previewUsers.length));
  const unlockedUsers = previewUsers.slice(0, unlockedCardCount);
  const lockedUsers = previewUsers.slice(unlockedCardCount);
  const prefLine = guestPreferenceLine(training, level, timePref, t);

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

            <div className={styles.panelFlex}>
              <div className={styles.panelBody}>
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
                  <div className={`${styles.step} ${styles.stepCompact}`}>
                    <h2 id="entry-flow-title" className={styles.title}>
                      {t('landing.entry_quick_setup')}
                    </h2>
                    <p className={styles.lead}>{t('landing.entry_lead')}</p>

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
                      className={`${styles.primaryBtn} ${styles.primaryBtnPulse} ${styles.primaryBtnEntry}`}
                      disabled={!step1Valid}
                      onClick={() => {
                        analytics.landingEntryCtaClick();
                        void runAnalyze();
                      }}
                    >
                      {t('landing.landing_primary_cta')}
                    </button>
                    <p className={styles.ctaMicro}>{t('landing.landing_cta_sub')}</p>
                  </div>
                )}

                {step === 2 && preview && previewUsers.length > 0 && (
                  <div className={`${styles.step} ${styles.stepPreview}`}>
                    <header className={styles.previewHeader}>
                      <h2 id="entry-flow-title" className={styles.previewTitle}>
                        {t('landing.entry_preview_title')}
                      </h2>
                      <p className={styles.previewSub}>{t('landing.entry_preview_sub')}</p>
                      <p className={styles.previewMicro}>{t('landing.entry_preview_micro')}</p>
                      {previewLoadFailed && <p className={styles.previewHint}>{t('landing.entry_load_warning')}</p>}
                    </header>

                    <div className={styles.previewCards}>
                      {unlockedUsers.map((u) => (
                        <button
                          key={u.name}
                          type="button"
                          className={`${styles.previewCard} ${styles.previewCardUnlocked}`}
                          onClick={() => goToPaywall('match_card')}
                        >
                          {u.photoUrl ? (
                            <img src={u.photoUrl} alt="" className={styles.previewAvatar} width={52} height={52} />
                          ) : (
                            <div className={styles.previewAvatarPh} aria-hidden />
                          )}
                          <div className={styles.previewCardBody}>
                            <span className={styles.previewName}>{formatCardName(u)}</span>
                            <span className={styles.previewTraining}>{u.trainingSummary}</span>
                            <span className={styles.previewPrefLine}>{prefLine}</span>
                          </div>
                        </button>
                      ))}

                      {lockedUsers.length > 0 && (
                        <>
                          <div className={styles.lockedStack}>
                            <div className={styles.lockedStackBlur} aria-hidden>
                              {lockedUsers.map((u) => (
                                <div key={u.name} className={styles.previewCardGhost}>
                                  {u.photoUrl ? (
                                    <img src={u.photoUrl} alt="" className={styles.previewAvatar} width={52} height={52} />
                                  ) : (
                                    <div className={styles.previewAvatarPh} aria-hidden />
                                  )}
                                  <div className={styles.previewCardBody}>
                                    <span className={styles.previewName}>{formatCardName(u)}</span>
                                    <span className={styles.previewTraining}>{u.trainingSummary}</span>
                                    <span className={styles.previewPrefLineMuted}>{prefLine}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className={styles.lockedVeil} aria-hidden />
                          </div>

                          <div className={styles.unlockInline}>
                            <p className={styles.unlockInlineTitle}>{t('landing.entry_unlock_overlay_title')}</p>
                            <p className={styles.unlockInlineSub}>{t('landing.entry_unlock_overlay_sub')}</p>
                          </div>
                        </>
                      )}
                    </div>
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
              </div>

              {step === 2 && preview && previewUsers.length > 0 && (
                <div className={styles.previewStickyBar}>
                  <button
                    type="button"
                    className={`${styles.primaryBtn} ${styles.primaryBtnPulse} ${styles.stickyContinueBtn}`}
                    onClick={() => goToPaywall('sticky')}
                  >
                    {t('landing.entry_continue')}
                  </button>
                  <p className={styles.previewStickyMicro}>{t('landing.entry_preview_sticky_micro')}</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
