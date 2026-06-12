import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { authService } from '@/services/authService';
import { API_BASE_URL } from '@/config/api';
import { useChatPresence } from '@/contexts/ChatPresenceContext';

const INTERVAL_MS = 2 * 60 * 1000;

/** Marks the user as active so SES chat digests are suppressed; includes focused thread for email suppression. */
export function useActivityHeartbeat() {
  const { user } = useAuthContext();
  const location = useLocation();
  const isApp = location.pathname.startsWith('/app');
  const { activeChatThreadId } = useChatPresence();

  useEffect(() => {
    if (!user || !isApp) return;

    const ping = async () => {
      const token = await authService.getJWT();
      if (!token) return;
      try {
        await fetch(`${API_BASE_URL}/api/me/activity`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            activeThreadId: activeChatThreadId ?? undefined,
            path: location.pathname + location.search,
          }),
        });
      } catch {
        /* offline / CORS — ignore */
      }
    };

    void ping();
    const id = window.setInterval(() => void ping(), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [user, isApp, activeChatThreadId, location.pathname, location.search]);
}
