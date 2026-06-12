import React from 'react';
import { Box, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { sportsEventLayerService, type EventLeaderboardEntry } from '@/services/sportsEventLayerService';
import type { WcHubProps } from './wcTypes';
import styles from '@/pages/WorldCupV2.module.css';

type Props = Pick<WcHubProps, 'eventId'>;

const MEDALS = ['🥇', '🥈', '🥉'];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

const accuracy = (e: EventLeaderboardEntry) =>
  e.predictionsCount > 0 ? Math.round((e.correctCount / e.predictionsCount) * 100) : 0;

export const WcLeaderboardTab: React.FC<Props> = ({ eventId }) => {
  const { t } = useI18n();
  const { user } = useAuthContext();
  const myUserId = user?.sub;

  const { data: entries = [] } = useQuery({
    queryKey: ['leaderboard', eventId, 'predictors'],
    queryFn: () => sportsEventLayerService.getLeaderboard(eventId, 'predictors'),
    refetchInterval: 60_000,
  });

  const name = (e: EventLeaderboardEntry) => e.displayName?.trim() || t('event_hub.fan');
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <Box className={styles.tabPanel}>
      <Typography className={styles.sectionTitle}>{t('event_hub.leaderboard_title')}</Typography>
      <Typography className={styles.sectionLead}>{t('event_hub.leaderboard_lead')}</Typography>

      {entries.length === 0 ? (
        <Box className={styles.emptyPremium}>
          <Typography className={styles.emptyTitle}>{t('event_hub.no_leaderboard')}</Typography>
        </Box>
      ) : (
        <>
          <Box className={styles.lbPodium}>
            {podium.map((e, i) => (
              <Box
                key={e.userId}
                className={`${styles.lbPodiumCard} ${i === 0 ? styles.lbPodiumGold : i === 1 ? styles.lbPodiumSilver : styles.lbPodiumBronze} ${e.userId === myUserId ? styles.lbMine : ''}`}
              >
                <span className={styles.lbMedal}>{MEDALS[i]}</span>
                <Box className={styles.lbAvatar}>{initials(name(e))}</Box>
                <Typography className={styles.lbPodiumName}>
                  {name(e)}
                  {e.userId === myUserId && <span className={styles.lbYouTag}>{t('event_hub.lb_you')}</span>}
                </Typography>
                <Typography className={styles.lbPodiumPts}>
                  {e.score} <small>{t('event_hub.col_points').toLowerCase()}</small>
                </Typography>
                <Typography className={styles.lbPodiumStat}>
                  {e.correctCount}/{e.predictionsCount} · {accuracy(e)}%
                </Typography>
              </Box>
            ))}
          </Box>

          {rest.length > 0 && (
            <Box className={styles.lbTable}>
              <Box className={`${styles.lbRow} ${styles.lbHead}`}>
                <span>{t('event_hub.col_rank')}</span>
                <span>{t('event_hub.col_username')}</span>
                <span>{t('event_hub.col_accuracy')}</span>
                <span>{t('event_hub.col_correct')}</span>
                <span>{t('event_hub.col_points')}</span>
              </Box>
              {rest.map((e, i) => (
                <Box key={e.userId} className={`${styles.lbRow} ${e.userId === myUserId ? styles.lbMine : ''}`}>
                  <span className={styles.lbRank}>#{i + 4}</span>
                  <span className={styles.lbNameCell}>
                    <Box className={styles.lbAvatarSm}>{initials(name(e))}</Box>
                    <span className={styles.lbName}>{name(e)}</span>
                    {e.userId === myUserId && <span className={styles.lbYouTag}>{t('event_hub.lb_you')}</span>}
                  </span>
                  <span className={styles.lbStat}>{accuracy(e)}%</span>
                  <span className={styles.lbStat}>{e.correctCount} / {e.predictionsCount}</span>
                  <span className={styles.lbPts}>{e.score}</span>
                </Box>
              ))}
            </Box>
          )}
        </>
      )}
      <Typography sx={{ mt: 1.5, fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
        {t('event_hub.lb_disclaimer')}
      </Typography>
    </Box>
  );
};
