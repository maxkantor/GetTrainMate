import React, { useState } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { Container } from '@/components/layout/Container';
import { useI18n } from '@/hooks/useI18n';
import { LANDING_SHOWCASE_DECK_FALLBACK } from '@/data/landingShowcaseFallback';
import { landingShowcaseImageProps } from '@/utils/landingShowcaseImages';
import { NO_PHOTO_PLACEHOLDER } from '@/utils/profilePhotos';
import styles from './ProductJourneySection.module.css';

type StepId = 'discover' | 'match' | 'chat' | 'meet';

const demo = LANDING_SHOWCASE_DECK_FALLBACK[0];

const STEPS: { id: StepId; labelKey: string; blurbKey: string }[] = [
  { id: 'discover', labelKey: 'landing.swipe_flow_discover', blurbKey: 'landing.product_step_discover' },
  { id: 'match', labelKey: 'landing.swipe_flow_match', blurbKey: 'landing.product_step_match' },
  { id: 'chat', labelKey: 'landing.swipe_flow_chat', blurbKey: 'landing.product_step_chat' },
  { id: 'meet', labelKey: 'landing.swipe_flow_meet', blurbKey: 'landing.product_step_meet' },
];

/**
 * Immersive How It Works — one large product stage, user-selected steps.
 * No auto-rotation. No four equal SaaS cards.
 */
export const ProductJourneySection: React.FC = () => {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState<StepId>('discover');
  const imgExtras = landingShowcaseImageProps(demo.photo);

  return (
    <section id="how-it-works" className={`${styles.section} premium-section-bg`}>
      <Container size="wide">
        <div className={styles.top}>
          <div className={styles.copy}>
            <p className={styles.kicker}>{t('landing.swipe_flow_aria')}</p>
            <h2 className={styles.title}>{t('landing.swipe_demo_title')}</h2>
            <p className={styles.sub}>{t('landing.swipe_demo_subtitle')}</p>
          </div>

          <div className={styles.rail} role="tablist" aria-label={t('landing.swipe_flow_aria')}>
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={step === s.id}
                className={`${styles.railBtn} ${step === s.id ? styles.railBtnActive : ''}`}
                onClick={() => setStep(s.id)}
              >
                <span className={styles.railIndex}>{String(i + 1).padStart(2, '0')}</span>
                <span className={styles.railLabel}>{t(s.labelKey)}</span>
                <span className={styles.railBlurb}>{t(s.blurbKey)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.stageWrap}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              className={styles.stage}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.28 }}
            >
              {step === 'discover' ? (
                <div className={styles.discoverStage}>
                  <div className={styles.phone}>
                    <div className={styles.phoneChrome} aria-hidden>
                      <span />
                    </div>
                    <div className={styles.discoverMedia}>
                      <img
                        src={demo.photo}
                        alt=""
                        width={420}
                        height={560}
                        loading="lazy"
                        className={styles.discoverImg}
                        {...imgExtras}
                        onError={(e) => {
                          e.currentTarget.src = NO_PHOTO_PLACEHOLDER;
                        }}
                      />
                      <div className={styles.discoverOverlay}>
                        <p className={styles.discoverName}>
                          {demo.name}
                          {demo.age ? `, ${demo.age}` : ''}
                        </p>
                        <div className={styles.discoverTags}>
                          {demo.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className={styles.tag}>
                              {tag}
                            </span>
                          ))}
                        </div>
                        <span className={styles.modeChip}>TRAIN</span>
                      </div>
                    </div>
                    <div className={styles.actionBar} aria-hidden>
                      <span className={styles.btnPass}>Pass</span>
                      <span className={styles.btnView}>View</span>
                      <span className={styles.btnPrimary}>Train</span>
                    </div>
                  </div>
                  <p className={styles.stageCaption}>{t('landing.product_step_discover_cap')}</p>
                </div>
              ) : null}

              {step === 'match' ? (
                <div className={styles.matchStage}>
                  <div className={styles.matchHero}>
                    <span className={styles.matchPct}>{demo.matchPct}%</span>
                    <h3 className={styles.matchTitle}>{t('landing.swipe_match_title')}</h3>
                    <p className={styles.matchHint}>{t('landing.product_match_hint')}</p>
                  </div>
                  <ul className={styles.matchReasons}>
                    <li>{t('landing.ai_match_reason_1')}</li>
                    <li>{t('landing.ai_match_reason_2')}</li>
                    <li>{t('landing.ai_match_reason_3')}</li>
                  </ul>
                  <span className={styles.matchCta}>Send message</span>
                </div>
              ) : null}

              {step === 'chat' ? (
                <div className={styles.chatStage}>
                  <div className={styles.chatHeader}>{demo.name}</div>
                  <div className={styles.bubbles}>
                    <p className={styles.bubbleReceived}>{t('landing.product_chat_1')}</p>
                    <p className={styles.bubbleSent}>{t('landing.product_chat_2')}</p>
                    <p className={styles.bubbleReceived}>{t('landing.product_chat_3')}</p>
                  </div>
                  <p className={styles.stageCaption}>{t('landing.product_step_chat_cap')}</p>
                </div>
              ) : null}

              {step === 'meet' ? (
                <div className={styles.meetStage}>
                  <span className={styles.eventKicker}>{t('landing.product_meet_kicker')}</span>
                  <h3 className={styles.eventTitle}>{t('landing.product_meet_title')}</h3>
                  <p className={styles.eventBody}>{t('landing.product_meet_body')}</p>
                  <div className={styles.meetVisual} aria-hidden>
                    <div className={styles.meetTile}>
                      <strong>TRAIN</strong>
                      <span>Morning run</span>
                    </div>
                    <div className={styles.meetTile}>
                      <strong>VIBE</strong>
                      <span>After workout</span>
                    </div>
                    <div className={styles.meetTile}>
                      <strong>MEET</strong>
                      <span>Real plans</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        <p className={styles.trust}>{t('landing.swipe_demo_trust')}</p>
      </Container>
    </section>
  );
};
