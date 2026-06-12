import React from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { useI18n } from '@/hooks/useI18n';
import styles from '@/pages/EventHub.module.css';

const INTENTS = [
  { key: 'watch', emoji: '⚽', param: 'watch', gradient: 'linear-gradient(135deg, #1e3a5f, #0d1b2a)' },
  { key: 'train', emoji: '🏋️', param: 'train', gradient: 'linear-gradient(135deg, #2d1b4e, #1a0f2e)' },
  { key: 'vibe', emoji: '🍻', param: 'vibe', gradient: 'linear-gradient(135deg, #1a3a2e, #0f1f18)' },
  { key: 'date', emoji: '❤️', param: 'date', gradient: 'linear-gradient(135deg, #4a1942, #2a0f24)' },
] as const;

type Props = {
  onConnect: (param: string) => void;
};

export const ConnectFans: React.FC<Props> = ({ onConnect }) => {
  const { t } = useI18n();

  return (
    <Box component="section" className={styles.section} id="connect">
      <Typography component="h2" className={styles.sectionTitle}>{t('event_hub.connect_title')}</Typography>
      <Typography className={styles.sectionLead}>{t('event_hub.connect_lead')}</Typography>
      <Grid container spacing={2}>
        {INTENTS.map((intent, i) => (
          <Grid item xs={6} md={3} key={intent.key}>
            <motion.button
              type="button"
              className={styles.connectCard}
              style={{ background: intent.gradient }}
              onClick={() => onConnect(intent.param)}
              whileHover={{ scale: 1.03, y: -4 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <span className={styles.connectEmoji}>{intent.emoji}</span>
              <span className={styles.connectLabel}>{t(`event_hub.connect_${intent.key}`)}</span>
            </motion.button>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};
