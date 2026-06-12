import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { CountryFlag } from '@/components/worldCupHub/CountryFlag';
import { TeamExploreCard } from '@/components/worldCupHub/TeamExploreCard';
import { useI18n } from '@/hooks/useI18n';
import type { EventGroup, EventTeam } from '@/services/sportsEventLayerService';
import type { WcHubProps } from './wcTypes';
import styles from '@/pages/WorldCupV2.module.css';

type Props = Pick<WcHubProps, 'hub' | 'onTeamPage'>;

const GroupTable: React.FC<{ teams: EventTeam[]; onTeamPage: (id: string) => void }> = ({ teams, onTeamPage }) => {
  const { t } = useI18n();
  const sorted = [...teams].sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference);

  return (
    <table className={styles.standingsTable}>
      <thead>
        <tr>
          <th>{t('event_hub.col_team')}</th>
          <th>P</th>
          <th>W</th>
          <th>D</th>
          <th>L</th>
          <th>{t('event_hub.col_goals')}</th>
          <th>{t('event_hub.col_pts')}</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((team) => (
          <tr key={team.teamId}>
            <td>
              <button
                type="button"
                className={styles.teamCell}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
                onClick={() => onTeamPage(team.teamId)}
              >
                <CountryFlag teamId={team.teamId} flagEmoji={team.flagEmoji} size={24} alt={team.name} />
                {team.name}
              </button>
            </td>
            <td>{team.played}</td>
            <td>{team.wins}</td>
            <td>{team.draws}</td>
            <td>{team.losses}</td>
            <td>{team.goalsFor}:{team.goalsAgainst}</td>
            <td className={styles.ptsCell}>{team.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const GroupCards: React.FC<{ teams: EventTeam[] }> = ({ teams }) => {
  const sorted = [...teams].sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference);

  return (
    <>
      {sorted.map((team, i) => (
        <Box key={team.teamId} className={styles.cardStandingRow}>
          <Box className={styles.teamCell}>
            <CountryFlag teamId={team.teamId} flagEmoji={team.flagEmoji} size={28} alt={team.name} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.88rem' }}>{team.name}</Typography>
              <Typography className={styles.cardStandingStats}>
                {team.played}P · {team.wins}W {team.draws}D {team.losses}L · {team.goalsFor}:{team.goalsAgainst}
              </Typography>
            </Box>
          </Box>
          <Typography className={styles.ptsCell}>{team.points} pts</Typography>
        </Box>
      ))}
    </>
  );
};

export const WcGroupsTab: React.FC<Props> = ({ hub, onTeamPage }) => {
  const { t } = useI18n();
  const [view, setView] = useState<'table' | 'card'>('table');
  const { groups, teams, settings } = hub;
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
                  <Typography className={styles.groupLabel}>{g.label}</Typography>
                  {view === 'table' ? (
                    <GroupTable teams={groupTeams} onTeamPage={onTeamPage} />
                  ) : (
                    <GroupCards teams={groupTeams} />
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
                name={team.name}
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
