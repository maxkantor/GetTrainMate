import { useQuery } from '@tanstack/react-query';
import { featureFlagsService } from '@/services/featureFlagsService';
import { sportsEventLayerService, WORLD_CUP_EVENT_ID } from '@/services/sportsEventLayerService';

export function useWorldCupHubNav() {
  const { data: flags } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => featureFlagsService.getFlags(),
    staleTime: 60_000,
  });

  const { data: event } = useQuery({
    queryKey: ['world-cup-nav-event'],
    queryFn: () => sportsEventLayerService.getEvent(WORLD_CUP_EVENT_ID),
    enabled: featureFlagsService.isFeatureEnabled(flags, 'sports_event_layer'),
    staleTime: 60_000,
    retry: false,
  });

  const now = Date.now();
  const inDateRange =
    !!event?.startDate &&
    !!event?.endDate &&
    now >= new Date(event.startDate).getTime() &&
    now <= new Date(event.endDate).getTime();

  const showNav =
    featureFlagsService.isFeatureEnabled(flags, 'sports_event_layer') &&
    !!event?.enabled &&
    (inDateRange || event.showAnytime === true) &&
    event.navbarVisible !== false;

  const hubRoute = event?.hubRoute || '/world-cup';

  return { showNav, hubRoute, event };
}
