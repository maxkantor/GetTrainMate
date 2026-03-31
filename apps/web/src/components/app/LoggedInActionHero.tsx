import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button } from '@mui/material';
import { useMe } from '@/hooks/useMe';
import { useMatchStatusForHeader } from '@/hooks/useMatchStatusForHeader';
import { DAILY_LIKE_LIMIT } from '@/config/appLimits';
import styles from './LoggedInActionHero.module.css';

/**
 * Replaces marketing hero on `/` when the user is logged in.
 * Pre-login landing is unchanged.
 */
export const LoggedInActionHero: React.FC = () => {
  const { me } = useMe();
  const { waitingForAction, likesToday, loading } = useMatchStatusForHeader(true);
  const complete = me?.isProfileComplete ?? false;

  const primaryHref = complete ? '/app/discover' : '/onboarding/profile';
  const primaryLabel = complete ? 'Start Matching' : 'Finish profile';

  const statusPrimary =
    !loading && waitingForAction > 0
      ? `${waitingForAction} match${waitingForAction === 1 ? '' : 'es'} waiting`
      : null;
  const statusSecondary = `${Math.min(likesToday, DAILY_LIKE_LIMIT)}/${DAILY_LIKE_LIMIT} matches used today`;

  return (
    <section className={styles.wrap} aria-label="Your activity">
      <div className={styles.inner}>
        <p className={styles.kicker}>You’re in</p>
        <h1 className={styles.title}>
          {statusPrimary ? (
            <>
              <span className={styles.em}>{statusPrimary}</span>
              <span className={styles.sub}>
                {statusSecondary}
                {complete ? ' · Keep swiping to find more.' : ''}
              </span>
            </>
          ) : (
            <>
              <span className={styles.em}>{statusSecondary}</span>
              <span className={styles.sub}>
                {complete ? 'Train likes reset daily.' : 'Complete your profile to get matches.'}
              </span>
            </>
          )}
        </h1>
        <Button
          component={RouterLink}
          to={primaryHref}
          variant="contained"
          size="large"
          className={styles.cta}
        >
          {primaryLabel}
        </Button>
      </div>
    </section>
  );
};
