import React, { useState } from 'react';
import { Box, Collapse, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import { useWcDisplay } from '@/hooks/useWcDisplay';
import type { EventMatch, MostPopularPrediction } from '@/services/sportsEventLayerService';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import { WcTeamLabel } from '@/components/worldCupHub/WcTeamLabel';
import styles from '@/pages/WorldCupV2.module.css';

const MIN_COMMUNITY = 10;

type Props = {
  eventId: string;
  match: EventMatch;
  enabled?: boolean;
};

function PopularPredictionLine({
  match,
  popular,
}: {
  match: EventMatch;
  popular: MostPopularPrediction;
}) {
  const { t } = useI18n();
  const { teamName } = useWcDisplay();

  if (popular.isDraw && popular.scoreA != null && popular.scoreB != null) {
    return (
      <Typography className={styles.quickInsightValue}>
        {popular.scoreA}–{popular.scoreB} {t('event_hub.pick_draw')}
      </Typography>
    );
  }

  if (popular.scoreA != null && popular.scoreB != null) {
    const winnerId =
      popular.winnerTeamId
      ?? (popular.scoreA > popular.scoreB ? match.teamAId : match.teamBId);
    const loserId = winnerId === match.teamAId ? match.teamBId : match.teamAId;
    const winScore = Math.max(popular.scoreA, popular.scoreB);
    const loseScore = Math.min(popular.scoreA, popular.scoreB);

    return (
      <Box className={styles.quickInsightPopular}>
        <WcTeamLabel
          teamId={winnerId}
          fallbackName={winnerId === match.teamAId ? match.teamAName : match.teamBName}
          flagEmoji={winnerId === match.teamAId ? match.teamAFlag : match.teamBFlag}
          size={16}
        />
        <span className={styles.quickInsightScore}>{winScore}–{loseScore}</span>
        <WcTeamLabel
          teamId={loserId}
          fallbackName={loserId === match.teamAId ? match.teamAName : match.teamBName}
          flagEmoji={loserId === match.teamAId ? match.teamAFlag : match.teamBFlag}
          size={16}
        />
      </Box>
    );
  }

  if (popular.isDraw) {
    return <Typography className={styles.quickInsightValue}>{t('event_hub.pick_draw')}</Typography>;
  }

  if (popular.winnerTeamId) {
    return (
      <WcTeamLabel
        teamId={popular.winnerTeamId}
        fallbackName={
          popular.winnerTeamId === match.teamAId ? match.teamAName : match.teamBName
        }
        flagEmoji={
          popular.winnerTeamId === match.teamAId ? match.teamAFlag : match.teamBFlag
        }
        size={16}
      />
    );
  }

  return null;
}

export const WcQuickInsight: React.FC<Props> = ({ eventId, match, enabled = true }) => {
  const { t } = useI18n();
  const { teamName } = useWcDisplay();
  const [open, setOpen] = useState(false);

  const { data: insight } = useQuery({
    queryKey: ['match-intelligence', eventId, match.matchId],
    queryFn: () => sportsEventLayerService.getMatchIntelligence(eventId, match.matchId),
    enabled: enabled && open,
    staleTime: 45_000,
  });

  if (!enabled) return null;

  const total = insight?.totalPredictions ?? 0;
  const hasCommunity = total >= MIN_COMMUNITY;
  const pctA = insight?.communityPicks.find((o) => o.teamId === match.teamAId)?.percent ?? 0;
  const pctB = insight?.communityPicks.find((o) => o.teamId === match.teamBId)?.percent ?? 0;
  const pctDraw = insight?.communityPicks.find((o) => o.outcomeType === 'draw')?.percent ?? 0;

  return (
    <Box className={styles.quickInsightWrap}>
      <button type="button" className={styles.quickInsightToggle} onClick={() => setOpen((v) => !v)}>
        <span className={styles.quickInsightToggleIcon}>💡</span>
        <span>{t('event_hub.quick_insight')}</span>
        <span className={styles.intelChevron}>{open ? '▾' : '▸'}</span>
      </button>

      <Collapse in={open}>
        <Box className={styles.quickInsightPanel}>
          {!insight ? (
            <Typography className={styles.intelMuted}>{t('common.loading')}</Typography>
          ) : (
            <>
              {(insight.teamAFifaRank || insight.teamBFifaRank) && (
                <Box className={styles.quickInsightBlock}>
                  <Typography className={styles.quickInsightLabel}>
                    🏆 {t('event_hub.intel_fifa_rank')}
                  </Typography>
                  {insight.teamAFifaRank && (
                    <Typography className={styles.quickInsightValue}>
                      {teamName(match.teamAId, match.teamAName)} #{insight.teamAFifaRank}
                    </Typography>
                  )}
                  {insight.teamBFifaRank && (
                    <Typography className={styles.quickInsightValue}>
                      {teamName(match.teamBId, match.teamBName)} #{insight.teamBFifaRank}
                    </Typography>
                  )}
                </Box>
              )}

              <Box className={styles.quickInsightBlock}>
                <Typography className={styles.quickInsightLabel}>
                  👥 {t('event_hub.community_picks')}
                </Typography>
                {hasCommunity ? (
                  <>
                    <Typography className={styles.quickInsightValue}>
                      {pctA}% {teamName(match.teamAId, match.teamAName)}
                    </Typography>
                    <Typography className={styles.quickInsightValue}>
                      {pctDraw}% {t('event_hub.pick_draw')}
                    </Typography>
                    <Typography className={styles.quickInsightValue}>
                      {pctB}% {teamName(match.teamBId, match.teamBName)}
                    </Typography>
                  </>
                ) : (
                  <Typography className={styles.quickInsightMuted}>
                    {t('event_hub.community_picks_not_enough')}
                  </Typography>
                )}
              </Box>

              {hasCommunity && insight.mostPopular && (
                <Box className={styles.quickInsightBlock}>
                  <Typography className={styles.quickInsightLabel}>
                    🔥 {t('event_hub.most_popular_prediction')}
                  </Typography>
                  <PopularPredictionLine match={match} popular={insight.mostPopular} />
                </Box>
              )}
            </>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};
