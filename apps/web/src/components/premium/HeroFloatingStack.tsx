import React from 'react';
import styles from './HeroFloatingStack.module.css';

const STACK = [
  {
    text: 'Sofia matched with Marcus',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop&crop=faces',
  },
  {
    text: 'Alex found a 5AM partner',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=faces',
  },
  {
    text: '3 matches near Atlanta',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop&crop=faces',
  },
] as const;

export const HeroFloatingStack: React.FC = () => {
  return (
    <div className={styles.wrap} aria-hidden>
      {STACK.map((item, i) => (
        <div key={item.text} className={`${styles.card} ${styles[`layer${i}`]}`}>
          <img
            src={item.avatar}
            alt=""
            className={styles.avatar}
            width={44}
            height={44}
            loading="eager"
            decoding="async"
          />
          <p className={styles.text}>{item.text}</p>
        </div>
      ))}
    </div>
  );
};
