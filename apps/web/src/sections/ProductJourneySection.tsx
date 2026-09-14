import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { NO_PHOTO_PLACEHOLDER } from '@/utils/profilePhotos';
import { trackEvent } from '@/utils/analytics';
import styles from './ProductJourneySection.module.css';

/**
 * Curated stable Bedrock assets (one-time generation → public/images/hiw/).
 * Not bound to daily FB/IG automation. MEET keeps hero-train-together.
 * Sources: discover-discover-run.jpg + match-match-v2-trail-c.jpg
 */
const HIW_DISCOVER_PHOTO = '/images/hiw/discover.jpg';
const HIW_DISCOVER_AVATAR = '/images/hiw/discover-avatar.jpg';
const HIW_MATCH_PEER = '/images/hiw/match-peer.jpg';

const discover = {
  name: 'Runner',
  age: 28,
  photo: HIW_DISCOVER_PHOTO,
  avatar: HIW_DISCOVER_AVATAR,
  tags: ['RUNNING', 'YOGA', 'HIKING'] as const,
  matchPct: 94,
};

const matchPeer = {
  photo: HIW_MATCH_PEER,
};

const meetPhoto = '/images/hero-train-together.png';
/**
 * How It Works — permanently visible Discover → Match → Chat → Meet journey.
 * Visual polish: richer Discover / Match / Chat; Meet kept as quality benchmark.
 */
export const ProductJourneySection: React.FC = () => {
  const { isAuthenticated } = useAuthContext();
  const ctaHref = isAuthenticated ? '/app' : '/signup?src=how-it-works';

  return (
    <section id="how-it-works" className={styles.section} aria-labelledby="how-it-works-heading">
      <div className={styles.glowDiscover} aria-hidden />
      <div className={styles.glowMatch} aria-hidden />
      <div className={styles.glowChat} aria-hidden />
      <div className={styles.glowMeet} aria-hidden />

      <div className={styles.inner}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>HOW IT WORKS</p>
          <h2 id="how-it-works-heading" className={styles.title}>
            <span className={styles.titleSans}>FROM FIRST LOOK</span>
            <span className={styles.titleSerif}>TO REAL CONNECTION.</span>
          </h2>
          <p className={styles.sub}>
            Discover people around you, connect when the interest is mutual,
            <br className={styles.subBreak} />
            chat naturally, then take it offline.
          </p>
        </header>

        <ol className={styles.journey}>
          {/* 01 DISCOVER */}
          <li className={`${styles.stage} ${styles.stageDiscover}`}>
            <div className={styles.stageMeta}>
              <span className={styles.stageNum}>01</span>
              <span className={styles.stageLabel}>DISCOVER</span>
            </div>
            <div className={styles.stageVisual}>
              <div className={styles.discoverCard}>
                <img
                  src={discover.photo}
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
                    {discover.name}, {discover.age}
                  </p>
                  <div className={styles.discoverTags}>
                    {discover.tags.map((tag) => (
                      <span key={tag} className={styles.tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <span className={styles.modeChip}>TRAIN</span>
                </div>
                <div className={styles.discoverActions} aria-hidden>
                  <span className={styles.actPass}>Pass</span>
                  <span className={styles.actView}>View</span>
                  <span className={styles.actTrain}>Train</span>
                </div>
              </div>
            </div>
            <p className={styles.stageCopy}>Find people who match your activity, pace, and vibe.</p>
          </li>

          {/* 02 MATCH */}
          <li className={`${styles.stage} ${styles.stageMatch}`}>
            <div className={styles.stageMeta}>
              <span className={styles.stageNum}>02</span>
              <span className={styles.stageLabel}>MATCH</span>
            </div>
            <div className={styles.stageVisual}>
              <div className={styles.matchCard}>
                <div className={styles.matchAvatars} aria-hidden>
                  <span className={styles.matchGlow} />
                  <img
                    src={discover.avatar}
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
                <p className={styles.matchPct}>{discover.matchPct}%</p>
                <h3 className={styles.matchTitle}>IT&apos;S A MATCH</h3>
                <p className={styles.matchHint}>You both want to connect.</p>
                <ul className={styles.matchReasons}>
                  <li>
                    <span className={styles.matchCheck} aria-hidden>
                      ✓
                    </span>
                    Similar training goals
                  </li>
                  <li>
                    <span className={styles.matchCheck} aria-hidden>
                      ✓
                    </span>
                    Morning workouts
                  </li>
                  <li>
                    <span className={styles.matchCheck} aria-hidden>
                      ✓
                    </span>
                    94% compatibility
                  </li>
                </ul>
              </div>
            </div>
            <p className={styles.stageCopy}>Mutual interest unlocks the connection.</p>
          </li>

          {/* 03 CHAT */}
          <li className={`${styles.stage} ${styles.stageChat}`}>
            <div className={styles.stageMeta}>
              <span className={styles.stageNum}>03</span>
              <span className={styles.stageLabel}>CHAT</span>
            </div>
            <div className={styles.stageVisual}>
              <div className={styles.chatCard}>
                <div className={styles.chatHeader}>
                  <img
                    src={discover.avatar}
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
                    <p className={styles.chatName}>{discover.name}</p>
                    <p className={styles.chatOnline}>Online now</p>
                  </div>
                </div>
                <div className={styles.chatBubbles}>
                  <p className={styles.bubbleIn}>Want to run tomorrow morning?</p>
                  <p className={styles.bubbleOut}>Yes — 7am at the park entrance works.</p>
                  <p className={styles.bubbleIn}>Perfect. See you there.</p>
                  <p className={styles.bubbleOut}>👍 See you then.</p>
                  <p className={styles.chatSeen}>Seen</p>
                </div>
                <div className={styles.chatComposer} aria-hidden>
                  <span className={styles.chatComposerField}>Message...</span>
                  <span className={styles.chatSend}>➤</span>
                </div>
              </div>
            </div>
            <p className={styles.stageCopy}>Make a plan without leaving GetTrainMate.</p>
          </li>

          {/* 04 MEET — quality benchmark, unchanged */}
          <li className={`${styles.stage} ${styles.stageMeet}`}>
            <div className={styles.stageMeta}>
              <span className={styles.stageNum}>04</span>
              <span className={styles.stageLabel}>MEET</span>
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
                  <span className={styles.meetBadge}>MEET</span>
                  <p className={styles.meetEvent}>Saturday Run</p>
                  <p className={styles.meetMeta}>7:00 AM · Piedmont Park</p>
                  <span className={styles.meetCta}>JOIN EVENT</span>
                </div>
              </div>
            </div>
            <p className={styles.stageCopy}>Turn the match into a workout, meetup, or something more.</p>
          </li>
        </ol>

        <div className={styles.close}>
          <p className={styles.closeAsk}>READY TO FIND YOUR PEOPLE?</p>
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
            FIND YOUR PEOPLE
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
};

