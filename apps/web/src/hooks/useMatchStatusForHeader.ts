import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthContext } from '@/hooks/useAuthContext';
import { getDailyLikeCount } from '@/utils/dailySwipeTracker';
import { matchQueryKeys } from '@/lib/queryKeys';
import { fetchMutualMatchRows } from '@/services/matchExploreQueries';

export interface MatchStatusForHeader {
  /** Total mutual matches (for dashboard tiles, etc.). */
  totalMatches: number;
  /** Likes/swipes recorded today (client). */
  likesToday: number;
  loading: boolean;
}

export function useMatchStatusForHeader(enabled: boolean): MatchStatusForHeader {
  const { user } = useAuthContext();
  const userSub = user?.sub;
  const [likesToday, setLikesToday] = useState(0);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: matchQueryKeys.mutualMatches(userSub ?? ''),
    queryFn: () => fetchMutualMatchRows(userSub!),
    enabled: enabled && !!userSub,
  });

  useEffect(() => {
    setLikesToday(getDailyLikeCount(userSub));
  }, [userSub]);

  const refreshLikes = useCallback(() => {
    setLikesToday(getDailyLikeCount(userSub));
  }, [userSub]);

  useEffect(() => {
    if (!enabled) return;
    const onDaily = () => refreshLikes();
    window.addEventListener('gtm-daily-swipe', onDaily);
    return () => window.removeEventListener('gtm-daily-swipe', onDaily);
  }, [enabled, refreshLikes]);

  const totalMatches = rows.length;

  return {
    totalMatches,
    likesToday,
    loading: isLoading,
  };
}
