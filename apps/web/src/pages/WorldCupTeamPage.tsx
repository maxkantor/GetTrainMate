import React from 'react';
import { Link as RouterLink, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Chip, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useI18n } from '@/hooks/useI18n';
import { useWcDisplay } from '@/hooks/useWcDisplay';
import { CountryFlag } from '@/components/worldCupHub/CountryFlag';
import { WcCinematicBackdrop } from '@/components/worldCupHub/v2/WcCinematicBackdrop';
import { WcMatchCard } from '@/components/worldCupHub/v2/WcMatchCard';
import { WcAuthGateModal } from '@/components/worldCupHub/WcAuthGateModal';
import {
  sportsEventLayerService,
  WORLD_CUP_EVENT_ID,
} from '@/services/sportsEventLayerService';
import styles from '@/pages/WorldCupV2.module.css';

export const WorldCupTeamPage: React.FC = () => {
  const { teamId = '' } = useParams<{ teamId: string }>();
  const { t, locale } = useI18n();
  const { teamName, groupLabel } = useWcDisplay();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthContext();
  const [authOpen, setAuthOpen] = React.useState(false);
  const eventId = WORLD_CUP_EVENT_ID;

  const { data: hub, isLoading, isError } = useQuery({
    queryKey: ['event-hub', eventId],
    queryFn: () => sportsEventLayerService.getHubSnapshot(eventId),
    retry: 1,
  });

  const { data: teamStats = [] } = useQuery({
    queryKey: ['team-stats', eventId],
    queryFn: () => sportsEventLayerService.getTeamStats(eventId),
    enabled: Boolean(hub),
  });

  const { data: opinions = [] } = useQuery({
    queryKey: ['fan-wall', eventId],
    queryFn: () => sportsEventLayerService.getTrendingComments(eventId, 'recent'),
    enabled: Boolean(hub),
  });

  if (isLoading) {
    return <Box className={styles.shell} sx={{ py: 8, textAlign: 'center' }}>{t('common.loading')}</Box>;
  }
  if (isError || !hub?.effectivelyEnabled) return <Navigate to="/" replace />;

  const team = hub.teams.find((tm) => tm.teamId === teamId);
  if (!team) return <Navigate to="/world-cup" replace />;

  const stats = teamStats.find((s) => s.teamId === teamId);
  const group = hub.groups.find((g) => g.groupId === team.groupId);
  const teamMatches = hub.matches.filter((m) => m.teamAId === teamId || m.teamBId === teamId);
  const upcoming = teamMatches.filter((m) => m.status === 'Scheduled' || m.status === 'Live');
  const fanPosts = opinions.filter((o) => teamMatches.some((m) => m.matchId === o.threadId)).slice(0, 8);

  const displayName = teamName(team.teamId, team.name);

  return (
    <Box className={styles.shell} key={locale} sx={{ '--wc-accent': hub.config.themeColor || '#6366f1' } as React.CSSProperties}>
      <WcCinematicBackdrop />
      <Box className={styles.body} sx={{ pt: 2, position: 'relative', zIndex: 1 }}>
        <Button component={RouterLink} to="/world-cup#groups" size="small" sx={{ mb: 2, color: 'rgba(255,255,255,0.6)' }}>
          ← {t('event_hub.back_to_hub')}
        </Button>

        <Box className={styles.teamHero}>
          <Box className={styles.teamHeroFlagWrap}>
            <CountryFlag teamId={team.teamId} flagEmoji={team.flagEmoji} size={80} alt={displayName} className={styles.teamHeroFlag} />
          </Box>
          <Box>
            <Typography className={styles.teamHeroName}>{displayName}</Typography>
            <Typography className={styles.teamHeroMeta}>
              {groupLabel(team.groupId, group?.label) ?? t('event_hub.group_tbd')} · {team.points} {t('event_hub.col_pts')}
            </Typography>
            {stats && (
              <Typography className={styles.teamHeroMeta}>
                {stats.fanCount} {t('event_hub.fans')} · {stats.predictionsCount} {t('event_hub.picks')}
              </Typography>
            )}
          </Box>
        </Box>

        <Box className={styles.teamPageGrid}>
          <Box className={styles.overviewBlock}>
            <Typography sx={{ fontWeight: 800, mb: 1 }}>{t('event_hub.team_stats')}</Typography>
            <Box className={styles.pulseItem}><span>{t('event_hub.col_played')}</span><span className={styles.pulseVal}>{team.played}</span></Box>
            <Box className={styles.pulseItem}>
              <span>{t('event_hub.col_wins_abbr')} / {t('event_hub.col_draws_abbr')} / {t('event_hub.col_losses_abbr')}</span>
              <span className={styles.pulseVal}>{team.wins} / {team.draws} / {team.losses}</span>
            </Box>
            <Box className={styles.pulseItem}><span>{t('event_hub.col_goals')}</span><span className={styles.pulseVal}>{team.goalsFor}:{team.goalsAgainst}</span></Box>
            <Box className={styles.pulseItem}><span>{t('event_hub.col_pts')}</span><span className={styles.pulseVal}>{team.points}</span></Box>
          </Box>

          <Box className={styles.overviewBlock}>
            <Typography sx={{ fontWeight: 800, mb: 1 }}>{t('event_hub.find_fans_title')}</Typography>
            <Typography sx={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.55)', mb: 1.5 }}>
              {t('event_hub.team_find_fans').replace('{team}', displayName)}
            </Typography>
            <Button
              variant="contained"
              className={styles.ctaPrimary}
              onClick={() => {
                if (!isAuthenticated) { setAuthOpen(true); return; }
                navigate(`/app/discover?intent=watch&event=${eventId}&team=${teamId}`);
              }}
            >
              {t('event_hub.connect')}
            </Button>
          </Box>
        </Box>

        <Typography className={styles.sectionTitle} sx={{ mt: 2 }}>{t('event_hub.upcoming_matches')}</Typography>
        {upcoming.length === 0 ? (
          <Box className={styles.emptyPremium}>
            <Typography className={styles.emptyDesc}>{t('event_hub.matches_coming_soon_desc')}</Typography>
          </Box>
        ) : (
          <Box className={styles.matchGrid}>
            {upcoming.map((m) => (
              <WcMatchCard
                key={m.matchId}
                eventId={eventId}
                match={m}
                isAuthenticated={isAuthenticated}
                onAuthRequired={() => setAuthOpen(true)}
              />
            ))}
          </Box>
        )}

        <Typography className={styles.sectionTitle} sx={{ mt: 2 }}>{t('event_hub.fan_feed')}</Typography>
        {fanPosts.length === 0 ? (
          <Box className={styles.emptyPremium}>
            <Typography className={styles.emptyDesc}>{t('event_hub.opinions_empty')}</Typography>
          </Box>
        ) : (
          <Box className={styles.fanWall}>
            {fanPosts.map((o) => (
              <Box key={o.commentKey} className={styles.fanPost}>
                <Box className={styles.fanAvatar}>{(o.userDisplayName?.[0] ?? 'F').toUpperCase()}</Box>
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{o.userDisplayName ?? t('event_hub.fan')}</Typography>
                  <Typography className={styles.fanBody}>{o.body}</Typography>
                  <Chip size="small" label={new Date(o.createdAt).toLocaleDateString()} sx={{ mt: 0.5 }} />
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>
      <WcAuthGateModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </Box>
  );
};
