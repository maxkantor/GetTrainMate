import { useState, useEffect, useCallback } from 'react';
import { authService } from '@/services/authService';
import { matchService } from '@/services/matchService';
import { isGraphQLEnabled, graphqlListMyMatches } from '@/services/graphqlService';
import { getDailyLikeCount } from '@/utils/dailySwipeTracker';

export interface MatchStatusForHeader {
  /** Mutual matches where chat is not unlocked yet (best signal when API provides it). */
  waitingForAction: number;
  /** Total mutual matches (REST fallback when unlock flags unavailable). */
  totalMatches: number;
  /** Likes/swipes recorded today (client). */
  likesToday: number;
  loading: boolean;
}

export function useMatchStatusForHeader(enabled: boolean): MatchStatusForHeader {
  const [waitingForAction, setWaitingForAction] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [likesToday, setLikesToday] = useState(() => getDailyLikeCount());
  const [loading, setLoading] = useState(false);

  const refreshLikes = useCallback(() => {
    setLikesToday(getDailyLikeCount());
  }, []);

  const loadMatches = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      if (isGraphQLEnabled) {
        const items = (await graphqlListMyMatches()) as Array<{ unlockedByMe?: boolean }>;
        setTotalMatches(items.length);
        const waiting = items.filter((m) => !m.unlockedByMe).length;
        setWaitingForAction(waiting);
      } else {
        const token = await authService.getJWT();
        if (!token) {
          setTotalMatches(0);
          setWaitingForAction(0);
          return;
        }
        const data = await matchService.getMyMatches(token);
        const list = Array.isArray(data) ? data : [];
        setTotalMatches(list.length);
        setWaitingForAction(list.length);
      }
    } catch {
      setTotalMatches(0);
      setWaitingForAction(0);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    loadMatches();
    const id = window.setInterval(loadMatches, 90_000);
    return () => window.clearInterval(id);
  }, [enabled, loadMatches]);

  useEffect(() => {
    if (!enabled) return;
    const onDaily = () => refreshLikes();
    window.addEventListener('gtm-daily-swipe', onDaily);
    return () => window.removeEventListener('gtm-daily-swipe', onDaily);
  }, [enabled, refreshLikes]);

  return { waitingForAction, totalMatches, likesToday, loading };
}
