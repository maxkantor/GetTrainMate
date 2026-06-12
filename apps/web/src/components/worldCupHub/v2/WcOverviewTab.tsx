import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { CountryFlag } from '@/components/worldCupHub/CountryFlag';
import { useI18n } from '@/hooks/useI18n';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import { categorizeMatches } from '@/utils/eventMatchUtils';
import type { WcHubProps } from './wcTypes';
import { WcMatchCard } from './WcMatchCard';
import styles from '@/pages/WorldCupV2.module.css';

type Props = Pick<WcHubProps, 'eventId' | 'hub' | 'isAuthenticated' | 'onAuthRequired' | 'onTabChange' | 'onTeamPage'>;

export const WcOverviewTab: React.FC<Props> = ({
  eventId, hub, isAuthenticated, onAuthRequired, onTabChange, onTeamPage,
}) => {
  const { t } = useI18n();
  const { today, upcoming } = categorizeMatches(hub.matches);
  const featured = [...today, ...upcoming]
    .filter((m) => m.isFeatured || today.includes(m))
    .slice(0, 3);

  const { data: pulse } = useQuery({
    queryKey: ['community-pulse', eventId],
    queryFn: () => sportsEventLayerService.getCommunityPulse(eventId),
    refetchInterval: 45_000,
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ['leaderboard', eventId, 'predictors'],
    queryFn: () => sportsEventLayerService.getLeaderboard(eventId, 'predictors'),
    staleTime: 60_000,
  });

  const previewGroups = hub.groups.slice(0, 4);

  return (
    <Box className={styles.tabPanel}>
      <Typography className={styles.sectionTitle}>{t('event_hub.overview_title')}</Typography>
      <Typography className={styles.sectionLead}>{t('event_hub.overview_lead')}</Typography>

      {featured.length > 0 && (
        <>
          <Typography sx={{ fontWeight: 800, mb: 1 }}>{t('event_hub.featured_matches')}</Typography>
          <Box className={styles.matchGrid} sx={{ mb: 2 }}>
            {featured.map((m) => (
              <WcMatchCard
                key={m.matchId}
                eventId={eventId}
                match={m}
                isAuthenticated={isAuthenticated}
                onAuthRequired={onAuthRequired}
                showPredict
              />
            ))}
          </Box>
          <Button className={styles.ctaSecondary} variant="outlined" onClick={() => onTabChange('matches')}>
            {t('event_hub.view_all_matches')}
          </Button>
        </>
      )}

      <Box className={styles.overviewGrid} sx={{ mt: 2 }}>
        <Box className={styles.overviewBlock}>
          <Typography sx={{ fontWeight: 800, mb: 1 }}>{t('event_hub.community_pulse')}</Typography>
          {!pulse || pulse.totalPredictions === 0 ? (
            <Typography sx={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.5)' }}>{t('event_hub.pulse_empty')}</Typography>
          ) : (
            <>
              {pulse.mostPickedTeamName && (
                <Box className={styles.pulseItem}>
                  <span>{t('event_hub.most_picked_today')}</span>
                  <span className={styles.pulseVal}>{pulse.mostPickedTeamName}</span>
                </Box>
              )}
              {pulse.mostDiscussedMatchLabel && (
                <Box className={styles.pulseItem}>
                  <span>{t('event_hub.most_discussed')}</span>
                  <span className={styles.pulseVal}>{pulse.mostDiscussedMatchLabel}</span>
                </Box>
              )}
              {pulse.latestTakes.slice(0, 3).map((take, i) => (
                <Box key={i} className={styles.pulseItem}>
                  <span>{take.userDisplayName ?? t('event_hub.fan')}</span>
                  <span className={styles.pulseVal} style={{ maxWidth: '50%', textAlign: 'right', fontSize: '0.82rem' }}>
                    {take.body.slice(0, 60)}{take.body.length > 60 ? '…' : ''}
                  </span>
                </Box>
              ))}
            </>
          )}
        </Box>

        <Box className={styles.overviewBlock}>
          <Typography sx={{ fontWeight: 800, mb: 1 }}>{t('event_hub.lb_overall')}</Typography>
          {leaderboard.length === 0 ? (
            <Typography sx={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.5)' }}>{t('event_hub.no_leaderboard')}</Typography>
          ) : (
            leaderboard.slice(0, 5).map((e, i) => (
              <Box key={e.userId} className={styles.pulseItem}>
                <span>#{i + 1} {e.displayName ?? t('event_hub.fan')}</span>
                <span className={styles.pulseVal}>{e.score} pts</span>
              </Box>
            ))
          )}
          <Button size="small" sx={{ mt: 1 }} onClick={() => onTabChange('leaderboard')}>
            {t('event_hub.view_leaderboard')}
          </Button>
        </Box>
      </Box>

      {previewGroups.length > 0 && hub.settings.standingsPublished && (
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontWeight: 800, mb: 1 }}>{t('event_hub.groups_preview')}</Typography>
          <Box className={styles.groupsGrid}>
            {previewGroups.map((g) => (
              <Box key={g.groupId} className={styles.groupCard}>
                <Typography className={styles.groupLabel}>{g.label}</Typography>
                {hub.teams
                  .filter((tm) => tm.groupId === g.groupId)
                  .sort((a, b) => b.points - a.points)
                  .slice(0, 4)
                  .map((team) => (
                    <button
                      key={team.teamId}
                      type="button"
                      className={styles.cardStandingRow}
                      style={{ width: '100%', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                      onClick={() => onTeamPage(team.teamId)}
                    >
                      <span className={styles.teamCell}>
                        <CountryFlag teamId={team.teamId} flagEmoji={team.flagEmoji} size={22} alt={team.name} />
                        {team.name}
                      </span>
                      <span className={styles.ptsCell}>{team.points}</span>
                    </button>
                  ))}
              </Box>
            ))}
          </Box>
          <Button variant="outlined" className={styles.ctaSecondary} sx={{ mt: 1.5 }} onClick={() => onTabChange('groups')}>
            {t('event_hub.cta_view_groups')}
          </Button>
        </Box>
      )}
    </Box>
  );
};
