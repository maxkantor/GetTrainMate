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

  const primaryHref = complete ? '/app/discover' : '/onboarding/profile';
  const primaryLabel = complete ? t('landing.cta_start_discovering') : t('landing.cta_finish_profile');
  const usedToday = Math.min(likesToday, DAILY_LIKE_LIMIT);
  const limitReached = usedToday >= DAILY_LIKE_LIMIT;
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
    if (!limitReached) return;
    const dayKey = new Date().toISOString().slice(0, 10);
    const shownKey = `gtm_daily_limit_modal_${dayKey}`;
    if (sessionStorage.getItem(shownKey)) return;
    sessionStorage.setItem(shownKey, '1');
    setLimitModalOpen(true);
  }, [limitReached]);

  return (
    <section className={styles.wrap} aria-label="Your activity">
      <div className={styles.inner}>
        <p className={styles.kicker}>You’re in</p>
        <h1 className={styles.title}>Today's Matches</h1>
        <p className={styles.usage}>{usedToday} / {DAILY_LIKE_LIMIT} used</p>
        <div className={styles.progressWrap} aria-hidden>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
          </div>
          <span className={styles.progressText}>
            {usedToday}/{DAILY_LIKE_LIMIT}
          </span>
        </div>
        <p className={styles.sub}>
          You can connect with up to {DAILY_LIKE_LIMIT} people per day.
          <br />
          Daily limit resets in {resetCountdownLabel}.
        </p>

        {!complete && <p className={styles.completeHint}>Complete your profile to get better matches.</p>}

        {!limitReached && (
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
            {credits > 0 && (
              <>
                <Button
                  component={RouterLink}
                  to="/app/discover"
                  variant="outlined"
                  size="large"
                  className={styles.secondaryCta}
                >
                  Use 1 Credit to Match Now
                </Button>
                <p className={styles.hint}>⚡ Most members use credits to skip the wait</p>
              </>
            )}
          </>
        )}

        {limitReached && (
          <div className={styles.limitState}>
            <p className={styles.limitMessage}>You've reached today's limit</p>
            {credits > 0 ? (
              <>
                <Button
                  type="button"
                  variant="contained"
                  size="large"
                  className={styles.cta}
                  onClick={() => setLimitModalOpen(true)}
                >
                  Use 1 Credit to Continue
                </Button>
                <p className={styles.hint}>⚡ Most members use credits to keep momentum</p>
              </>
            ) : (
              <Button
                component={RouterLink}
                to="/pricing"
                variant="contained"
                size="large"
                className={styles.cta}
              >
                Get Credits
              </Button>
            )}
          </div>
        )}
      </div>

      <Modal
        open={limitModalOpen}
        onClose={() => setLimitModalOpen(false)}
        title="You're out of matches for today."
      >
        <div className={styles.limitModalContent}>
          <p className={styles.limitModalText}>
            You've reached your daily match cap. Wait for reset, or spend 1 credit to continue now.
          </p>
          <div className={styles.limitModalActions}>
            <Button
              type="button"
              variant="outlined"
              onClick={() => setLimitModalOpen(false)}
            >
              Wait for reset
            </Button>
            {credits > 0 ? (
              <Button
                component={RouterLink}
                to="/app/discover"
                variant="contained"
                onClick={() => setLimitModalOpen(false)}
              >
                Use 1 credit now
              </Button>
            ) : (
              <Button
                component={RouterLink}
                to="/pricing"
                variant="contained"
                onClick={() => setLimitModalOpen(false)}
              >
                Get Credits
              </Button>
            )}
          </div>
          {credits <= 0 && <p className={styles.limitModalText}>No credits available right now.</p>}
        </div>
      </Modal>
    </section>
  );
};
