import React from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '@/hooks/useI18n';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import styles from './BentoFeatures.module.css';

const FEATURES = [
  {
    key: 'match',
    titleKey: 'landing.features_bento_ai_title',
    descKey: 'landing.features_bento_ai_desc',
    preview: 'match' as const,
  },
  {
    key: 'chat',
    titleKey: 'landing.features_bento_chat_title',
    descKey: 'landing.features_bento_chat_desc',
    preview: 'chat' as const,
  },
  {
    key: 'events',
    titleKey: 'landing.features_bento_events_title',
    descKey: 'landing.features_bento_events_desc',
    preview: 'events' as const,
  },
  {
    key: 'ai',
    titleKey: 'landing.features_showcase_ai_title',
    descKey: 'landing.features_showcase_ai_desc',
    preview: 'ai' as const,
  },
  {
    key: 'momentum',
    titleKey: 'landing.features_bento_progress_title',
    descKey: 'landing.features_bento_progress_desc',
    preview: 'momentum' as const,
  },
] as const;

function MiniPreview({ kind }: { kind: (typeof FEATURES)[number]['preview'] }) {
  if (kind === 'match') {
    return (
      <div className={styles.miniUi} aria-hidden>
        <div className={styles.miniCard}>
          <div className={styles.miniAvatar} />
          <div className={styles.miniLines}>
            <span className={styles.miniLineWide} />
            <span className={styles.miniLine} />
            <span className={styles.miniTags}>
              <i />
              <i />
            </span>
          </div>
          <span className={styles.miniPct}>94%</span>
        </div>
      </div>
    );
  }
  if (kind === 'chat') {
    return (
      <div className={styles.miniUi} aria-hidden>
        <div className={styles.miniChat}>
          <span className={styles.bubbleLeft} />
          <span className={styles.bubbleRight} />
          <span className={styles.bubbleLeftShort} />
        </div>
      </div>
    );
  }
  if (kind === 'events') {
    return (
      <div className={styles.miniUi} aria-hidden>
        <div className={styles.miniEvent}>
          <span className={styles.miniEventDate} />
          <span className={styles.miniLineWide} />
          <span className={styles.miniLine} />
        </div>
      </div>
    );
  }
  if (kind === 'ai') {
    return (
      <div className={styles.miniUi} aria-hidden>
        <div className={styles.miniAi}>
          <span className={styles.miniAiScore}>87%</span>
          <span className={styles.miniLine} />
          <span className={styles.miniLine} />
        </div>
      </div>
    );
  }
  return (
    <div className={styles.miniUi} aria-hidden>
      <div className={styles.miniMomentum}>
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export const Features: React.FC = () => {
  const { t } = useI18n();
  return (
    <Section id="features" background="subtle" paddingSize="md" className={`${styles.section} premium-section-bg`}>
      <Container>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.45 }}
        >
          <span className={styles.kicker}>{t('landing.features_bento_kicker')}</span>
          <h2 className={styles.title}>{t('landing.features_bento_title')}</h2>
          <p className={styles.subtitle}>{t('landing.features_bento_subtitle')}</p>
        </motion.div>

        <div className={styles.showcase}>
          {FEATURES.map((card, i) => (
            <motion.article
              key={card.key}
              className={styles.showcaseCard}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.04, duration: 0.4 }}
            >
              <MiniPreview kind={card.preview} />
              <div className={styles.showcaseCopy}>
                <h3 className={styles.cardTitle}>{t(card.titleKey)}</h3>
                <p className={styles.cardDesc}>{t(card.descKey)}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </Container>
    </Section>
  );
};
