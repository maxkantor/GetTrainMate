import React, { useState } from 'react';
import { Box, Collapse, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import { useWcDisplay } from '@/hooks/useWcDisplay';
import { formatI18n } from '@/i18n';
import type { EventMatch } from '@/services/sportsEventLayerService';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import styles from '@/pages/WorldCupV2.module.css';

type Props = {
  eventId: string;
  match: EventMatch;
  enabled?: boolean;
};

export const WcMatchIntelligence: React.FC<Props> = ({ eventId, match, enabled = true }) => {
  const { t } = useI18n();
  const { teamName } = useWcDisplay();
  const [open, setOpen] = useState(false);

  const { data: intel } = useQuery({
    queryKey: ['match-intelligence', eventId, match.matchId],
    queryFn: () => sportsEventLayerService.getMatchIntelligence(eventId, match.matchId),
    enabled: enabled && open,
    staleTime: 45_000,
  });

  if (!enabled) return null;

  const teamADisplay = teamName(match.teamAId, match.teamAName);
  const teamBDisplay = teamName(match.teamBId, match.teamBName);

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
              <Typography className={styles.intelKicker}>{t('event_hub.community_split')}</Typography>
              {intel.communityPicks.length > 0 ? (
                <Box className={styles.intelSplitGrid}>
                  {intel.communityPicks.map((o) => (
                    <Box key={`${o.outcomeType}-${o.teamId ?? 'draw'}`} className={styles.intelSplitRow}>
                      <span>{o.label}</span>
                      <strong>{o.percent}%</strong>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography className={styles.intelMuted}>{t('event_hub.intel_no_picks_yet')}</Typography>
              )}

              {intel.upsetProbabilityPercent > 0 && (
                <Box className={styles.intelUpsetBadge}>
                  {t('event_hub.upset_watch')}: {intel.upsetProbabilityPercent}%
                </Box>
              )}

              <Typography className={styles.intelInsight}>{intel.neutralInsight}</Typography>

              {(intel.teamAForm || intel.teamBForm) && (
                <Box className={styles.intelFormGrid}>
                  {intel.teamAForm && (
                    <Box className={styles.intelFormCard}>
                      <Typography className={styles.intelFormTitle}>
                        {intel.teamAForm.flagEmoji} {teamADisplay}
                      </Typography>
                      <Typography className={styles.intelFormLine}>{intel.teamAForm.formSummary}</Typography>
                    </Box>
                  )}
                  {intel.teamBForm && (
                    <Box className={styles.intelFormCard}>
                      <Typography className={styles.intelFormTitle}>
                        {intel.teamBForm.flagEmoji} {teamBDisplay}
                      </Typography>
                      <Typography className={styles.intelFormLine}>{intel.teamBForm.formSummary}</Typography>
                    </Box>
                  )}
                </Box>
              )}

              {intel.whyFansPickTeamA && (
                <Typography className={styles.intelReasonLine}>
                  {formatI18n(t('event_hub.why_fans_pick'), { team: teamADisplay })} {intel.whyFansPickTeamA}
                </Typography>
              )}
              {intel.whyFansPickTeamB && (
                <Typography className={styles.intelReasonLine}>
                  {formatI18n(t('event_hub.why_fans_pick'), { team: teamBDisplay })} {intel.whyFansPickTeamB}
                </Typography>
              )}
              {intel.upsetWatch && (
                <Typography className={styles.intelUpsetLine}>{intel.upsetWatch}</Typography>
              )}

              <Typography className={styles.intelDisclaimer}>{t('event_hub.intel_disclaimer')}</Typography>
            </>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};
