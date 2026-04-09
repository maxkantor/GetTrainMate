import React, { useEffect, useState } from 'react';
import styles from './HeroFloatingStack.module.css';
import { LANDING_SHOWCASE_STACK_FALLBACK } from '@/data/landingShowcaseFallback';
import { fetchLandingShowcase } from '@/services/landingShowcaseService';

type StackItem = { text: string; avatar: string };

const FALLBACK: StackItem[] = LANDING_SHOWCASE_STACK_FALLBACK;

const ROTATE_MS = 4000;

export const HeroFloatingStack: React.FC = () => {
  const [stack, setStack] = useState<StackItem[]>(FALLBACK);
  const [focusIdx, setFocusIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchLandingShowcase().then((data) => {
      if (cancelled || !data || data.kind !== 'live' || !data.activity?.length) return;
      const next: StackItem[] = data.activity.slice(0, 3).map((row, i) => ({
        text: row.line,
        avatar: (row.avatarUrl || '').trim() || FALLBACK[i % FALLBACK.length].avatar,
      }));
      if (next.length === 3) setStack(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setFocusIdx((i) => (i + 1) % stack.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [stack.length]);

  return (
    <div className={styles.wrap} aria-hidden>
      {stack.map((item, i) => (
        <div
          key={`${item.text}-${i}`}
          className={`${styles.cardOuter} ${styles[`layer${i}`]} ${focusIdx === i ? styles.cardOuterFocus : ''}`}
        >
          <div className={`${styles.cardInner} ${focusIdx === i ? styles.cardInnerFocus : ''}`}>
            <img
              src={item.avatar}
              alt=""
              className={styles.avatar}
              width={50}
              height={50}
              loading="eager"
              decoding="async"
            />
            <p className={styles.text}>{item.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
