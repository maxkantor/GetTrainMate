import React from 'react';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { useI18n } from '@/hooks/useI18n';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';
import type { EventHubLiveStats, EventHubSettings } from '@/services/sportsEventLayerService';
import styles from '@/pages/EventHub.module.css';

type Props = {
  settings: EventHubSettings;
  themeColor: string;
  liveStats?: EventHubLiveStats;
  lastUpdated?: string | null;
  onPredict: () => void;
  onConnect: () => void;
};

export const EventHubHero: React.FC<Props> = ({ settings, themeColor, liveStats, lastUpdated, onPredict, onConnect }) => {
  const { t } = useI18n();
  const predictions = useAnimatedCounter(liveStats?.predictionsSubmitted ?? 0);
  const fans = useAnimatedCounter(liveStats?.activeFans ?? 0);
  const discussed = useAnimatedCounter(liveStats?.matchesDiscussed ?? 0);
  const connections = useAnimatedCounter(liveStats?.connectionsMade ?? 0);
  const showStats = (liveStats?.predictionsSubmitted ?? 0) > 0
    || (liveStats?.activeFans ?? 0) > 0
    || (liveStats?.matchesDiscussed ?? 0) > 0
    || (liveStats?.connectionsMade ?? 0) > 0;

  return (
    <Box className={styles.hero} sx={{ '--wc-accent': themeColor } as React.CSSProperties}>
      <Box className={styles.heroGlow} aria-hidden />
      <Container maxWidth="lg" className={styles.heroInner}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <Typography component="p" className={styles.heroEyebrow}>⚽ World Cup 2026 Fan Hub</Typography>
          <Typography component="h1" className={styles.heroHeadline}>
            {settings.homepageHeadline ?? t('event_hub.hero_headline_premium')}
          </Typography>
          <Typography className={styles.heroSub}>
            {settings.homepageSubheadline ?? t('event_hub.hero_subtitle_premium')}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} className={styles.heroCtas}>
            <Button variant="contained" size="large" className={styles.ctaPrimary} onClick={onPredict}>
              {settings.homepageCtaPrimary ?? t('event_hub.cta_predict')}
            </Button>
            <Button variant="outlined" size="large" className={styles.ctaSecondary} onClick={onConnect}>
              {settings.homepageCtaSecondary ?? t('event_hub.cta_connect')}
            </Button>
          </Stack>
          <Typography className={styles.heroFine}>{settings.homepagePromoText ?? t('event_hub.promo_free')}</Typography>
          {lastUpdated ? (
            <Typography className={styles.lastUpdated}>
              {t('event_hub.fixtures_last_updated')}: {lastUpdated}
            </Typography>
          ) : null}
        </motion.div>

        {showStats ? (
          <motion.div
            className={styles.liveStats}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.6 }}
          >
            {[
              { icon: '🔥', label: t('event_hub.stat_predictions'), value: predictions },
              { icon: '🌎', label: t('event_hub.stat_fans'), value: fans },
              { icon: '⚽', label: t('event_hub.stat_discussed'), value: discussed },
              { icon: '❤️', label: t('event_hub.stat_connections'), value: connections },
            ].map((s) => (
              <Box key={s.label} className={styles.liveStatCard}>
                <span className={styles.liveStatIcon}>{s.icon}</span>
                <span className={styles.liveStatValue}>{s.value.toLocaleString()}</span>
                <span className={styles.liveStatLabel}>{s.label}</span>
              </Box>
            ))}
          </motion.div>
        ) : null}
      </Container>
    </Box>
  );
};
