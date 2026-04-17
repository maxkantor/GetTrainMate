import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button } from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { formatI18n } from '@/i18n';
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
  const creditCap = Math.max(me?.lifetimeEarned ?? 0, credits);
  const [limitModalOpen, setLimitModalOpen] = useState(false);

  const primaryHref = '/app';
  const primaryLabel = complete ? t('nav.dashboard') : t('landing.cta_finish_profile');
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
    <section className={styles.wrap} aria-label={t('logged_in_hero.aria')}>
      <div className={styles.inner}>
        <p className={styles.kicker}>{t('logged_in_hero.kicker')}</p>
        <h1 className={styles.title}>{t('logged_in_hero.title')}</h1>
        {hasCredits ? (
          <p className={styles.usage}>
            {formatI18n(t('logged_in_hero.usage_credits'), { credits, cap: creditCap })}
            {me?.unlimitedDiscovery ? t('logged_in_hero.unlimited_suffix') : ''}
            <span className={styles.usageHint}>{t('logged_in_hero.rates_hint')}</span>
          </p>
        ) : (
          <>
            <p className={styles.usage}>
              {formatI18n(t('logged_in_hero.usage_free'), {
                used: Math.min(likesToday, DAILY_LIKE_LIMIT),
                limit: DAILY_LIKE_LIMIT,
              })}
              {likesToday > DAILY_LIKE_LIMIT
                ? formatI18n(t('logged_in_hero.usage_free_extra'), { likes: likesToday })
                : ''}
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
            ? t('logged_in_hero.sub_with_credits')
            : formatI18n(t('logged_in_hero.sub_no_credits'), { limit: DAILY_LIKE_LIMIT })}
          <br />
          {!hasCredits ? formatI18n(t('logged_in_hero.reset_in'), { time: resetCountdownLabel }) : null}
        </p>

        {!complete && <p className={styles.completeHint}>{t('logged_in_hero.complete_hint')}</p>}

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
            <p className={styles.limitMessage}>{t('logged_in_hero.limit_message')}</p>
            <Button
              component={RouterLink}
              to="/pricing"
              variant="contained"
              size="large"
              className={styles.cta}
            >
              {t('header.get_credits')}
            </Button>
          </div>
        )}
      </div>

      <Modal
        open={limitModalOpen}
        onClose={() => setLimitModalOpen(false)}
        title={t('logged_in_hero.modal_title')}
      >
        <div className={styles.limitModalContent}>
          <p className={styles.limitModalText}>
            {formatI18n(t('logged_in_hero.modal_body'), { limit: DAILY_LIKE_LIMIT })}
          </p>
          <div className={styles.limitModalActions}>
            <Button type="button" variant="outlined" onClick={() => setLimitModalOpen(false)}>
              {t('logged_in_hero.close')}
            </Button>
            <Button component={RouterLink} to="/pricing" variant="contained" onClick={() => setLimitModalOpen(false)}>
              {t('header.get_credits')}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
};
