import React, { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuthContext } from '@/hooks/useAuthContext';
import { authService } from '@/services/authService';
import { meService, type MeResponse } from '@/services/meService';
import type { UserProfile } from '@/services/profileService';
import { isGraphQLEnabled, graphqlGetMe, graphqlEnsureFreeStartCredits, GraphQLApiError } from '@/services/graphqlService';
import { getErrorMessage } from '@/utils/apiErrorHandler';
import { syncAuthScopeToCurrentUser } from '@/utils/authScopeReset';
import { handleSessionInvalid } from '@/utils/sessionInvalid';

interface MeContextType {
  me: MeResponse | null;
  loading: boolean;
  error: string | null;
  refreshMe: () => Promise<void>;
}

export const MeContext = createContext<MeContextType>({
  me: null,
  loading: true,
  error: null,
  refreshMe: async () => {},
});

interface MeProviderProps {
  children: React.ReactNode;
}

/** GraphQL getMe may omit REST-only profile fields (e.g. Events waitlist); overlay from /api/me. */
function mergeEventsProfileFields(
  gqlProfile: UserProfile | null,
  restProfile: UserProfile | null
): UserProfile | null {
  if (!gqlProfile && !restProfile) return null;
  if (!restProfile) return gqlProfile;
  if (!gqlProfile) return restProfile;
  return {
    ...gqlProfile,
    eventsWaitlistEnabled: restProfile.eventsWaitlistEnabled ?? gqlProfile.eventsWaitlistEnabled,
    eventsCityInterest: restProfile.eventsCityInterest ?? gqlProfile.eventsCityInterest,
    eventsInterestTypes:
      restProfile.eventsInterestTypes && restProfile.eventsInterestTypes.length > 0
        ? restProfile.eventsInterestTypes
        : gqlProfile.eventsInterestTypes,
    eventsJoinedWaitlistAt: restProfile.eventsJoinedWaitlistAt ?? gqlProfile.eventsJoinedWaitlistAt,
    eventsNotifiedAt: restProfile.eventsNotifiedAt ?? gqlProfile.eventsNotifiedAt,
    eventsCitySuggestion: restProfile.eventsCitySuggestion ?? gqlProfile.eventsCitySuggestion,
    eventsCitySuggestionAt: restProfile.eventsCitySuggestionAt ?? gqlProfile.eventsCitySuggestionAt,
  };
}

function mapGraphQLMeToResponse(g: Awaited<ReturnType<typeof graphqlGetMe>>): MeResponse {
  const profile = g.profile
    ? (() => {
        const modesRaw = ((g.profile as { modes?: string[] }).modes ?? []).filter(Boolean);
        const modes = (modesRaw.length ? modesRaw : ['TRAIN']) as ('TRAIN' | 'VIBE' | 'DATE')[];
        const modeSingle = (modes[0] ?? 'TRAIN') as 'TRAIN' | 'VIBE' | 'DATE';
        return {
        userId: (g.profile as { userId?: string }).userId ?? '',
        email: '',
        name: (g.profile as { displayName?: string }).displayName ?? '',
        city: (g.profile as { city?: string }).city,
        bio: (g.profile as { bio?: string }).bio,
        sportTags: ((g.profile as { sports?: string[] }).sports as string[]) ?? [],
        level: (g.profile as { level?: string }).level,
        goals: ((g.profile as { goals?: string[] }).goals as string[]) ?? [],
        availabilitySchedule: ((g.profile as { schedule?: unknown[] }).schedule as { days: string[]; timeStart: string; timeEnd: string }[]) ?? [],
        mode: modeSingle,
        modes,
        photoUrls: (g.profile as { avatarUrl?: string }).avatarUrl ? [(g.profile as { avatarUrl: string }).avatarUrl] : [],
        isComplete: g.isProfileComplete,
        updatedAt: (g.profile as { updatedAt?: string }).updatedAt,
      };
      })()
    : null;
  return {
    user: { id: g.user.id, email: g.user.email ?? '' },
    profile,
    credits: g.credits,
    lifetimeEarned: (g as { lifetimeEarned?: number }).lifetimeEarned ?? g.credits,
    unlimitedDiscovery: (g as { unlimitedDiscovery?: boolean }).unlimitedDiscovery ?? false,
    isProfileComplete: g.isProfileComplete,
    isAdmin: g.user.isAdmin ?? false,
  };
}

export const MeProvider: React.FC<MeProviderProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuthContext();
  const userSub = user?.sub;
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && userSub) {
      syncAuthScopeToCurrentUser(userSub);
    } else if (!isAuthenticated) {
      syncAuthScopeToCurrentUser(undefined);
    }
  }, [isAuthenticated, userSub]);

  const fetchMe = useCallback(async (silent = false) => {
    if (!isAuthenticated) {
      setMe(null);
      setLoading(false);
      return;
    }
    if (!userSub) {
      setMe(null);
      setLoading(true);
      return;
    }
    try {
      if (!silent) setLoading(true);
      setError(null);
      const token = await authService.getJWT();
      if (!token) {
        setMe(null);
        setLoading(false);
        if (import.meta.env.DEV) console.log('[MeContext] No token, profile not loaded');
        return;
      }

      if (isGraphQLEnabled) {
        try {
          const data = await graphqlGetMe();
          let mapped = mapGraphQLMeToResponse(data);
          try {
            const rest = await meService.getMe(token);
            mapped = {
              ...mapped,
              profile: mergeEventsProfileFields(mapped.profile, rest.profile),
              boostExpiresAtUtc: rest.boostExpiresAtUtc ?? mapped.boostExpiresAtUtc,
              revealLikesUnlocked: rest.revealLikesUnlocked ?? mapped.revealLikesUnlocked,
            };
          } catch {
            /* REST /me optional merge */
          }
          setMe(mapped);
          if (import.meta.env.DEV) {
            console.log('[MeContext] Profile loaded (GraphQL):', (data as { user?: { id?: string } }).user?.id, 'onboarding required:', !(data as { isProfileComplete?: boolean }).isProfileComplete);
          }
          graphqlEnsureFreeStartCredits().catch(() => {});
          return;
        } catch (graphqlErr) {
          // AppSync can fail for auth quirks, schema, or resolver errors while REST /api/me still works.
          // Always try REST when GraphQL getMe fails (do not only fall back on 401).
          if (token) {
            if (import.meta.env.DEV) console.warn('[MeContext] GraphQL getMe failed, trying REST /api/me:', graphqlErr);
            try {
              const data = await meService.getMe(token);
              setMe(data);
              if (import.meta.env.DEV) console.log('[MeContext] Profile loaded (REST fallback):', data.user?.id);
              graphqlEnsureFreeStartCredits().catch(() => {});
              return;
            } catch (restErr) {
              if (import.meta.env.DEV) console.warn('[MeContext] REST fallback also failed:', restErr);
            }
          }
          throw graphqlErr;
        }
      }

      const data = await meService.getMe(token);
      setMe(data);
      if (import.meta.env.DEV) {
        console.log('[MeContext] Profile loaded:', data.user?.id, 'onboarding required:', !data.isProfileComplete);
      }
    } catch (err: unknown) {
      let status: number | undefined;
      if (err instanceof GraphQLApiError) status = err.status;
      else if (axios.isAxiosError(err)) status = err.response?.status;
      else
        status =
          (err as { response?: { status?: number }; status?: number }).response?.status ?? (err as { status?: number }).status;
      const graphqlErrors = err instanceof GraphQLApiError ? err.graphqlErrors : undefined;
      if (status === 401) {
        void handleSessionInvalid();
        return;
      }
      if (import.meta.env.DEV) {
        console.error('[MeContext] /me failed:', status ?? 'no status', graphqlErrors ?? (err instanceof Error ? err.message : err));
        if (status == null && err != null && typeof err === 'object') {
          const keys = Object.keys(err as object).filter((k) => !k.startsWith('_'));
          console.error('[MeContext] raw error shape (for debugging):', keys, err instanceof Error ? err.message : (err as { message?: string }).message);
        }
      }
      const message = getErrorMessage(err);
      setError(message);
      setMe(null);
      if (import.meta.env.DEV) console.log('[MeContext] Profile fetch failed (not redirecting to onboarding):', message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, userSub]);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const refreshMe = useCallback(async () => {
    await fetchMe(true);
  }, [fetchMe]);

  const value: MeContextType = {
    me,
    loading,
    error,
    refreshMe,
  };

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
};
