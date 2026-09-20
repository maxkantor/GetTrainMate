import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useI18n } from '@/hooks/useI18n';
import { NO_PHOTO_PLACEHOLDER } from '@/utils/profilePhotos';
import { trackEvent } from '@/utils/analytics';
import styles from './ProductJourneySection.module.css';

/** Same stable Bedrock assets as before — not bound to daily FB/IG automation. */
const HIW_DISCOVER_PHOTO = '/images/hiw/discover.jpg';
const HIW_DISCOVER_AVATAR = '/images/hiw/discover-avatar.jpg';
const HIW_MATCH_PEER = '/images/hiw/match-peer.jpg';
const meetPhoto = '/images/hero-train-together.png';

const discoverDemo = {
  photo: HIW_DISCOVER_PHOTO,
  avatar: HIW_DISCOVER_AVATAR,
  matchPct: 94,
};

const matchPeer = {
  photo: HIW_MATCH_PEER,
};

export const ProductJourneySection: React.FC = () => {
  const { isAuthenticated } = useAuthContext();
  const { t } = useI18n();
  const ctaHref = isAuthenticated ? '/app' : '/signup?src=how-it-works';

  const discoverTags = [
    t('landing.hiw_tag_running'),
    t('landing.hiw_tag_yoga'),
    t('landing.hiw_tag_hiking'),
  ] as const;

  const matchReasons = [
    t('landing.hiw_match_reason_1'),
    t('landing.hiw_match_reason_2'),
    t('landing.hiw_match_reason_3'),
  ];

  return (
    <section id="how-it-works" className={styles.section} aria-labelledby="how-it-works-heading">
      <div className={styles.glowDiscover} aria-hidden />
      <div className={styles.glowMatch} aria-hidden />
      <div className={styles.glowChat} aria-hidden />
      <div className={styles.glowMeet} aria-hidden />

      <div className={styles.inner}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>{t('landing.hiw_eyebrow')}</p>
          <h2 id="how-it-works-heading" className={styles.title}>
            <span className={styles.titleSans}>{t('landing.hiw_title_1')}</span>
            <span className={styles.titleSerif}>{t('landing.hiw_title_2')}</span>
          </h2>
          <p className={styles.sub}>{t('landing.hiw_sub')}</p>
        </header>

        <ol className={styles.journey}>
          <li className={`${styles.stage} ${styles.stageDiscover}`}>
            <div className={styles.stageMeta}>
              <span className={styles.stageNum}>01</span>
              <span className={styles.stageLabel}>{t('landing.hiw_stage_discover')}</span>
            </div>
            <div className={styles.stageVisual}>
              <div className={styles.discoverCard}>
                <img
                  src={discoverDemo.photo}
                  alt=""
                  width={320}
                  height={400}
                  loading="lazy"
                  className={styles.discoverPhoto}
                  onError={(e) => {
                    e.currentTarget.src = NO_PHOTO_PLACEHOLDER;
                  }}
                />
                <div className={styles.discoverOverlay}>
                  <p className={styles.discoverName}>
                    {t('landing.hiw_demo_name')}, {t('landing.hiw_demo_age')}
                  </p>
                  <div className={styles.discoverTags}>
                    {discoverTags.map((tag) => (
                      <span key={tag} className={styles.tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <span className={styles.modeChip}>{t('landing.hero_mode_train_label')}</span>
                </div>
                <div className={styles.discoverActions} aria-hidden>
                  <span className={styles.actPass}>{t('landing.hiw_act_pass')}</span>
                  <span className={styles.actView}>{t('landing.hiw_act_view')}</span>
                  <span className={styles.actTrain}>{t('landing.hiw_act_train')}</span>
                </div>
              </div>
            </div>
            <p className={styles.stageCopy}>{t('landing.hiw_discover_copy')}</p>
          </li>

          <li className={`${styles.stage} ${styles.stageMatch}`}>
            <div className={styles.stageMeta}>
              <span className={styles.stageNum}>02</span>
              <span className={styles.stageLabel}>{t('landing.hiw_stage_match')}</span>
            </div>
            <div className={styles.stageVisual}>
              <div className={styles.matchCard}>
                <div className={styles.matchAvatars} aria-hidden>
                  <span className={styles.matchGlow} />
                  <img
                    src={discoverDemo.avatar}
                    alt=""
                    className={styles.matchAvatar}
                    width={112}
                    height={112}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = NO_PHOTO_PLACEHOLDER;
                    }}
                  />
                  <img
                    src={matchPeer.photo}
                    alt=""
                    className={`${styles.matchAvatar} ${styles.matchAvatarRight}`}
                    width={112}
                    height={112}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = NO_PHOTO_PLACEHOLDER;
                    }}
                  />
                  <span className={styles.matchHeart}>♥</span>
                </div>
                <p className={styles.matchPct}>
                  {discoverDemo.matchPct}%{' '}
                  <span className={styles.matchPctLabel}>{t('landing.hiw_match_compat_label')}</span>
                </p>
                <h3 className={styles.matchTitle}>{t('landing.hiw_match_title')}</h3>
                <p className={styles.matchHint}>{t('landing.hiw_match_hint')}</p>
                <ul className={styles.matchReasons}>
                  {matchReasons.map((reason) => (
                    <li key={reason}>
                      <span className={styles.matchCheck} aria-hidden>
                        ✓
                      </span>
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className={styles.stageCopy}>{t('landing.hiw_match_copy')}</p>
          </li>

          <li className={`${styles.stage} ${styles.stageChat}`}>
            <div className={styles.stageMeta}>
              <span className={styles.stageNum}>03</span>
              <span className={styles.stageLabel}>{t('landing.hiw_stage_chat')}</span>
            </div>
            <div className={styles.stageVisual}>
              <div className={styles.chatCard}>
                <div className={styles.chatHeader}>
                  <img
                    src={discoverDemo.avatar}
                    alt=""
                    className={styles.chatAvatar}
                    width={44}
                    height={44}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = NO_PHOTO_PLACEHOLDER;
                    }}
                  />
                  <div>
                    <p className={styles.chatName}>{t('landing.hiw_demo_name')}</p>
                    <p className={styles.chatOnline}>{t('landing.hiw_chat_online')}</p>
                  </div>
                </div>
                <div className={styles.chatBubbles}>
                  <p className={styles.bubbleIn}>{t('landing.product_chat_1')}</p>
                  <p className={styles.bubbleOut}>{t('landing.product_chat_2')}</p>
                  <p className={styles.bubbleIn}>{t('landing.product_chat_3')}</p>
                  <p className={styles.bubbleOut}>{t('landing.product_chat_4')}</p>
                  <p className={styles.chatSeen}>{t('landing.hiw_chat_seen')}</p>
                </div>
                <div className={styles.chatComposer} aria-hidden>
                  <span className={styles.chatComposerField}>{t('landing.hiw_chat_placeholder')}</span>
                  <span className={styles.chatSend}>➤</span>
                </div>
              </div>
            </div>
            <p className={styles.stageCopy}>{t('landing.hiw_chat_copy')}</p>
          </li>

          <li className={`${styles.stage} ${styles.stageMeet}`}>
            <div className={styles.stageMeta}>
              <span className={styles.stageNum}>04</span>
              <span className={styles.stageLabel}>{t('landing.hiw_stage_meet')}</span>
            </div>
            <div className={styles.stageVisual}>
              <div className={styles.meetCard}>
                <img
                  src={meetPhoto}
                  alt=""
                  className={styles.meetPhoto}
                  width={400}
                  height={280}
                  loading="lazy"
                />
                <div className={styles.meetOverlay}>
                  <span className={styles.meetBadge}>{t('landing.hiw_meet_badge')}</span>
                  <p className={styles.meetEvent}>{t('landing.hiw_meet_event')}</p>
                  <p className={styles.meetMeta}>{t('landing.hiw_meet_meta')}</p>
                  <span className={styles.meetCta}>{t('landing.hiw_meet_cta')}</span>
                </div>
              </div>
            </div>
            <p className={styles.stageCopy}>{t('landing.hiw_meet_copy')}</p>
          </li>
        </ol>

        <div className={styles.close}>
          <p className={styles.closeAsk}>{t('landing.hiw_close_ask')}</p>
          <Link
            to={ctaHref}
            className={styles.closeBtn}
            onClick={() => {
              trackEvent('hero_cta_clicked', {
                source_page: '/#how-it-works',
                user_status: isAuthenticated ? 'authenticated' : 'guest',
              });
            }}
          >
            {t('landing.landing_primary_cta')}
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
};
