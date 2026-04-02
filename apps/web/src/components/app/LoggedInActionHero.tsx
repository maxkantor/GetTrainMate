import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button } from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { useMe } from '@/hooks/useMe';
import { useMatchStatusForHeader } from '@/hooks/useMatchStatusForHeader';
import { DAILY_LIKE_LIMIT } from '@/config/appLimits';
import { Modal } from '@/components/ui/Modal';
import styles from './LoggedInActionHero.module.css';

/**
 * Replaces marketing hero on `/` when the user is logged in.
 * Pre-login landing is unchanged.
 */
export const LoggedInActionHero: React.FC = () => {
  const { t } = useI18n();
  const { me } = useMe();
  const { likesToday } = useMatchStatusForHeader(true);
  const complete = me?.isProfileComplete ?? false;
  const credits = me?.credits ?? 0;
  const [limitModalOpen, setLimitModalOpen] = useState(false);

  const primaryHref = complete ? '/app' : '/onboarding/profile';
  const primaryLabel = complete ? t('header.home') : t('landing.cta_finish_profile');
  const usedToday = Math.min(likesToday, DAILY_LIKE_LIMIT);
  const atOrPastFreeCap = likesToday >= DAILY_LIKE_LIMIT;
  const hardLimitReached = atOrPastFreeCap && credits < 1;
  const hasCredits = credits > 0;
  const progressPercent = (usedToday / DAILY_LIKE_LIMIT) * 100;

  const resetCountdownLabel = useMemo(() => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const diffMs = Math.max(0, nextMidnight.getTime() - now.getTime());
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) return `${minutes}m`;
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  }, [likesToday]);

  useEffect(() => {
    if (!hardLimitReached) return;
    const dayKey = new Date().toISOString().slice(0, 10);
    const shownKey = `gtm_daily_limit_modal_${dayKey}`;
    if (sessionStorage.getItem(shownKey)) return;
    sessionStorage.setItem(shownKey, '1');
    setLimitModalOpen(true);
  }, [hardLimitReached]);

  return (
    <section className={styles.wrap} aria-label="Your activity">
      <div className={styles.inner}>
        <p className={styles.kicker}>You’re in</p>
        <h1 className={styles.title}>Today's Matches</h1>
        {hasCredits ? (
          <p className={styles.usage}>Unlimited discovery — your balance is active ({credits} credits)</p>
        ) : (
          <>
            <p className={styles.usage}>
              {Math.min(likesToday, DAILY_LIKE_LIMIT)} / {DAILY_LIKE_LIMIT} free matches used
              {likesToday > DAILY_LIKE_LIMIT ? ` (${likesToday} today)` : ''}
            </p>
            <div className={styles.progressWrap} aria-hidden>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
              </div>
              <span className={styles.progressText}>
                {usedToday}/{DAILY_LIKE_LIMIT}
              </span>
            </div>
          </>
        )}
        <p className={styles.sub}>
          {hasCredits
            ? 'Credits remove the daily match cap so you can keep connecting without limits.'
            : `You get ${DAILY_LIKE_LIMIT} free matches per day (UTC). Add credits for unlimited discovery.`}
          <br />
          {!hasCredits ? <>Daily free matches reset in {resetCountdownLabel}.</> : null}
        </p>

        {!complete && <p className={styles.completeHint}>Complete your profile to get better matches.</p>}

        {(!atOrPastFreeCap || hasCredits) && (
          <>
            <Button
              component={RouterLink}
              to={primaryHref}
              variant="contained"
              size="large"
              className={styles.cta}
            >
              {primaryLabel}
            </Button>
            {complete ? (
              <Button
                component={RouterLink}
                to="/app/discover"
                variant="outlined"
                size="large"
                className={styles.secondaryCta}
              >
                {t('nav.discover')}
              </Button>
            ) : null}
          </>
        )}

        {hardLimitReached && (
          <div className={styles.limitState}>
            <p className={styles.limitMessage}>No free matches or credits left today</p>
            <Button
              component={RouterLink}
              to="/pricing"
              variant="contained"
              size="large"
              className={styles.cta}
            >
              Get Credits
            </Button>
          </div>
        )}
      </div>

      <Modal
        open={limitModalOpen}
        onClose={() => setLimitModalOpen(false)}
        title="Daily match limit reached"
      >
        <div className={styles.limitModalContent}>
          <p className={styles.limitModalText}>
            You&apos;ve used your {DAILY_LIKE_LIMIT} free matches for today (UTC) and don&apos;t have credits left.
            Add credits for unlimited discovery, or come back after midnight UTC.
          </p>
          <div className={styles.limitModalActions}>
            <Button type="button" variant="outlined" onClick={() => setLimitModalOpen(false)}>
              Close
            </Button>
            <Button component={RouterLink} to="/pricing" variant="contained" onClick={() => setLimitModalOpen(false)}>
              Get credits
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
};
