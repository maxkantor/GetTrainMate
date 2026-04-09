import React, { useEffect, useState } from 'react';
import styles from './HeroFloatingStack.module.css';
import { fetchLandingShowcase } from '@/services/landingShowcaseService';

type StackItem = { text: string; avatar: string };

const FALLBACK: StackItem[] = [
  {
    text: 'Sofia matched with Marcus',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop&crop=faces',
  },
  {
    text: 'Alex found a 5AM partner',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=faces',
  },
  {
    text: 'New matches every day',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop&crop=faces',
  },
];

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
