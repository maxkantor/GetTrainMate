import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { WcLoadingSpinner } from '@/components/worldCupHub/WcLoadingSpinner';
import { useQuery } from '@tanstack/react-query';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useI18n } from '@/hooks/useI18n';
import { WcShell } from '@/components/worldCupHub/v2/WcShell';
import {
  sportsEventLayerService,
  WORLD_CUP_EVENT_ID,
} from '@/services/sportsEventLayerService';
import { computeStandingsFromMatches, hubRefetchIntervalMs } from '@/utils/eventMatchUtils';
import { trackSportsEventAnalytics } from '@/utils/analytics';

export const EventHubPage: React.FC<{ eventId?: string }> = ({ eventId = WORLD_CUP_EVENT_ID }) => {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthContext();

  const { data: hub, isLoading, isError } = useQuery({
    queryKey: ['event-hub', eventId],
    queryFn: () => sportsEventLayerService.getHubSnapshot(eventId),
    staleTime: 0,
    refetchInterval: (query) => hubRefetchIntervalMs(query.state.data?.matches),
    refetchOnWindowFocus: true,
    retry: 1,
  });

  React.useEffect(() => {
    if (!hub) return;
    trackSportsEventAnalytics('event_page_view', {
      eventId: hub.config.eventId,
      eventLabel: hub.config.label,
      sport: hub.config.sport,
      sourcePage: '/world-cup',
    });
  }, [hub]);

  if (isLoading) {
    return <WcLoadingSpinner label={t('common.loading')} />;
  }

  if (isError || !hub || !hub.effectivelyEnabled) {
    return <Navigate to="/" replace />;
  }

  return (
    <WcShell
      key={locale}
      eventId={eventId}
      hub={hub}
      isAuthenticated={isAuthenticated}
      onFindFans={(teamId) => navigate(`/app/discover?intent=watch&event=${eventId}&team=${teamId}`)}
      onFindNearby={(matchId) => navigate(`/app/discover?intent=watch&event=${eventId}&match=${matchId}`)}
      onTeamPage={(teamId) => navigate(`/world-cup/team/${teamId}`)}
    />
  );
};
