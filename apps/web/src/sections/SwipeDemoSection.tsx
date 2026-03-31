import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useLandingConversion } from '@/contexts/LandingConversionContext';
import { Container } from '@/components/layout/Container';
import { LANDING_CTA_SUB, LANDING_SCARCITY } from '@/constants/landingCopy';
import styles from './SwipeDemoSection.module.css';

type Phase = 'idle' | 'swipe' | 'match';

const PROFILES = [
  {
    name: 'Jordan',
    age: 28,
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=640&h=800&fit=crop&crop=faces',
    tags: ['HYROX', 'Strength', '5AM'],
    matchPct: 94,
  },
  {
    name: 'Riley',
    age: 26,
    photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=640&h=800&fit=crop&crop=faces',
    tags: ['HYROX', 'Strength', '5AM'],
    matchPct: 91,
  },
  {
    name: 'Morgan',
    age: 31,
    photo: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=640&h=800&fit=crop&crop=faces',
    tags: ['HYROX', 'Strength', '5AM'],
    matchPct: 88,
  },
  {
    name: 'Casey',
    age: 29,
    photo: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=640&h=800&fit=crop&crop=faces',
    tags: ['HYROX', 'Strength', '5AM'],
    matchPct: 92,
  },
  {
    name: 'Sam',
    age: 27,
    photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=640&h=800&fit=crop&crop=faces',
    tags: ['HYROX', 'Strength', '5AM'],
    matchPct: 89,
  },
] as const;

const IDLE_MS = 3000;
const SWIPE_MS = 580;
const MATCH_MS = 1650;

function MatchBadge({ percent }: { percent: number }) {
  const uid = useId().replace(/:/g, '');
  const gradId = `mdb-${uid}`;
  const r = 18;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  const offset = c - (p / 100) * c;
  return (
    <div className={styles.matchBadge}>
      <svg className={styles.matchSvg} viewBox="0 0 44 44" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 22 22)"
        />
        <text x="22" y="26" textAnchor="middle" className={styles.matchNumSvg}>
          {p}%
        </text>
      </svg>
    </div>
  );
}

type FaceProps = {
  profile: (typeof PROFILES)[number];
  depth: 0 | 1 | 2;
};

function DeckFace({ profile, depth }: FaceProps) {
  if (depth === 0) {
    return (
      <div className={styles.faceTop}>
        <div className={styles.photoShell}>
          <div className={styles.photoParallax} data-parallax="1">
            <img src={profile.photo} alt="" className={styles.photo} width={400} height={500} loading="lazy" />
          </div>
          <div className={styles.photoScrim} aria-hidden />
        </div>
        <div className={styles.faceMeta}>
          <div className={styles.nameRow}>
            <span className={styles.name}>
              {profile.name}, {profile.age}
            </span>
            <MatchBadge percent={profile.matchPct} />
          </div>
          <div className={styles.tags}>
            {profile.tags.map((t) => (
              <span key={t} className={styles.tag}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }
  const layer = depth === 1 ? styles.faceMid : styles.faceBack;
  return (
    <div className={`${styles.face} ${layer}`}>
      <div className={styles.photoShell}>
        <div className={styles.photoParallax}>
          <img src={profile.photo} alt="" className={styles.photo} width={400} height={500} loading="lazy" />
        </div>
        <div className={styles.photoScrim} aria-hidden />
      </div>
      <div className={styles.faceMeta}>
        <div className={styles.nameRow}>
          <span className={styles.name}>
            {profile.name}, {profile.age}
          </span>
          <MatchBadge percent={profile.matchPct} />
        </div>
        <div className={styles.tags}>
          {profile.tags.map((t) => (
            <span key={t} className={styles.tag}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export const SwipeDemoSection: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const { isAuthenticated } = useAuthContext();
  const { openEntryFlow } = useLandingConversion();
  const [phase, setPhase] = useState<Phase>('idle');
  const [deckIndex, setDeckIndex] = useState(0);
  const timersRef = useRef<number[]>([]);
  const deckRef = useRef<HTMLDivElement>(null);
  const photoShellRef = useRef<HTMLDivElement>(null);

  const len = PROFILES.length;
  const iFront = deckIndex % len;
  const iMid = (deckIndex + 1) % len;
  const iBack = (deckIndex + 2) % len;

  const onDeckParallax = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (reduceMotion) return;
      const el = deckRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--px', String(px * 2));
      el.style.setProperty('--py', String(py * 2));
    },
    [reduceMotion]
  );

  const onDeckParallaxLeave = useCallback(() => {
    const el = deckRef.current;
    if (!el) return;
    el.style.setProperty('--px', '0');
    el.style.setProperty('--py', '0');
  }, []);

  const onPhotoParallax = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (reduceMotion) return;
      const shell = photoShellRef.current;
      if (!shell) return;
      const r = shell.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      const inner = shell.querySelector('[data-parallax="1"]') as HTMLElement | null;
      if (inner) {
        inner.style.transform = `translate(${px * 18}px, ${py * 12}px) scale(1.08)`;
      }
    },
    [reduceMotion]
  );

  const onPhotoParallaxLeave = useCallback(() => {
    const shell = photoShellRef.current;
    if (!shell) return;
    const inner = shell.querySelector('[data-parallax="1"]') as HTMLElement | null;
    if (inner) inner.style.transform = 'translate(0,0) scale(1.02)';
  }, []);

  useEffect(() => {
    const clearAll = () => {
      timersRef.current.forEach((id) => clearTimeout(id));
      timersRef.current = [];
    };

    const schedule = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms) as unknown as number;
      timersRef.current.push(id);
    };

    const runCycle = () => {
      clearAll();
      schedule(() => {
        if (reduceMotion) {
          setPhase('match');
          schedule(() => {
            setDeckIndex((d) => (d + 1) % len);
            setPhase('idle');
            runCycle();
          }, MATCH_MS);
          return;
        }

        setPhase('swipe');
        schedule(() => {
          setPhase('match');
          schedule(() => {
            setDeckIndex((d) => (d + 1) % len);
            setPhase('idle');
            runCycle();
          }, MATCH_MS);
        }, SWIPE_MS);
      }, IDLE_MS);
    };

    runCycle();
    return clearAll;
  }, [reduceMotion, len]);

  const showMatch = phase === 'match';

  return (
    <section className={styles.section} id="how-it-works" aria-labelledby="swipe-demo-heading">
      <Container size="wide">
        <h2 id="swipe-demo-heading" className={styles.title}>
          See How Matching Works
        </h2>
        <p className={styles.subtitle}>Swipe right → match. Watch the loop.</p>

        <div
          className={styles.deckZone}
          ref={deckRef}
          onMouseMove={onDeckParallax}
          onMouseLeave={onDeckParallaxLeave}
        >
          <div className={styles.deckParallax}>
            <div className={styles.deckFloat}>
            <div className={styles.stackBehind}>
              <DeckFace profile={PROFILES[iBack]} depth={2} />
              <DeckFace profile={PROFILES[iMid]} depth={1} />
            </div>

            <motion.div
              key={deckIndex}
              className={styles.swipeLayer}
              initial={false}
              animate={
                reduceMotion
                  ? { x: 0, rotate: 0, opacity: 1 }
                  : phase === 'swipe'
                    ? {
                        x: [0, 32, 440],
                        rotate: [0, 7, 15],
                        opacity: [1, 1, 0],
                      }
                    : phase === 'match'
                      ? { x: 440, rotate: 15, opacity: 0 }
                      : { x: 0, rotate: 0, opacity: 1 }
              }
              transition={
                phase === 'swipe'
                  ? {
                      duration: SWIPE_MS / 1000,
                      times: [0, 0.2, 1],
                      ease: 'easeInOut',
                    }
                  : { type: 'spring', stiffness: 440, damping: 36 }
              }
            >
              <motion.div
                className={styles.topCard}
                initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                whileHover={reduceMotion ? undefined : { y: -8, transition: { duration: 0.22 } }}
              >
                <div
                  ref={photoShellRef}
                  className={styles.topCardInner}
                  onMouseMove={onPhotoParallax}
                  onMouseLeave={onPhotoParallaxLeave}
                >
                  <DeckFace profile={PROFILES[iFront]} depth={0} />
                </div>
              </motion.div>
            </motion.div>

            <AnimatePresence>
              {showMatch && (
                <motion.div
                  key="match"
                  className={styles.matchLayer}
                  role="status"
                  aria-live="polite"
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                >
                  <div className={styles.matchBurst}>
                    <span className={styles.matchEmoji} aria-hidden>
                      🔥
                    </span>
                    <span className={styles.matchTitle}>It&apos;s a Match</span>
                    <span className={styles.matchHint}>Next card slides up — same in the app</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            </div>
          </div>
        </div>

        <div className={styles.ctaColumn}>
          {!isAuthenticated ? (
            <button type="button" className={styles.cta} onClick={openEntryFlow}>
              Start Matching Free
            </button>
          ) : (
            <Link to="/app/discover" className={styles.cta}>
              Start Matching Free
            </Link>
          )}
          <p className={styles.ctaSub}>{LANDING_CTA_SUB}</p>
          <p className={styles.scarcityLine}>{LANDING_SCARCITY}</p>
        </div>
      </Container>
    </section>
  );
};
