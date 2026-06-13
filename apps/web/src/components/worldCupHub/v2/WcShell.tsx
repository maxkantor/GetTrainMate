import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box } from '@mui/material';
import { WcNav } from './WcNav';
import { WcHeroV2 } from './WcHeroV2';
import { WcOverviewTab } from './WcOverviewTab';
import { WcGroupsTab } from './WcGroupsTab';
import { WcMatchesTab } from './WcMatchesTab';
import { WcPredictionsTab } from './WcPredictionsTab';
import { WcLeaderboardTab } from './WcLeaderboardTab';
import { WcFansTab } from './WcFansTab';
import { WcMyPicksTab } from './WcMyPicksTab';
import { WcAuthGateModal } from '@/components/worldCupHub/WcAuthGateModal';
import { WcCinematicBackdrop } from './WcCinematicBackdrop';
import type { EventHubSnapshot } from '@/services/sportsEventLayerService';
import { parseWcTab, type WcTab } from './wcTypes';
import { computeStandingsFromMatches } from '@/utils/eventMatchUtils';
import styles from '@/pages/WorldCupV2.module.css';

type Props = {
  eventId: string;
  hub: EventHubSnapshot;
  isAuthenticated: boolean;
  onFindFans: (teamId: string) => void;
  onFindNearby: (matchId: string) => void;
  onTeamPage: (teamId: string) => void;
};

export const WcShell: React.FC<Props> = ({
  eventId, hub, isAuthenticated, onFindFans, onFindNearby, onTeamPage,
}) => {
  const [tab, setTab] = useState<WcTab>(() => parseWcTab(window.location.hash));
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const goTab = useCallback((next: WcTab) => {
    setTab(next);
    window.location.hash = next;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onHash = () => setTab(parseWcTab(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const liveHub = useMemo<EventHubSnapshot>(() => ({
    ...hub,
    teams: computeStandingsFromMatches(hub.teams, hub.matches),
  }), [hub]);

  const hubProps = {
    eventId,
    hub: liveHub,
    isAuthenticated,
    onAuthRequired: () => setAuthModalOpen(true),
    onTabChange: goTab,
    onFindFans,
    onFindNearby,
    onTeamPage,
  };

  return (
    <Box
      className={styles.shell}
      sx={{ '--wc-accent': liveHub.config.themeColor || '#6366f1' } as React.CSSProperties}
    >
      <WcCinematicBackdrop />
      {tab === 'overview' && (
        <WcHeroV2
          eventId={eventId}
          onPredict={() => goTab('predictions')}
          onViewGroups={() => goTab('groups')}
        />
      )}
      <WcNav active={tab} onChange={goTab} />

      <Box className={styles.body}>
        {tab === 'overview' && <WcOverviewTab {...hubProps} />}
        {tab === 'groups' && <WcGroupsTab hub={liveHub} onTeamPage={onTeamPage} />}
        {tab === 'matches' && (
          <WcMatchesTab
            eventId={eventId}
            hub={liveHub}
            isAuthenticated={isAuthenticated}
            onAuthRequired={hubProps.onAuthRequired}
          />
        )}
        {tab === 'predictions' && (
          <WcPredictionsTab
            eventId={eventId}
            hub={liveHub}
            isAuthenticated={isAuthenticated}
            onAuthRequired={hubProps.onAuthRequired}
          />
        )}
        {tab === 'leaderboard' && <WcLeaderboardTab eventId={eventId} />}
        {tab === 'fans' && <WcFansTab {...hubProps} />}
        {tab === 'my-picks' && (
          <WcMyPicksTab
            eventId={eventId}
            hub={liveHub}
            isAuthenticated={isAuthenticated}
            onAuthRequired={hubProps.onAuthRequired}
          />
        )}
      </Box>

      <WcAuthGateModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </Box>
  );
};
