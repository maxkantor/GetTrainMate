import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LANDING_MATCH_PREVIEW_USD_FALLBACK } from '@/constants/landingPremium';
import { LANDING_SHOWCASE_STACK_FALLBACK } from '@/data/landingShowcaseFallback';
import { fetchLandingShowcase } from '@/services/landingShowcaseService';
import { NO_PHOTO_PLACEHOLDER } from '@/utils/profilePhotos';
import styles from './HeroFloatingStack.module.css';

type StackItem = { text: string; avatar: string; secondaryAvatar?: string };

const FALLBACK: StackItem[] = LANDING_SHOWCASE_STACK_FALLBACK.map((row) => ({
  text: row.text,
  avatar: row.avatar,
  secondaryAvatar: row.secondaryAvatar,
}));

const ROTATE_MS = 4000;

export const HeroFloatingStack: React.FC = () => {
  const [stack, setStack] = useState<StackItem[]>(FALLBACK);
  const [focusIdx, setFocusIdx] = useState(0);
  const [premiumUsd, setPremiumUsd] = useState(LANDING_MATCH_PREVIEW_USD_FALLBACK);

  useEffect(() => {
    let cancelled = false;
    fetchLandingShowcase().then((data) => {
      if (cancelled || !data || data.kind !== 'live' || !data.activity?.length) return;
      const usd =
        typeof data.premiumMatchPreviewUsd === 'number' && data.premiumMatchPreviewUsd > 0
          ? data.premiumMatchPreviewUsd
          : LANDING_MATCH_PREVIEW_USD_FALLBACK;
      setPremiumUsd(usd);
      const next: StackItem[] = data.activity.slice(0, 3).map((row, i) => {
        const fb = FALLBACK[i % FALLBACK.length];
        const primary = (row.avatarUrl || '').trim() || fb.avatar;
        const secondary = (row.secondaryAvatarUrl || '').trim() || fb.secondaryAvatar;
        return {
          text: row.line,
          avatar: primary,
          secondaryAvatar: secondary,
        };
      });
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

  const priceLabel = Number.isInteger(premiumUsd) ? `$${premiumUsd}` : `$${premiumUsd.toFixed(2)}`;

  const onAvatarError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    if (el.dataset.fallback === '1') return;
    el.dataset.fallback = '1';
    el.src = NO_PHOTO_PLACEHOLDER;
  }, []);

  return (
    <div className={styles.column}>
      <div className={styles.premiumHeader}>
        <span className={styles.livePill}>
          <span className={styles.liveDot} />
          Live activity
        </span>
        <Link to="/pricing" className={styles.premiumPill}>
          Matching preview · {priceLabel}
        </Link>
      </div>
      <p className={styles.crmHint}>Photos load from CRM test-user profiles (S3) — not stock overlays.</p>
      <div className={styles.wrap} aria-hidden>
        {stack.map((item, i) => (
          <div
            key={`${item.text}-${i}`}
            className={`${styles.cardOuter} ${styles[`layer${i}`]} ${focusIdx === i ? styles.cardOuterFocus : ''}`}
          >
            <div className={`${styles.cardInner} ${focusIdx === i ? styles.cardInnerFocus : ''}`}>
              <div className={styles.avatarCluster}>
                {item.secondaryAvatar ? (
                  <>
                    <img
                      src={item.avatar}
                      alt=""
                      className={`${styles.avatar} ${styles.avatarLead}`}
                      width={50}
                      height={50}
                      loading="eager"
                      decoding="async"
                      onError={onAvatarError}
                    />
                    <img
                      src={item.secondaryAvatar}
                      alt=""
                      className={`${styles.avatar} ${styles.avatarFollow}`}
                      width={50}
                      height={50}
                      loading="eager"
                      decoding="async"
                      onError={onAvatarError}
                    />
                  </>
                ) : (
                  <img
                    src={item.avatar}
                    alt=""
                    className={styles.avatar}
                    width={50}
                    height={50}
                    loading="eager"
                    decoding="async"
                    onError={onAvatarError}
                  />
                )}
              </div>
              <p className={styles.text}>{item.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
