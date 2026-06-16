import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import { WC_BACKDROP_IMAGES } from '@/config/worldCupMedia';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import { WcTrophyLogo } from '@/components/worldCupHub/WcTrophyLogo';
import styles from '@/pages/WorldCupV2.module.css';

type Props = {
  eventId: string;
  onPredict: () => void;
  onViewGroups: () => void;
};

export const WcHeroV2: React.FC<Props> = ({ eventId, onPredict, onViewGroups }) => {
  const { t } = useI18n();

  const { data: stats } = useQuery({
    queryKey: ['live-stats', eventId],
    queryFn: () => sportsEventLayerService.getLiveStats(eventId),
    refetchInterval: 45_000,
  });

  const counters = [
    { value: stats?.matchesPlayed ?? 0, label: t('event_hub.stat_matches_played') },
    { value: stats?.predictionsSubmitted ?? 0, label: t('event_hub.stat_predictions') },
    { value: stats?.activeFans ?? 0, label: t('event_hub.stat_fans') },
    { value: stats?.countriesRepresented ?? 0, label: t('event_hub.stat_countries') },
  ];

  return (
    <Box className={styles.hero}>
      <Box
        className={styles.heroPhoto}
        aria-hidden
        style={{ backgroundImage: `url('${WC_BACKDROP_IMAGES.stadiumAerial}')` }}
      />
      <Box
        className={styles.heroPhotoAccent}
        aria-hidden
        style={{ backgroundImage: `url('${WC_BACKDROP_IMAGES.stadiumCrowd}')` }}
      />
      <Box className={styles.heroVeil} aria-hidden />
      <Box className={styles.heroGlow} aria-hidden />
      <Box className={styles.heroGrain} aria-hidden />
      <Box className={styles.heroInner}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Box className={styles.heroTrophyWrap}>
            <WcTrophyLogo size="hero" glow hoverable />
          </Box>
          <Typography className={styles.heroEyebrow}>
            {t('event_hub.hero_eyebrow')}
          </Typography>
          <Typography component="h1" className={styles.heroHeadline}>
            {t('event_hub.v2_hero_title')}
          </Typography>
          <Typography className={styles.heroSub}>{t('event_hub.v2_hero_sub')}</Typography>

          <Box className={styles.statGrid}>
            {counters.map((c) => (
              <Box key={c.label} className={styles.statCard}>
                <Typography className={styles.statValue}>{c.value.toLocaleString()}</Typography>
                <Typography className={styles.statLabel}>{c.label}</Typography>
              </Box>
            ))}
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} className={styles.heroCtas}>
            <Button
              variant="contained"
              size="large"
              className={`${styles.ctaPrimaryGold} ${styles.ctaWithTrophy}`}
              onClick={onPredict}
            >
              <WcTrophyLogo size="nav" />
              {t('event_hub.cta_predict')}
            </Button>
            <Button variant="outlined" size="large" className={styles.ctaSecondary} onClick={onViewGroups}>
              {t('event_hub.cta_view_groups')}
            </Button>
          </Stack>
          <Typography className={styles.trustLine}>{t('event_hub.trust_line')}</Typography>
        </motion.div>
      </Box>
    </Box>
  );
};
