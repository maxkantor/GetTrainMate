import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import { formatI18n } from '@/i18n';
import {
  sportsEventLayerService,
  WORLD_CUP_EVENT_ID,
  type SportsEventConfig,
  type EventMatch,
} from '@/services/sportsEventLayerService';
import { trackEvent } from '@/utils/analytics';
import { normalizePublicAssetUrl } from '@/utils/publicAssetUrl';
import styles from './EventPromoSection.module.css';

const ease = [0.16, 1, 0.3, 1] as const;

const EN_EMOTIONAL_LINE = "Don't watch alone this year.";
const EN_SOCIAL_PROOF_LINE = 'Fans are already connecting near you.';
const EN_URGENCY_LINE = 'Limited free connections — start now.';
const EN_DEFAULT_EVENT_COPY = 'find people to train, play, watch, meet, vibe, or date';

const normalizeCopy = (value: string) => value.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();
const isSeededEnglishEventCopy = (value?: string) => {
  const normalized = normalizeCopy(value ?? '');
  return normalized.includes(EN_DEFAULT_EVENT_COPY) || normalized.includes(normalizeCopy(EN_SOCIAL_PROOF_LINE));
};

interface EventPromoSectionProps {
  event: SportsEventConfig;
}

/** Premium landing-page band for the featured sports event (World Cup Fan Hub). */
export const EventPromoSection: React.FC<EventPromoSectionProps> = ({ event }) => {
  const { locale, t } = useI18n();
  const isWorldCup = event.eventId === WORLD_CUP_EVENT_ID;
  const hubLink = event.hubRoute?.trim() || '/world-cup';
  const themeColor = event.themeColor?.trim() || '#2b2c7f';
  const bannerImageUrl = normalizePublicAssetUrl(event.bannerImageUrl);

  const { data: hub } = useQuery({
    queryKey: ['event-hub-promo', event.eventId],
    queryFn: () => sportsEventLayerService.getHubSnapshot(event.eventId),
    staleTime: 60_000,
    retry: 1,
    enabled: isWorldCup,
  });

  const matches = hub?.matches ?? [];
  const liveMatch = matches.find((m) => m.status === 'Live');
  const latestResult = matches
    .filter((m) => m.status === 'Completed' && m.scoreA != null && m.scoreB != null)
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))[0];
  const nextMatch = matches
    .filter((m) => m.status === 'Scheduled')
    .sort((a, b) => Number(b.isFeatured ?? false) - Number(a.isFeatured ?? false))[0];

  const leader = (hub?.teams ?? [])
    .filter((tm) => tm.played > 0)
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference)[0];
  const leaderGroup = leader
    ? hub?.groups.find((g) => g.groupId === leader.groupId)?.label
    : undefined;

  const crmDescription = event.description?.trim();
  const description = crmDescription && (locale === 'en' || !isSeededEnglishEventCopy(crmDescription))
    ? crmDescription
    : t('sports_event_layer.default_description');
  const title = isWorldCup
    ? t('event_hub.promo_home_title')
    : event.homepageHeadline || event.label;
  const copy = isWorldCup
    ? t('event_hub.promo_home_copy')
    : event.homepageSubheadline || description;
  const trustChips = t('event_hub.trust_line')
    .split(/[.。]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  const eventCopy = normalizeCopy(`${description} ${event.landingHeadline ?? ''} ${event.ctaLabel ?? ''}`);
  const shouldShowLine = (line: string, englishLine: string) =>
    !eventCopy.includes(normalizeCopy(line)) && !eventCopy.includes(normalizeCopy(englishLine));
  const emotionalLine = t('sports_event_layer.emotional_line');
  const socialProofLine = t('sports_event_layer.social_proof_line');
  const urgencyLine = t('sports_event_layer.urgency_line');

  const onPrimaryClick = () => {
    window.sessionStorage.setItem('gtm_event_first_click', '1');
    trackEvent('event_banner_click', {
      eventId: event.eventId,
      eventLabel: event.label,
      sport: event.sport,
      sourcePage: '/',
    });
  };

  const renderTeams = (m: EventMatch) => (
    <div className={styles.tickerTeams}>
      <span className={styles.tickerTeam}>
        <span className={styles.tickerFlag} aria-hidden>{m.teamAFlag}</span>
        <span className={styles.tickerTeamName}>{m.teamAName ?? m.teamAId}</span>
      </span>
      <span className={styles.tickerScore}>
        {m.scoreA != null && m.scoreB != null ? `${m.scoreA} – ${m.scoreB}` : 'vs'}
      </span>
      <span className={`${styles.tickerTeam} ${styles.tickerTeamRight}`}>
        <span className={styles.tickerTeamName}>{m.teamBName ?? m.teamBId}</span>
        <span className={styles.tickerFlag} aria-hidden>{m.teamBFlag}</span>
      </span>
    </div>
  );

  const hasTicker = isWorldCup && Boolean(liveMatch || latestResult || nextMatch);

  return (
    <section className={styles.section} style={{ ['--event-accent' as string]: themeColor }}>
      <div className={styles.bg} aria-hidden>
        {bannerImageUrl ? (
          <div className={styles.bgBanner} style={{ backgroundImage: `url("${bannerImageUrl}")` }} />
        ) : null}
        <div className={styles.bgVeil} />
        <div className={styles.bgGlow} />
        <div className={styles.bgGrain} />
      </div>

      <div className={styles.inner}>
        <motion.div
          className={styles.left}
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, ease }}
        >
          <span className={styles.kicker}>
            <span className={styles.kickerDot} aria-hidden />
            {event.icon} {isWorldCup ? `${t('event_hub.nav_label')} · ${t('event_hub.promo_kicker')}` : event.label}
          </span>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.copy}>{copy}</p>

          {!isWorldCup && shouldShowLine(emotionalLine, EN_EMOTIONAL_LINE) ? (
            <p className={styles.emotionalLine}>{emotionalLine}</p>
          ) : null}
          {!isWorldCup && shouldShowLine(socialProofLine, EN_SOCIAL_PROOF_LINE) ? (
            <p className={styles.socialLine}>{socialProofLine}</p>
          ) : null}
          {!isWorldCup && shouldShowLine(urgencyLine, EN_URGENCY_LINE) ? (
            <p className={styles.urgencyLine}>{urgencyLine}</p>
          ) : null}

          <div className={styles.ctas}>
            <Link to={hubLink} className={styles.btnPrimary} onClick={onPrimaryClick}>
              {event.homepageCtaPrimary || event.ctaLabel?.trim() || t('event_hub.cta_predict')}
            </Link>
            <Link to={hubLink} className={styles.btnGhost}>
              {isWorldCup
                ? t('event_hub.promo_home_cta_secondary')
                : event.homepageCtaSecondary || t('event_hub.cta_connect')}
            </Link>
          </div>

          <ul className={styles.trustChips} aria-label={t('sports_event_layer.trust_text')}>
            {trustChips.map((chip) => (
              <li key={chip} className={styles.trustChip}>{chip}</li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          className={styles.right}
          initial={{ opacity: 0, y: 26, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease, delay: 0.08 }}
        >
          {hasTicker ? (
            <div className={styles.ticker}>
              <div className={styles.tickerHeader}>
                <span className={styles.tickerHeaderLabel}>
                  <span className={styles.liveDot} aria-hidden />
                  {t('event_hub.promo_matchday')}
                </span>
                <Link to={hubLink} className={styles.tickerHeaderLink}>
                  {t('event_hub.cta_view_matches')}
                </Link>
              </div>

              {liveMatch ? (
                <div className={`${styles.tickerRow} ${styles.tickerRowLive}`}>
                  <span className={`${styles.tickerChip} ${styles.chipLive}`}>{t('event_hub.promo_live')}</span>
                  {renderTeams(liveMatch)}
                </div>
              ) : null}

              {latestResult ? (
                <div className={styles.tickerRow}>
                  <span className={`${styles.tickerChip} ${styles.chipFinal}`}>{t('event_hub.promo_full_time')}</span>
                  {renderTeams(latestResult)}
                </div>
              ) : null}

              {nextMatch ? (
                <div className={styles.tickerRow}>
                  <span className={`${styles.tickerChip} ${styles.chipNext}`}>{t('event_hub.promo_up_next')}</span>
                  {renderTeams(nextMatch)}
                </div>
              ) : null}

              {leader && leaderGroup ? (
                <div className={styles.tickerFooter}>
                  <span aria-hidden>🏆</span>
                  {formatI18n(t('event_hub.promo_leader_line'), {
                    team: `${leader.flagEmoji} ${leader.name}`,
                    group: leaderGroup,
                    points: leader.points,
                  })}
                </div>
              ) : null}
            </div>
          ) : (
            <div className={styles.fallbackCard}>
              <span className={styles.fallbackIcon} aria-hidden>{event.icon || '⚽'}</span>
              <p className={styles.fallbackText}>
                {isWorldCup ? t('event_hub.promo_free') : event.homepagePromoText || description}
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
};
