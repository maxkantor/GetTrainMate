import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { CountryFlag } from '@/components/worldCupHub/CountryFlag';
import { TeamExploreCard } from '@/components/worldCupHub/TeamExploreCard';
import { useI18n } from '@/hooks/useI18n';
import { useWcDisplay } from '@/hooks/useWcDisplay';
import { formatI18n } from '@/i18n';
import type { EventGroup, EventTeam } from '@/services/sportsEventLayerService';
import { computeStandingsFromMatches, mergeOfficialResultsIntoMatches } from '@/utils/eventMatchUtils';
import type { WcHubProps } from './wcTypes';
import styles from '@/pages/WorldCupV2.module.css';

type Props = Pick<WcHubProps, 'hub' | 'onTeamPage'>;

const GroupTable: React.FC<{
  teams: EventTeam[];
  liveTeamIds: Set<string>;
  onTeamPage: (id: string) => void;
}> = ({ teams, liveTeamIds, onTeamPage }) => {
  const { t } = useI18n();
  const { teamName } = useWcDisplay();
  const sorted = [...teams].sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference);

  return (
    <table className={styles.standingsTable}>
      <thead>
        <tr>
          <th>{t('event_hub.col_team')}</th>
          <th>{t('event_hub.col_played_abbr')}</th>
          <th>{t('event_hub.col_wins_abbr')}</th>
          <th>{t('event_hub.col_draws_abbr')}</th>
          <th>{t('event_hub.col_losses_abbr')}</th>
          <th>{t('event_hub.col_goals')}</th>
          <th>{t('event_hub.col_pts')}</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((team) => {
          const displayName = teamName(team.teamId, team.name);
          return (
            <tr key={team.teamId}>
              <td>
                <button
                  type="button"
                  className={styles.teamCell}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
                  onClick={() => onTeamPage(team.teamId)}
                >
                  <CountryFlag teamId={team.teamId} flagEmoji={team.flagEmoji} size={24} alt={displayName} />
                  {displayName}
                </button>
              </td>
              <td>{team.played}</td>
              <td>{team.wins}</td>
              <td>{team.draws}</td>
              <td>{team.losses}</td>
              <td>{team.goalsFor}:{team.goalsAgainst}</td>
              <td className={styles.ptsCell}>
                {team.points}
                {liveTeamIds.has(team.teamId.toLowerCase()) && (
                  <span className={styles.livePtsBadge}>{t('event_hub.status_live')}</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

const GroupCards: React.FC<{ teams: EventTeam[]; liveTeamIds: Set<string> }> = ({ teams, liveTeamIds }) => {
  const { t } = useI18n();
  const { teamName } = useWcDisplay();
  const sorted = [...teams].sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference);

  return (
    <>
      {sorted.map((team) => {
        const displayName = teamName(team.teamId, team.name);
        const standingLine = formatI18n(t('event_hub.card_standing_line'), {
          played: team.played,
          pAbbr: t('event_hub.col_played_abbr'),
          wins: team.wins,
          wAbbr: t('event_hub.col_wins_abbr'),
          draws: team.draws,
          dAbbr: t('event_hub.col_draws_abbr'),
          losses: team.losses,
          lAbbr: t('event_hub.col_losses_abbr'),
          gf: team.goalsFor,
          ga: team.goalsAgainst,
        });
        return (
          <Box key={team.teamId} className={styles.cardStandingRow}>
            <Box className={styles.teamCell}>
              <CountryFlag teamId={team.teamId} flagEmoji={team.flagEmoji} size={28} alt={displayName} />
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.88rem' }}>{displayName}</Typography>
                <Typography className={styles.cardStandingStats}>{standingLine}</Typography>
              </Box>
            </Box>
            <Typography className={styles.ptsCell}>
              {team.points} {t('event_hub.points_suffix')}
              {liveTeamIds.has(team.teamId.toLowerCase()) && (
                <span className={styles.livePtsBadge}> {t('event_hub.status_live')}</span>
              )}
            </Typography>
          </Box>
        );
      })}
    </>
  );
};

export const WcGroupsTab: React.FC<Props> = ({ hub, onTeamPage }) => {
  const { t } = useI18n();
  const { teamName, groupLabel } = useWcDisplay();
  const [view, setView] = useState<'table' | 'card'>('table');
  const { groups, teams: rawTeams, matches, settings } = hub;
  const mergedMatches = mergeOfficialResultsIntoMatches(matches, rawTeams);
  const teams = computeStandingsFromMatches(rawTeams, matches);
  const liveTeamIds = new Set(
    mergedMatches
      .filter((m) => m.status === 'Live' && m.groupId)
      .flatMap((m) => [m.teamAId.toLowerCase(), m.teamBId.toLowerCase()]),
  );
  const enabled = settings.standingsEnabled;
  const published = settings.standingsPublished;
  const hasData = groups.length > 0;
  const groupedTeams = teams.filter((tm) => tm.groupId);
  const canShowStandings = hasData && groupedTeams.length > 0 && (!enabled || published);

  if (!enabled && !hasData && teams.length === 0) {
    return (
      <Box className={styles.tabPanel}>
        <Typography className={styles.sectionTitle}>{t('event_hub.groups_title')}</Typography>
        <Box className={styles.emptyPremium}>
          <Typography className={styles.emptyTitle}>{t('event_hub.standings_coming_soon')}</Typography>
          <Typography className={styles.emptyDesc}>{t('event_hub.standings_admin_only')}</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box className={styles.tabPanel}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography className={styles.sectionTitle} sx={{ mb: 0 }}>{t('event_hub.groups_title')}</Typography>
        {hasData && (
          <Box className={styles.viewToggle}>
            <button type="button" className={`${styles.subTab} ${view === 'table' ? styles.subTabActive : ''}`} onClick={() => setView('table')}>
              {t('event_hub.view_table')}
            </button>
            <button type="button" className={`${styles.subTab} ${view === 'card' ? styles.subTabActive : ''}`} onClick={() => setView('card')}>
              {t('event_hub.view_card')}
            </button>
          </Box>
        )}
      </Box>
      <Typography className={styles.sectionLead}>{t('event_hub.groups_lead')}</Typography>

      {!canShowStandings ? (
        <Box className={styles.emptyPremium}>
          <Typography className={styles.emptyTitle}>{t('event_hub.standings_not_published')}</Typography>
          <Typography className={styles.emptyDesc}>{t('event_hub.standings_wait')}</Typography>
        </Box>
      ) : (
        <Box className={styles.groupsGrid}>
          {groups
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((g: EventGroup) => {
              const groupTeams = teams.filter((tm) => tm.groupId === g.groupId);
              return (
                <Box key={g.groupId} className={styles.groupCard}>
                  <Typography className={styles.groupLabel}>
                    {groupLabel(g.groupId, g.label)}
                  </Typography>
                  {view === 'table' ? (
                    <GroupTable teams={groupTeams} liveTeamIds={liveTeamIds} onTeamPage={onTeamPage} />
                  ) : (
                    <GroupCards teams={groupTeams} liveTeamIds={liveTeamIds} />
                  )}
                </Box>
              );
            })}
        </Box>
      )}

      {teams.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>{t('event_hub.explore_teams')}</Typography>
          <Box className={styles.teamExploreGrid}>
            {teams.map((team) => (
              <TeamExploreCard
                key={team.teamId}
                teamId={team.teamId}
                name={teamName(team.teamId, team.name)}
                flagEmoji={team.flagEmoji}
                onClick={() => onTeamPage(team.teamId)}
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};
