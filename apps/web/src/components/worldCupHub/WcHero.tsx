import React from 'react';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { useI18n } from '@/hooks/useI18n';
import styles from '@/pages/EventHub.module.css';

type Props = {
  lastUpdated?: string | null;
  onPredict: () => void;
  onViewMatches: () => void;
};

export const WcHero: React.FC<Props> = ({ lastUpdated, onPredict, onViewMatches }) => {
  const { t } = useI18n();

  return (
    <Box className={styles.hero}>
      <Box className={styles.heroGlow} aria-hidden />
      <Container maxWidth="lg" className={styles.heroInner}>
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <Typography className={styles.heroEyebrow}>⚽ World Cup 2026</Typography>
          <Typography component="h1" className={styles.heroHeadline}>
            {t('event_hub.hero_title_v2')}
          </Typography>
          <Typography className={styles.heroSub}>{t('event_hub.hero_sub_v2')}</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} className={styles.heroCtas}>
            <Button variant="contained" size="large" className={styles.ctaPrimary} onClick={onPredict}>
              {t('event_hub.cta_predict')}
            </Button>
            <Button variant="outlined" size="large" className={styles.ctaSecondary} onClick={onViewMatches}>
              {t('event_hub.cta_view_matches')}
            </Button>
          </Stack>
          <Typography className={styles.trustLine}>{t('event_hub.trust_line')}</Typography>
          {lastUpdated ? (
            <Typography className={styles.lastUpdated}>
              {t('event_hub.fixtures_last_updated')}: {lastUpdated}
            </Typography>
          ) : null}
        </motion.div>
      </Container>
    </Box>
  );
};
