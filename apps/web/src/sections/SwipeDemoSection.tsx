import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
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
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=faces',
    tags: ['HYROX', 'Strength', '5AM'],
    distance: '2.1 mi',
    matchPct: 94,
  },
  {
    name: 'Riley',
    age: 26,
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=faces',
    tags: ['HYROX', 'Strength', '5AM'],
    distance: '0.8 mi',
    matchPct: 91,
  },
  {
    name: 'Morgan',
    age: 31,
    avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop&crop=faces',
    tags: ['HYROX', 'Strength', '5AM'],
    distance: '4 mi',
    matchPct: 88,
  },
] as const;

const IDLE_MS = 3000;
const SWIPE_MS = 520;
const MATCH_MS = 2000;

function DemoMatchRing({ percent }: { percent: number }) {
  const uid = useId().replace(/:/g, '');
  const gradId = `dmr-${uid}`;
  const r = 15.5;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  const offset = c - (p / 100) * c;
  return (
    <svg className={styles.matchSvg} viewBox="0 0 36 36" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="2.5"
      />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 18 18)"
      />
      <text x="18" y="21" textAnchor="middle" className={styles.matchNumSvg}>
        {p}%
      </text>
    </svg>
  );
}

export const SwipeDemoSection: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const { isAuthenticated } = useAuthContext();
  const { openEntryFlow } = useLandingConversion();
  const [phase, setPhase] = useState<Phase>('idle');
  const [profileIdx, setProfileIdx] = useState(0);
  const timersRef = useRef<number[]>([]);

  const p = PROFILES[profileIdx % PROFILES.length];

  const onTiltMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (reduceMotion) return;
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
      el.style.setProperty('--rx', `${ny * -8}deg`);
      el.style.setProperty('--ry', `${nx * 8}deg`);
    },
    [reduceMotion]
  );

  const onTiltLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.setProperty('--rx', '0deg');
    e.currentTarget.style.setProperty('--ry', '0deg');
  }, []);

  useEffect(() => {
    const clearAll = () => {
      timersRef.current.forEach((id) => clearTimeout(id));
      timersRef.current = [];
    };

    const schedule = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        fn();
      }, ms) as unknown as number;
      timersRef.current.push(id);
    };

    const runCycle = () => {
      clearAll();
      schedule(() => {
        if (reduceMotion) {
          setPhase('match');
          schedule(() => {
            setProfileIdx((i) => (i + 1) % PROFILES.length);
            setPhase('idle');
            runCycle();
          }, MATCH_MS);
          return;
        }

        setPhase('swipe');
        schedule(() => {
          setPhase('match');
          schedule(() => {
            setProfileIdx((i) => (i + 1) % PROFILES.length);
            setPhase('idle');
            runCycle();
          }, MATCH_MS);
        }, SWIPE_MS);
      }, IDLE_MS);
    };

    runCycle();
    return () => {
      clearAll();
    };
  }, [reduceMotion]);

  const showProfile = phase === 'idle' || phase === 'swipe';
  const showMatch = phase === 'match';

  return (
    <section
      className={styles.section}
      id="how-it-works"
      aria-labelledby="swipe-demo-heading"
    >
      <div className={styles.bgGlow} aria-hidden />
      <Container size="wide">
        <h2 id="swipe-demo-heading" className={styles.title}>
          See How Matching Works
        </h2>

        <div className={styles.stage}>
          <div className={styles.tiltWrap} onMouseMove={onTiltMove} onMouseLeave={onTiltLeave}>
            <motion.div
              className={`${styles.card} ${showMatch ? styles.cardMatch : ''}`}
              animate={
                reduceMotion
                  ? { x: 0, rotate: 0, scale: 1 }
                  : phase === 'swipe'
                    ? { x: 280, rotate: 10, scale: 1 }
                    : showMatch
                      ? { x: 0, rotate: 0, scale: [1, 1.08, 0.94, 1.06, 1] }
                      : { x: 0, rotate: 0, scale: 1 }
              }
              transition={
                phase === 'swipe'
                  ? { type: 'tween', duration: 0.48, ease: [0.32, 0.72, 0, 1] }
                  : showMatch
                    ? { duration: 0.62, times: [0, 0.15, 0.35, 0.55, 1] }
                    : { type: 'spring', stiffness: 420, damping: 32 }
              }
            >
              {showProfile && (
                <>
                  <div className={styles.avatarWrap}>
                    <img src={p.avatar} alt="" className={styles.avatar} width={120} height={120} loading="lazy" />
                  </div>
                  <div className={styles.row}>
                    <span className={styles.name}>
                      {p.name}, {p.age}
                    </span>
                    <span className={styles.matchRing} aria-hidden>
                      <DemoMatchRing percent={p.matchPct} />
                    </span>
                  </div>
                  <div className={styles.tags}>
                    {p.tags.map((t) => (
                      <span key={t} className={styles.tag}>
                        [{t}]
                      </span>
                    ))}
                  </div>
                  <p className={styles.distance}>{p.distance} away</p>
                </>
              )}

              {showMatch && (
                <div className={`${styles.matchOverlay} ${styles.matchOverlayPulse}`} role="status" aria-live="polite">
                  <span className={styles.matchEmoji} aria-hidden>
                    🔥
                  </span>
                  <span className={styles.matchText}>It&apos;s a Match</span>
                </div>
              )}
            </motion.div>
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
