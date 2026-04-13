import React, { useCallback, useEffect, useState } from 'react';
import { LANDING_SHOWCASE_STACK_FALLBACK } from '@/data/landingShowcaseFallback';
import { fetchLandingShowcase, isLandingShowcaseLive } from '@/services/landingShowcaseService';
import { landingShowcaseImageProps, pickLandingShowcasePhotoUrl } from '@/utils/landingShowcaseImages';
import { logLandingShowcase, redactUrlForLog } from '@/utils/landingShowcaseDebug';
import { NO_PHOTO_PLACEHOLDER } from '@/utils/profilePhotos';
import { useI18n } from '@/hooks/useI18n';
import styles from './HeroFloatingStack.module.css';

type StackItem = { text: string; avatar: string; secondaryAvatar?: string };

const FALLBACK: StackItem[] = LANDING_SHOWCASE_STACK_FALLBACK.map((row) => ({
  text: row.text,
  avatar: row.avatar,
  secondaryAvatar: row.secondaryAvatar,
}));

const ROTATE_MS = 4000;

export const HeroFloatingStack: React.FC = () => {
  const { t } = useI18n();
  const [stack, setStack] = useState<StackItem[]>(FALLBACK);
  const [focusIdx, setFocusIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchLandingShowcase().then((data) => {
      if (cancelled || !data) return;
      if (!isLandingShowcaseLive(data) || !data.activity?.length) {
        logLandingShowcase('HeroFloatingStack: keeping fallback', {
          kind: data?.kind,
          activityLen: data?.activity?.length ?? 0,
        });
        return;
      }
      const next: StackItem[] = data.activity.slice(0, 3).map((row, i) => {
        const fb = FALLBACK[i % FALLBACK.length];
        const primaryPick = pickLandingShowcasePhotoUrl(row.avatarUrl);
        const primary = primaryPick !== NO_PHOTO_PLACEHOLDER ? primaryPick : fb.avatar;
        const secPick = (row.secondaryAvatarUrl || '').trim()
          ? pickLandingShowcasePhotoUrl(row.secondaryAvatarUrl)
          : '';
        const secondary =
          secPick && secPick !== NO_PHOTO_PLACEHOLDER ? secPick : undefined;
        return {
          text: row.line,
          avatar: primary,
          secondaryAvatar: secondary,
        };
      });
      if (next.length === 3) {
        logLandingShowcase('HeroFloatingStack: applied live stack', {
          lines: next.map((n) => n.text),
          avatars: next.map((n) => redactUrlForLog(n.avatar)),
        });
        setStack(next);
      } else {
        logLandingShowcase('HeroFloatingStack: expected 3 activity rows', { got: next.length });
      }
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

  const onAvatarError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    if (el.dataset.fallback === '1') return;
    logLandingShowcase('HeroFloatingStack: img onError → placeholder', {
      src: redactUrlForLog(el.currentSrc || el.src),
    });
    el.dataset.fallback = '1';
    el.src = NO_PHOTO_PLACEHOLDER;
  }, []);

  return (
    <div className={styles.column}>
      <div className={styles.activityHeader}>
        <span className={styles.activityLabel}>{t('landing.showcase_activity_label')}</span>
      </div>
      <div className={styles.wrap}>
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
                      {...landingShowcaseImageProps(item.avatar)}
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
                      {...landingShowcaseImageProps(item.secondaryAvatar)}
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
                    {...landingShowcaseImageProps(item.avatar)}
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
