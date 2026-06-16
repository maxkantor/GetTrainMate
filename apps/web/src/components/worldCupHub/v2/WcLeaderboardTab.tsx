import React, { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import {
  sportsEventLayerService,
  type EventHubSnapshot,
  type EventLeaderboardEntry,
} from '@/services/sportsEventLayerService';
import { CountryFlag } from '@/components/worldCupHub/CountryFlag';
import { WcSectionTitle } from '@/components/worldCupHub/WcSectionTitle';
import { WcEmptyState } from '@/components/worldCupHub/WcEmptyState';
import { WcTrophyLogo } from '@/components/worldCupHub/WcTrophyLogo';
import { WcFanBadge } from '@/components/worldCupHub/WcFanBadge';
import { resolveWcFanBadge } from '@/utils/wcFanBadges';
import type { WcHubProps } from './wcTypes';
import styles from '@/pages/WorldCupV2.module.css';
import { useQuery } from '@tanstack/react-query';

type Props = Pick<WcHubProps, 'eventId'> & { hub: EventHubSnapshot };
type LbType = 'predictors' | 'active' | 'shared';

const PODIUM_TROPHY: Array<'gold' | 'silver' | 'bronze'> = ['gold', 'silver', 'bronze'];

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
  const [lbType, setLbType] = useState<LbType>('predictors');

  const { data: entries = [] } = useQuery({
    queryKey: ['leaderboard', eventId, lbType],
    queryFn: () => sportsEventLayerService.getLeaderboard(eventId, lbType),
    refetchInterval: 60_000,
  });

  const name = (e: EventLeaderboardEntry) => e.displayName?.trim() || t('event_hub.fan');
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  const renderFanBadge = (e: EventLeaderboardEntry, rank: number) => {
    const kind = resolveWcFanBadge(e.predictionsCount, rank);
    return kind ? <WcFanBadge kind={kind} /> : null;
  };

  return (
    <Box className={styles.tabPanel}>
      <WcSectionTitle>{t('event_hub.leaderboard_title')}</WcSectionTitle>
      <Typography className={styles.sectionLead}>{t('event_hub.leaderboard_lead_v2')}</Typography>

      <Box className={styles.subTabs} sx={{ mb: 2 }}>
        <Button size="small" className={lbType === 'predictors' ? styles.subTabActive : styles.subTab} onClick={() => setLbType('predictors')}>
          {t('event_hub.lb_predictors')}
        </Button>
        <Button size="small" className={lbType === 'active' ? styles.subTabActive : styles.subTab} onClick={() => setLbType('active')}>
          {t('event_hub.lb_active')}
        </Button>
        <Button size="small" className={lbType === 'shared' ? styles.subTabActive : styles.subTab} onClick={() => setLbType('shared')}>
          {t('event_hub.lb_shared')}
        </Button>
      </Box>

      {entries.length === 0 ? (
        <WcEmptyState title={t('event_hub.no_leaderboard')} />
      ) : (
        <>
          {lbType === 'predictors' && (
            <Box className={styles.lbPodium}>
              {podium.map((e, i) => (
                <Box
                  key={e.userId}
                  className={`${styles.lbPodiumCard} ${i === 0 ? styles.lbPodiumGold : i === 1 ? styles.lbPodiumSilver : styles.lbPodiumBronze} ${e.userId === myUserId ? styles.lbMine : ''}`}
                >
                  <WcTrophyLogo size="md" podium={PODIUM_TROPHY[i]} className={styles.lbMedal} />
                  <Box className={styles.lbAvatar}>{initials(name(e))}</Box>
                  <Typography className={styles.lbPodiumName}>
                    {name(e)}
                    {e.favoriteTeamId && (
                      <CountryFlag teamId={e.favoriteTeamId} flagEmoji={e.favoriteTeamFlag} size={16} className={styles.lbTeamBadge} />
                    )}
                    {e.userId === myUserId && <span className={styles.lbYouTag}>{t('event_hub.lb_you')}</span>}
                  </Typography>
                  {renderFanBadge(e, i + 1)}
                  <Typography className={styles.lbPodiumPts}>
                    {e.score} <small>{t('event_hub.col_points').toLowerCase()}</small>
                  </Typography>
                  <Typography className={styles.lbPodiumStat}>
                    {e.correctCount}/{e.predictionsCount} · {accuracy(e)}%
                    {(e.exactScoreCount ?? 0) > 0 && ` · ${e.exactScoreCount} exact`}
                    {(e.currentStreak ?? 0) > 0 && ` · 🔥${e.currentStreak}`}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {rest.length > 0 && (
            <Box className={styles.lbTable}>
              <Box className={`${styles.lbRow} ${styles.lbHead}`}>
                <span>{t('event_hub.col_rank')}</span>
                <span>{t('event_hub.col_username')}</span>
                {lbType === 'predictors' && <span>{t('event_hub.col_exact')}</span>}
                {lbType === 'predictors' && <span>{t('event_hub.col_streak')}</span>}
                <span>{lbType === 'predictors' ? t('event_hub.col_correct') : lbType === 'active' ? t('event_hub.posts') : t('event_hub.share')}</span>
                <span>{t('event_hub.col_points')}</span>
              </Box>
              {(lbType === 'predictors' ? rest : entries).map((e, i) => (
                <Box key={e.userId} className={`${styles.lbRow} ${e.userId === myUserId ? styles.lbMine : ''}`}>
                  <span className={styles.lbRank}>#{lbType === 'predictors' ? i + 4 : i + 1}</span>
                  <span className={styles.lbNameCell}>
                    <Box className={styles.lbAvatarSm}>{initials(name(e))}</Box>
                    <span className={styles.lbName}>{name(e)}</span>
                    {e.favoriteTeamId && (
                      <CountryFlag teamId={e.favoriteTeamId} flagEmoji={e.favoriteTeamFlag} size={14} />
                    )}
                    {e.userId === myUserId && <span className={styles.lbYouTag}>{t('event_hub.lb_you')}</span>}
                  </span>
                  {lbType === 'predictors' && <span className={styles.lbStat}>{e.exactScoreCount ?? 0}</span>}
                  {lbType === 'predictors' && <span className={styles.lbStat}>{e.currentStreak ?? 0}</span>}
                  <span className={styles.lbStat}>
                    {lbType === 'predictors' ? `${e.correctCount}/${e.predictionsCount}` : lbType === 'active' ? e.commentCount : e.shareCount}
                  </span>
                  <span className={styles.lbPts}>{lbType === 'predictors' ? e.score : lbType === 'active' ? e.commentCount + e.predictionsCount : e.shareCount}</span>
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
