import React, { useState } from 'react';
import { Box, Collapse, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import type { EventMatch } from '@/services/sportsEventLayerService';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import { WcTeamLabel } from '@/components/worldCupHub/WcTeamLabel';
import styles from '@/pages/WorldCupV2.module.css';

type Props = {
  eventId: string;
  match: EventMatch;
  enabled?: boolean;
};

export const WcMatchIntelligence: React.FC<Props> = ({ eventId, match, enabled = true }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const { data: intel } = useQuery({
    queryKey: ['match-intelligence', eventId, match.matchId],
    queryFn: () => sportsEventLayerService.getMatchIntelligence(eventId, match.matchId),
    enabled: enabled && open,
    staleTime: 45_000,
  });

  if (!enabled) return null;

  return (
    <Box className={styles.intelWrap}>
      <button type="button" className={styles.intelToggle} onClick={() => setOpen((v) => !v)}>
        <span className={styles.intelToggleIcon}>📊</span>
        <span>{t('event_hub.match_intelligence')}</span>
        <span className={styles.intelChevron}>{open ? '▾' : '▸'}</span>
      </button>

      <Collapse in={open}>
        <Box className={styles.intelPanel}>
          {!intel ? (
            <Typography className={styles.intelMuted}>{t('common.loading')}</Typography>
          ) : (
            <>
              {(intel.teamAFifaRank || intel.teamBFifaRank) && (
                <Box className={styles.intelSimpleRow}>
                  <span className={styles.intelSimpleIcon}>🏆</span>
                  <Box>
                    <Typography className={styles.intelSimpleTitle}>{t('event_hub.intel_fifa_rank')}</Typography>
                    <Typography className={styles.intelSimpleBody}>
                      <WcTeamLabel teamId={match.teamAId} fallbackName={intel.teamAName ?? match.teamAName} flagEmoji={match.teamAFlag} size={18} />
                      {' '}#{intel.teamAFifaRank}
                    </Typography>
                    <Typography className={styles.intelSimpleBody} sx={{ mt: 0.35 }}>
                      <WcTeamLabel teamId={match.teamBId} fallbackName={intel.teamBName ?? match.teamBName} flagEmoji={match.teamBFlag} size={18} />
                      {' '}#{intel.teamBFifaRank}
                    </Typography>
                  </Box>
                </Box>
              )}

              {intel.fanSentimentLabel && (
                <Box className={styles.intelSimpleRow}>
                  <span className={styles.intelSimpleIcon}>🔥</span>
                  <Box>
                    <Typography className={styles.intelSimpleTitle}>{t('event_hub.intel_fan_sentiment')}</Typography>
                    <Typography className={styles.intelSimpleBody}>{intel.fanSentimentLabel}</Typography>
                  </Box>
                </Box>
              )}

              <Box className={styles.intelSimpleRow}>
                <span className={styles.intelSimpleIcon}>⚠️</span>
                <Box>
                  <Typography className={styles.intelSimpleTitle}>{t('event_hub.upset_watch')}</Typography>
                  <Typography className={styles.intelSimpleBody}>{intel.upsetWatchLevel ?? 'Low'}</Typography>
                </Box>
              </Box>

              <Box className={styles.intelSimpleRow}>
                <span className={styles.intelSimpleIcon}>💬</span>
                <Box>
                  <Typography className={styles.intelSimpleTitle}>{t('event_hub.intel_quick_insight')}</Typography>
                  <Typography className={styles.intelSimpleBody}>{intel.quickInsight || intel.neutralInsight}</Typography>
                </Box>
              </Box>

              <Typography className={styles.intelDisclaimer}>{t('event_hub.intel_disclaimer')}</Typography>
            </>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};
