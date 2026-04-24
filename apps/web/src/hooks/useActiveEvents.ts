import { useQuery } from '@tanstack/react-query';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';

export function useActiveEvents() {
  return useQuery({
    queryKey: ['active-events-layer'],
    queryFn: () => sportsEventLayerService.getActiveEvents(),
    staleTime: 30_000,
  });
}
