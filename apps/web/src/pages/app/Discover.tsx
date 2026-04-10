import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Box, Button, Typography, Alert, Snackbar, useMediaQuery, useTheme } from '@mui/material';
import { ProfileCardSkeleton } from '@/components/ui/Skeleton';
import { FiltersDrawer, DiscoverFilters } from '@/components/discover/FiltersDrawer';
import { OnboardingModal, shouldShowOnboardingModal } from '@/components/onboarding/OnboardingModal';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { matchService, MatchFeedItem } from '@/services/matchService';
import { profileService } from '@/services/profileService';
import { authService } from '@/services/authService';
import {
  isGraphQLEnabled,
  graphqlDiscoverCandidates,
  graphqlLikeUser,
  graphqlPassUser,
  graphqlSeedDemoData,
} from '@/services/graphqlService';
import { handleApiError, getErrorMessage, isNetworkError } from '@/utils/apiErrorHandler';
import {
  getMultiplePhotoUrls,
  placeholderPhotoUrl,
  fallbackPlaceholderPhotoUrl,
  inferGenderFromName,
  isLikelyStockDiscoverPhoto,
  NO_PHOTO_PLACEHOLDER,
} from '@/utils/profilePhotos';
import { IMAGE_BUCKET_BASE } from '@/config/media';
import { getLocationFromIp, FALLBACK_LOCATION } from '@/services/locationService';
import { isDummyNearbyProfile } from '@/data/nearbyDummyProfiles';
import { DiscoverLayout } from './discover/DiscoverLayout';
import { ProfileCard } from './discover/ProfileCard';
import { MatchPanel } from './discover/MatchPanel';
import { ActionBar } from './discover/ActionBar';
import { FiltersButton } from './discover/FiltersButton';
import { DiscoverProfileDrawer } from './discover/DiscoverProfileDrawer';
import { incrementDailyLike, getDailyLikeCount, canSendLikeWithDailyCap } from '@/utils/dailySwipeTracker';
import { DAILY_LIKE_LIMIT } from '@/config/appLimits';
import { getDiscoverPrimaryCta } from '@/config/modes';
import { MatchCelebrationOverlay, MatchCelebrationState } from '@/components/discover/MatchCelebrationOverlay';
import { Modal } from '@/components/ui/Modal';
import { getMatchInsight, isInsufficientCreditsError, getAiErrorMessage } from '@/services/aiService';
import { loadPremiumCatalog, PREMIUM_ACTION } from '@/config/premiumCatalog';
import { trackPremiumAction } from '@/utils/analytics';
import type { MatchInsightResponse } from '@/types/ai';
import { useI18n } from '@/hooks/useI18n';
import { formatI18n } from '@/i18n';
import styles from './Discover.module.css';
import { matchQueryKeys } from '@/lib/queryKeys';

function scheduleSummary(schedule: { days?: string[]; timeStart?: string; timeEnd?: string }[] | undefined): string {
  if (!schedule?.length) return '';
  return schedule.map((s) => `${(s.days ?? []).join('/')} ${s.timeStart ?? ''}-${s.timeEnd ?? ''}`).join('; ');
}

const BACKEND_DUMMY_PREFIX = 'dummy-user-';
const LOCAL_DEMO_PREFIX = 'local-near-';

/** Real users first, then backend seed dummies, then local demo cards. */
function sortDiscoverFeed<T extends { userId: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const order = (id: string) =>
      id.startsWith(LOCAL_DEMO_PREFIX) ? 2 : id.startsWith(BACKEND_DUMMY_PREFIX) ? 1 : 0;
    return order(a.userId) - order(b.userId);
  });
}

/** Never surface the signed-in user as a discoverable card (defensive; backend should exclude too). */
function excludeDiscoverSelf<T extends { userId: string }>(items: T[], selfId?: string): T[] {
  if (!selfId) return items;
  return items.filter((c) => c.userId !== selfId);
}

function toPhotoUrl(
  avatarUrl: string | undefined,
  userId: string,
  displayName?: string
): string {
  if (avatarUrl && /randomuser\.me/i.test(avatarUrl)) return '';
  if (avatarUrl?.startsWith('http://') || avatarUrl?.startsWith('https://')) return avatarUrl;
  if (avatarUrl) return `${IMAGE_BUCKET_BASE}/${avatarUrl.replace(/^\//, '')}`;
  const gender = displayName ? inferGenderFromName(displayName) : 'male';
  return placeholderPhotoUrl(userId, 0, gender);
}

type GraphqlDiscoverCandidate = {
  userId: string;
  displayName: string;
  city?: string;
  bio?: string;
  sports?: string[];
  avatarUrl?: string;
  compatibilityScore?: number;
  level?: string;
  modes?: string[];
  intentMatchTier?: string;
  matchPreviewReasons?: string[];
  lockedInsightReasons?: string[];
  seenBefore?: boolean;
};

function mapGraphqlDiscoverToFeedItems(items: GraphqlDiscoverCandidate[]): MatchFeedItem[] {
  return items.map((c) => {
    const url = toPhotoUrl(c.avatarUrl, c.userId, c.displayName);
    const photoUrls = getMultiplePhotoUrls([url], c.userId, 4, c.displayName);
    const modes = c.modes?.length ? c.modes : ['TRAIN'];
    return {
      userId: c.userId,
      name: c.displayName,
      city: c.city,
      bio: c.bio ?? undefined,
      sportTags: c.sports ?? [],
      level: c.level,
      photoUrls,
      compatibilityScore: c.compatibilityScore ?? 50,
      commonSports: c.sports ?? [],
      mode: modes[0],
      modes,
      intentMatchTier: c.intentMatchTier,
      matchPreviewReasons: c.matchPreviewReasons,
      lockedInsightReasons: c.lockedInsightReasons,
      seenBefore: !!c.seenBefore,
    };
  });
}

/** When GraphQL omits photos or returns placeholders, pull presigned URLs from REST (same CRM as Admin). */
async function hydrateDiscoverFeedFromRest(items: MatchFeedItem[], token: string | null): Promise<MatchFeedItem[]> {
  if (!token) return items;
  return Promise.all(
    items.map(async (row) => {
      const primary = row.photoUrls?.[0];
      if (!isLikelyStockDiscoverPhoto(primary, row.userId)) return row;
      try {
        const p = await profileService.getProfile(token, row.userId);
        const fromRest = (p.photoUrls ?? []).filter(Boolean);
        if (fromRest.length === 0) return row;
        return {
          ...row,
          photoUrls: getMultiplePhotoUrls(fromRest, row.userId, 4, row.name),
        };
      } catch {
        return row;
      }
    })
  );
}

function newAthletesTodayCount(seed: string): number {
  const d = new Date().toISOString().slice(0, 10);
  let h = 0;
  for (let i = 0; i < d.length; i++) {
    h = (h * 31 + d.charCodeAt(i) + (seed.charCodeAt(i % Math.max(seed.length, 1)) | 0)) % 1000;
  }
  return 7 + (h % 18);
}

function countActiveFilters(f: DiscoverFilters): number {
  let n = 0;
  if (f.distance !== '30 miles') n++;
  n += f.goals.length;
  n += f.schedule.length;
  if (f.experienceLevel !== 'Any') n++;
  return n;
}

export const DiscoverPage: React.FC = () => {
  const { t } = useI18n();
  const { user, logout } = useAuthContext();
  const { me, refreshMe } = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const discoverLoadGenRef = useRef(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [feed, setFeed] = useState<MatchFeedItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const interestAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [matchCelebration, setMatchCelebration] = useState<MatchCelebrationState | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dailyLimitModalOpen, setDailyLimitModalOpen] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [photoErrorForIndex, setPhotoErrorForIndex] = useState<number | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [userLocationLabel, setUserLocationLabel] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [filters, setFilters] = useState<DiscoverFilters>({
    distance: '30 miles',
    goals: [],
    schedule: [],
    experienceLevel: 'Any',
  });
  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false);
  const [photoFallbackUrls, setPhotoFallbackUrls] = useState<Record<string, string>>({});
  const [insightMap, setInsightMap] = useState<Record<string, MatchInsightResponse>>({});
  const [loadingInsightFor, setLoadingInsightFor] = useState<string | null>(null);
  const [aiInsightCost, setAiInsightCost] = useState(2);
  const [skipUndoOpen, setSkipUndoOpen] = useState(false);
  const [lastSkippedProfile, setLastSkippedProfile] = useState<MatchFeedItem | null>(null);

  /** Demo seed must not appear for normal production users (isolates fake profiles from real flows). */
  const allowDemoProfileSeed = import.meta.env.DEV || Boolean(me?.isAdmin);

  const matchOverlayOpenRef = useRef(false);
  const openDailyLimitModal = useCallback(() => {
    setDailyLimitModalOpen(true);
  }, []);
  useEffect(() => {
    if (!user?.sub) return;
    const now = Date.now();
    localStorage.setItem(`gtm_discover_last_visit_${user.sub}`, String(now));
  }, [me?.user?.id, user?.sub]);

  useEffect(() => {
    if (!loading && shouldShowOnboardingModal(me?.isProfileComplete ?? true)) {
      setOnboardingModalOpen(true);
    }
  }, [loading, me?.isProfileComplete]);

  useEffect(() => {
    setPhotoErrorForIndex(null);
    setCurrentPhotoIndex(0);
  }, [currentIndex]);

  useEffect(() => {
    return () => {
      if (interestAdvanceTimerRef.current) clearTimeout(interestAdvanceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cat = await loadPremiumCatalog();
        if (!cancelled) setAiInsightCost(cat.costs[PREMIUM_ACTION.deeperMatchInsight] ?? 2);
      } catch {
        if (!cancelled) setAiInsightCost(2);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadFeed = async (isRetryAfter401 = false) => {
    const loadId = ++discoverLoadGenRef.current;
    const stale = () => loadId !== discoverLoadGenRef.current;
    try {
      setLoading(true);
      setError('');
      if (isGraphQLEnabled) {
        const [result, locationRaw, token] = await Promise.all([
          graphqlDiscoverCandidates(50),
          getLocationFromIp().catch(() => null),
          authService.getJWT(isRetryAfter401),
        ]);
        const items = (result.items || []) as GraphqlDiscoverCandidate[];
        const feedFromApi = mapGraphqlDiscoverToFeedItems(items);
        const sorted = sortDiscoverFeed(excludeDiscoverSelf(feedFromApi, user?.sub));
        const hydrated = await hydrateDiscoverFeedFromRest(sorted, token);
        if (stale()) return;
        const location = locationRaw ?? FALLBACK_LOCATION;
        setFeed(hydrated);
        setUserLocationLabel(location.label);
        setCurrentIndex(0);
        setPhotoErrorForIndex(null);
        setPhotoFallbackUrls({});
      } else {
        const token = await authService.getJWT(isRetryAfter401);
        if (!token) {
          if (!stale()) {
            setError(t('app_messages.not_authenticated'));
            setLoading(false);
          }
          return;
        }
        const [feedFromApi, locationRaw] = await Promise.all([
          matchService.getDiscoveryFeed(token, 50),
          getLocationFromIp().catch(() => null),
        ]);
        const feedWithPhotos: MatchFeedItem[] = feedFromApi.map((c) => ({
          ...c,
          photoUrls: getMultiplePhotoUrls(c.photoUrls, c.userId, 4, c.name),
        }));
        if (stale()) return;
        const location = locationRaw ?? FALLBACK_LOCATION;
        setFeed(sortDiscoverFeed(feedWithPhotos));
        setUserLocationLabel(location.label);
        setCurrentIndex(0);
        setPhotoErrorForIndex(null);
        setPhotoFallbackUrls({});
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const apiError = handleApiError(err);

      if (status === 401 && !isRetryAfter401) {
        const freshToken = await authService.getJWT(true);
        if (freshToken || isGraphQLEnabled) {
          try {
            if (isGraphQLEnabled) {
              const [result, locationRaw] = await Promise.all([
                graphqlDiscoverCandidates(50),
                getLocationFromIp().catch(() => null),
              ]);
              const jwt = freshToken ?? (await authService.getJWT(true));
              const items = (result.items || []) as GraphqlDiscoverCandidate[];
              const feedFromApi = mapGraphqlDiscoverToFeedItems(items);
              const sorted = sortDiscoverFeed(excludeDiscoverSelf(feedFromApi, user?.sub));
              const hydrated = await hydrateDiscoverFeedFromRest(sorted, jwt);
              if (stale()) return;
              const location = locationRaw ?? FALLBACK_LOCATION;
              setFeed(hydrated);
              setUserLocationLabel(location.label);
              setCurrentIndex(0);
              setPhotoFallbackUrls({});
            } else {
              const [feedFromApi, locationRaw] = await Promise.all([
                matchService.getDiscoveryFeed(freshToken!, 50),
                getLocationFromIp().catch(() => null),
              ]);
              const feedWithPhotos = feedFromApi.map((c) => ({
                ...c,
                photoUrls: getMultiplePhotoUrls(c.photoUrls, c.userId, 4, c.name),
              }));
              if (stale()) return;
              const location = locationRaw ?? FALLBACK_LOCATION;
              setFeed(sortDiscoverFeed(excludeDiscoverSelf(feedWithPhotos, user?.sub)));
              setUserLocationLabel(location.label);
              setCurrentIndex(0);
              setPhotoErrorForIndex(null);
              setPhotoFallbackUrls({});
            }
            if (!stale()) setLoading(false);
            return;
          } catch {
            // fall through to error
          }
        }
        if (!stale()) {
          setError(t('app_messages.session_expired'));
          setLoading(false);
          await logout();
          navigate('/login', { state: { from: '/app/discover' }, replace: true });
        }
        return;
      }

      if (!stale()) {
        if (isNetworkError(err)) {
          setError(
            'Unable to connect to the API. The backend may not be deployed or CORS is not configured.'
          );
        } else if (status === 401) {
          setError(t('app_messages.auth_required'));
        } else {
          setError(getErrorMessage(err));
        }
      }
    } finally {
      if (loadId === discoverLoadGenRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!user?.sub) {
      setFeed([]);
      setCurrentIndex(0);
      setLoading(false);
      setError('');
      return;
    }
    void loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload discover when the signed-in user changes
  }, [user?.sub]);

  const advanceToNextCard = useCallback(() => {
    if (currentIndex < feed.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setFeed([]);
      setError('');
    }
  }, [currentIndex, feed.length]);

  const handleWantToTrain = useCallback(async () => {
    if (currentIndex >= feed.length) return;

    const currentCard = feed[currentIndex];
    if (isDummyNearbyProfile(currentCard.userId)) {
      setToast(t('discover.preview_profile_hint'));
      if (interestAdvanceTimerRef.current) clearTimeout(interestAdvanceTimerRef.current);
      interestAdvanceTimerRef.current = setTimeout(() => {
        advanceToNextCard();
        interestAdvanceTimerRef.current = null;
      }, 1000);
      return;
    }

    const creditBefore = me?.credits ?? 0;
    if (!canSendLikeWithDailyCap(creditBefore, user?.sub)) {
      setToast(formatI18n(t('app_messages.daily_limit_midnight'), { limit: DAILY_LIKE_LIMIT }));
      openDailyLimitModal();
      return;
    }

    const celebrationPhoto = (() => {
      const urls = getMultiplePhotoUrls(currentCard.photoUrls, currentCard.userId, 4, currentCard.name);
      const g = inferGenderFromName(currentCard.name);
      return urls[0] || placeholderPhotoUrl(currentCard.userId, 0, g);
    })();

    const finishInterestSent = () => {
      setProfileDrawerOpen(false);
      setToast(t('discover.interest_sent'));
      if (interestAdvanceTimerRef.current) clearTimeout(interestAdvanceTimerRef.current);
      interestAdvanceTimerRef.current = setTimeout(() => {
        advanceToNextCard();
        interestAdvanceTimerRef.current = null;
      }, 1000);
    };

    try {
      setLikeLoading(true);
      if (isGraphQLEnabled) {
        const result = await graphqlLikeUser(currentCard.userId);
        if (creditBefore === 0) incrementDailyLike(user?.sub);
        await refreshMe();
        if (user?.sub) {
          void queryClient.invalidateQueries({ queryKey: matchQueryKeys.sentRequests(user.sub) });
          void queryClient.invalidateQueries({ queryKey: matchQueryKeys.mutualMatches(user.sub) });
        }
        if (result.isMatched) {
          setMatchCelebration({
            name: currentCard.name,
            photoUrl: celebrationPhoto,
            matchId: result.matchId,
          });
          return;
        }
        if (getDailyLikeCount(user?.sub) >= DAILY_LIKE_LIMIT && !canSendLikeWithDailyCap(Math.max(0, me?.credits ?? 0), user?.sub)) {
          setToast(formatI18n(t('app_messages.daily_limit'), { limit: DAILY_LIKE_LIMIT }));
          openDailyLimitModal();
        } else {
          finishInterestSent();
        }
      } else {
        let token = await authService.getJWT(true);
        if (!token) {
          setToast(t('app_messages.sign_in_again'));
          return;
        }
        try {
          const result = await matchService.likeUser(token, currentCard.userId);
          if (creditBefore === 0) incrementDailyLike(user?.sub);
          await refreshMe();
          if (user?.sub) {
            void queryClient.invalidateQueries({ queryKey: matchQueryKeys.sentRequests(user.sub) });
            void queryClient.invalidateQueries({ queryKey: matchQueryKeys.mutualMatches(user.sub) });
          }
          if (result.isMatched) {
            setMatchCelebration({
              name: currentCard.name,
              photoUrl: celebrationPhoto,
              matchId: result.matchId,
            });
            return;
          }
          if (getDailyLikeCount(user?.sub) >= DAILY_LIKE_LIMIT && !canSendLikeWithDailyCap(Math.max(0, me?.credits ?? 0), user?.sub)) {
            setToast(formatI18n(t('app_messages.daily_limit'), { limit: DAILY_LIKE_LIMIT }));
            openDailyLimitModal();
          } else {
            finishInterestSent();
          }
        } catch (likeErr: unknown) {
          const status = (likeErr as { response?: { status?: number } })?.response?.status;
          if (status === 401) {
            token = await authService.getJWT(true) ?? '';
            if (token) {
              try {
                const result = await matchService.likeUser(token, currentCard.userId);
                if (creditBefore === 0) incrementDailyLike(user?.sub);
                await refreshMe();
                if (user?.sub) {
                  void queryClient.invalidateQueries({ queryKey: matchQueryKeys.sentRequests(user.sub) });
                  void queryClient.invalidateQueries({ queryKey: matchQueryKeys.mutualMatches(user.sub) });
                }
                if (result.isMatched) {
                  setMatchCelebration({
                    name: currentCard.name,
                    photoUrl: celebrationPhoto,
                    matchId: result.matchId,
                  });
                  return;
                }
                if (getDailyLikeCount(user?.sub) >= DAILY_LIKE_LIMIT && !canSendLikeWithDailyCap(Math.max(0, me?.credits ?? 0), user?.sub)) {
                  setToast(formatI18n(t('app_messages.daily_limit'), { limit: DAILY_LIKE_LIMIT }));
                  openDailyLimitModal();
                } else {
                  finishInterestSent();
                }
                return;
              } catch {
                /* fall through */
              }
            }
            setToast(t('app_messages.session_expired'));
            setLikeLoading(false);
            return;
          }
          throw likeErr;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('INSUFFICIENT_CREDITS') || msg.includes('Insufficient')) {
        setToast(t('app_messages.not_enough_credits'));
      } else {
        const apiError = handleApiError(err);
        if (
          apiError.code === 'INSUFFICIENT_CREDITS' ||
          (err as { response?: { status?: number } })?.response?.status === 402
        ) {
          setToast(apiError.message || t('app_messages.not_enough_credits'));
        } else if (apiError.status === 401 || apiError.isAuthError) {
          setToast(t('app_messages.session_expired'));
        } else {
          setToast(apiError.message || t('app_messages.could_not_send_interest'));
        }
      }
    } finally {
      setLikeLoading(false);
    }
  }, [
    advanceToNextCard,
    currentIndex,
    feed,
    me?.credits,
    openDailyLimitModal,
    refreshMe,
    me,
    user?.sub,
    queryClient,
    t,
    formatI18n,
  ]);

  const handlePass = async () => {
    if (currentIndex >= feed.length) return;

    const currentCard = feed[currentIndex];
    if (isDummyNearbyProfile(currentCard.userId)) {
      setLastSkippedProfile(currentCard);
      setSkipUndoOpen(true);
      const nextFeed = feed.filter((_, idx) => idx !== currentIndex);
      setFeed(nextFeed);
      setCurrentIndex((prev) => Math.max(0, Math.min(prev, nextFeed.length - 1)));
      if (nextFeed.length === 0) setError('');
      return;
    }

    try {
      if (isGraphQLEnabled) {
        await graphqlPassUser(currentCard.userId);
      } else {
        let token = await authService.getJWT(true);
        if (!token) {
          setToast(t('app_messages.sign_in_again'));
          return;
        }
        try {
          await matchService.passUser(token, currentCard.userId);
        } catch (passErr: unknown) {
          const status = (passErr as { response?: { status?: number } })?.response?.status;
          if (status === 401 && (token = await authService.getJWT(true) ?? '')) {
            await matchService.passUser(token, currentCard.userId);
          } else {
            throw passErr;
          }
        }
      }
      if (user?.sub) {
        void queryClient.invalidateQueries({ queryKey: matchQueryKeys.skippedProfiles(user.sub) });
      }
      setLastSkippedProfile(currentCard);
      setSkipUndoOpen(true);
      const nextFeed = feed.filter((_, idx) => idx !== currentIndex);
      setFeed(nextFeed);
      setCurrentIndex((prev) => Math.max(0, Math.min(prev, nextFeed.length - 1)));
      if (nextFeed.length === 0) setError('');
    } catch {
      setToast(t('app_messages.could_not_save_pass'));
    }
  };

  const restoreSkippedProfile = useCallback((profile: MatchFeedItem) => {
    setError('');
    setFeed((prev) => [profile, ...prev.filter((p) => p.userId !== profile.userId)]);
    setCurrentIndex(0);
  }, []);

  const handleUndoSkip = useCallback(async () => {
    if (!lastSkippedProfile) return;
    if (!isGraphQLEnabled) {
      const token = await authService.getJWT(true);
      if (!token) {
        setToast(t('app_messages.sign_in_again'));
        return;
      }
      const result = await matchService.undoPass(token, lastSkippedProfile.userId);
      if (!result.restored) {
        setToast(t('app_messages.could_not_undo_skip'));
        return;
      }
    }
    restoreSkippedProfile(lastSkippedProfile);
    setSkipUndoOpen(false);
  }, [lastSkippedProfile, restoreSkippedProfile]);

  const handleRewindLastSkip = useCallback(async () => {
    if (!lastSkippedProfile || skipUndoOpen) return;
    await handleUndoSkip();
  }, [handleUndoSkip, lastSkippedProfile, skipUndoOpen]);

  const handleViewProfile = () => {
    const currentCard = feed[currentIndex];
    if (currentCard?.userId) {
      setProfileDrawerOpen(true);
    }
  };

  const discoverActionsRef = useRef({
    pass: async () => {},
    interest: async () => {},
    viewProfile: () => {},
  });
  discoverActionsRef.current = {
    pass: handlePass,
    interest: handleWantToTrain,
    viewProfile: handleViewProfile,
  };

  useEffect(() => {
    matchOverlayOpenRef.current = !!matchCelebration;
  }, [matchCelebration]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (matchOverlayOpenRef.current) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        void discoverActionsRef.current.pass();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        void discoverActionsRef.current.interest();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        discoverActionsRef.current.viewProfile();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSeedDemo = async () => {
    if (!allowDemoProfileSeed) {
      setToast(t('app_messages.demo_dev_only'));
      return;
    }
    try {
      setSeeding(true);
      setError('');
      if (isGraphQLEnabled) {
        try {
          await graphqlSeedDemoData();
        } catch {
          /* backend may not support */
        }
        await loadFeed();
      } else {
        const token = await authService.getJWT();
        if (!token) {
          setError(t('app_messages.not_authenticated'));
          return;
        }
        try {
          await matchService.seedDemoProfiles(token);
        } catch {
          /* seed may fail */
        }
        await loadFeed();
      }
    } catch (err: unknown) {
      const apiError = handleApiError(err as Error);
      setError(apiError.message || t('app_messages.failed_load_demo'));
    } finally {
      setSeeding(false);
    }
  };

  const closeMatchCelebration = useCallback(
    (advance: boolean) => {
      setMatchCelebration(null);
      if (advance) advanceToNextCard();
    },
    [advanceToNextCard]
  );

  const handleUnlockAiInsight = useCallback(async () => {
    const card = feed[currentIndex];
    if (!card || !me?.user?.id) return;
    if (isDummyNearbyProfile(card.userId)) return;
    // Use refreshed token to avoid 401 from expired token
    const token = await authService.getJWT(true);
    if (!token) {
      setToast(t('app_messages.sign_in_again'));
      return;
    }
    if ((me?.credits ?? 0) < aiInsightCost) {
      const need = aiInsightCost - (me?.credits ?? 0);
      setToast(
        need === 1
          ? t('credits.need_more_credits_one')
          : formatI18n(t('credits.need_more_credits_many'), { need })
      );
      return;
    }
    setLoadingInsightFor(card.userId);
    const myProfile = me?.profile;
    const request = {
      userId: me.user.id,
      targetUserId: card.userId,
      myName: myProfile?.name,
      myBio: myProfile?.bio,
      mySports: myProfile?.sportTags ?? [],
      myLevel: myProfile?.level,
      myGoals: myProfile?.goals ?? [],
      myScheduleSummary: scheduleSummary(myProfile?.availabilitySchedule),
      otherName: card.name,
      otherBio: card.bio,
      otherSports: card.sportTags ?? [],
      otherLevel: card.level,
      otherGoals: [],
      otherScheduleSummary: undefined,
      compatibilityScore: card.compatibilityScore ?? 50,
    };
    const tryRequest = async (authToken: string) => {
      const result = await getMatchInsight(authToken, request);
      setInsightMap((prev) => ({ ...prev, [card.userId]: result }));
      await refreshMe();
      setToast(t('app_messages.insight_unlocked'));
      trackPremiumAction('deeper_match_insight', 'success');
    };
    try {
      await tryRequest(token);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        const freshToken = await authService.getJWT(true);
        if (freshToken) {
          try {
            await tryRequest(freshToken);
            return;
          } catch {
            /* fall through to auth message */
          }
        }
        setToast(t('app_messages.session_expired'));
        setLoadingInsightFor(null);
        return;
      }
      if (isInsufficientCreditsError(err)) {
        trackPremiumAction('deeper_match_insight', 'insufficient_credits');
        setToast(t('app_messages.not_enough_credits'));
      } else {
        setToast(getAiErrorMessage(err));
      }
    } finally {
      setLoadingInsightFor(null);
    }
  }, [currentIndex, feed, me, aiInsightCost, refreshMe, t]);

  const handlePhotoError = useCallback(() => {
    const currentCard = feed[currentIndex];
    if (!currentCard) return;
    const cardPhotoKey = `${currentCard.userId}-${currentPhotoIndex}`;
    if (photoFallbackUrls[cardPhotoKey]) {
      setPhotoErrorForIndex(currentIndex);
    } else {
      setPhotoFallbackUrls((prev) => ({
        ...prev,
        [cardPhotoKey]: fallbackPlaceholderPhotoUrl(currentCard.userId, currentPhotoIndex),
      }));
    }
  }, [currentIndex, currentPhotoIndex, feed, photoFallbackUrls]);

  if (loading) {
    return (
      <div className={styles.container}>
        <ProfileCardSkeleton />
      </div>
    );
  }

  if (error && feed.length === 0) {
    const isAuthError = error.includes('sign in') || error.includes('Session expired') || error.includes('Authentication');
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Alert severity={error.includes('API') ? 'warning' : 'info'} sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {isAuthError ? (
              <Button
                fullWidth
                variant="contained"
                color="primary"
                onClick={() => {
                  logout();
                  navigate('/login', { state: { from: '/app/discover' }, replace: true });
                }}
              >
                Sign in again
              </Button>
            ) : (
              <Button fullWidth variant="contained" color="primary" onClick={() => loadFeed()}>
                {t('discover.retry')}
              </Button>
            )}
          </Box>
        </div>
      </div>
    );
  }

  if (feed.length === 0 && !loading && !error) {
    return (
      <>
        <div className={styles.container}>
          <div className={styles.emptyState}>
            <Typography variant="h6" gutterBottom>
              {t('discover.caught_up_title')}
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              {t('discover.caught_up_sub')}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center' }}>
              <Button variant="outlined" onClick={() => navigate('/app/profile')}>
                Expand distance / change mode
              </Button>
              <Button variant="outlined" onClick={() => setFiltersOpen(true)}>
                Adjust filters
              </Button>
              <Button variant="outlined" onClick={() => navigate('/app/sent-requests')}>
                Sent requests
              </Button>
              <Button variant="outlined" onClick={() => navigate('/app/matches')}>
                Matches
              </Button>
              <Button variant="contained" onClick={() => loadFeed()}>
                {t('discover.retry')}
              </Button>
            </Box>
            {allowDemoProfileSeed ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center', mt: 2 }}>
                <Button variant="text" size="small" onClick={handleSeedDemo} disabled={seeding}>
                  {seeding ? t('discover.loading') : t('discover.load_demo')}
                </Button>
              </Box>
            ) : null}
          </div>
        </div>
        <FiltersDrawer
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          filters={filters}
          onFiltersChange={setFilters}
          onApply={() => loadFeed()}
          anchor={isMobile ? 'bottom' : 'right'}
        />
        <OnboardingModal open={onboardingModalOpen} onClose={() => setOnboardingModalOpen(false)} />
      </>
    );
  }

  const currentCard = feed[currentIndex];
  const progress = feed.length > 0 ? ((currentIndex + 1) / feed.length) * 100 : 0;
  const photoFailed = photoErrorForIndex === currentIndex;
  const allPhotos = getMultiplePhotoUrls(currentCard.photoUrls, currentCard.userId, 4, currentCard.name);
  const photoIndex = Math.min(currentPhotoIndex, allPhotos.length - 1);
  const primaryPhotoUrl = allPhotos[photoIndex] || NO_PHOTO_PLACEHOLDER;
  const cardPhotoKey = `${currentCard.userId}-${photoIndex}`;
  const fallbackUrl = photoFallbackUrls[cardPhotoKey];
  const displayPhotoUrl = photoFailed ? NO_PHOTO_PLACEHOLDER : fallbackUrl || primaryPhotoUrl;
  const isDummy = isDummyNearbyProfile(currentCard.userId);

  const viewerModeList =
    me?.profile?.modes && me.profile.modes.length > 0
      ? me.profile.modes.map(String)
      : me?.profile?.mode
        ? [me.profile.mode]
        : undefined;
  const { label: primaryCta, icon: primaryCtaIcon } = getDiscoverPrimaryCta(viewerModeList, currentCard.modes);

  const matchReasons = (
    currentCard.matchPreviewReasons?.length
      ? currentCard.matchPreviewReasons
      : [
          ...(currentCard.commonSports?.length
            ? [`${currentCard.commonSports.length} shared activities`]
            : []),
          currentCard.level ? `Similar level (${currentCard.level})` : null,
          currentCard.city ? 'Location in range' : null,
        ].filter(Boolean)
  ) as string[];

  const activeFilterCount = countActiveFilters(filters);
  const newAthletesToday = newAthletesTodayCount(user?.sub ?? me?.user?.id ?? 'guest');

  return (
    <div className={styles.container}>
      <DiscoverLayout
        topBar={
          <>
            <div className={styles.discoverTopCenter}>
              {userLocationLabel && (
                <span className={styles.locationLabel}>Near {userLocationLabel}</span>
              )}
              <span className={styles.newAthletesLine}>
                🔥 {newAthletesToday} new athletes today
              </span>
            </div>
            <FiltersButton
              onClick={() => setFiltersOpen(true)}
              activeCount={activeFilterCount}
            />
          </>
        }
        banner={null}
        headerRow={null}
        progressBar={
          <div className={styles.progressSection}>
            <div className={styles.progressMetaRow}>
              <span className={styles.headerCount}>
                {currentIndex + 1} of {feed.length}
                {isDummy ? ' (near you)' : ''}
              </span>
            </div>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
          </div>
        }
        card={
          <ProfileCard
            profile={currentCard}
            photoUrl={displayPhotoUrl}
            photoIndex={photoIndex}
            allPhotoUrls={allPhotos}
            onPhotoChange={(i) => {
              setCurrentPhotoIndex(i);
              setPhotoErrorForIndex(null);
            }}
            onPhotoError={handlePhotoError}
            onSwipeLeft={handlePass}
            onSwipeRight={handleWantToTrain}
            matched={false}
          />
        }
        panel={
          <MatchPanel
            score={currentCard.compatibilityScore}
            reasons={matchReasons}
            lockedInsightReasons={currentCard.lockedInsightReasons}
            aiMatchInsight={currentCard.aiMatchInsight}
            aiMatchInsightFull={insightMap[currentCard.userId]}
            aiInsightCreditCost={aiInsightCost}
            onUnlockAiInsight={isDummy ? undefined : handleUnlockAiInsight}
            aiInsightLoading={loadingInsightFor === currentCard.userId}
            compact
            collapsible={isMobile}
            defaultCollapsed={isMobile}
          />
        }
        actionBar={
          <>
            <ActionBar
              onPass={handlePass}
              onInterest={handleWantToTrain}
              onViewProfile={handleViewProfile}
              onRewind={handleRewindLastSkip}
              interestLoading={likeLoading}
              canRewind={
                me?.profile?.discoverCanRewindLastSkip !== false &&
                !!lastSkippedProfile &&
                !skipUndoOpen
              }
              primaryCtaLabel={primaryCta}
              primaryCtaIcon={primaryCtaIcon}
            />
          </>
        }
      />

      <FiltersDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onFiltersChange={setFilters}
        onApply={() => loadFeed()}
        anchor={isMobile ? 'bottom' : 'right'}
      />

      <DiscoverProfileDrawer
        open={profileDrawerOpen}
        onClose={() => setProfileDrawerOpen(false)}
        userId={feed[currentIndex]?.userId ?? null}
        previewCard={feed[currentIndex] ?? null}
        matchReasons={matchReasons}
        compatibilityScore={currentCard.compatibilityScore}
        aiInsightCreditCost={aiInsightCost}
        aiMatchInsightFull={insightMap[currentCard.userId]}
        onUnlockAiInsight={isDummy ? undefined : handleUnlockAiInsight}
        aiInsightLoading={loadingInsightFor === currentCard.userId}
        primaryCtaLabel={primaryCta}
        primaryCtaIcon={primaryCtaIcon}
        onSkip={() => {
          setProfileDrawerOpen(false);
          void handlePass();
        }}
        onWantToTrain={() => {
          void handleWantToTrain();
        }}
        interestLoading={likeLoading}
        canAct={!isDummy}
      />

      <MatchCelebrationOverlay
        open={!!matchCelebration}
        celebration={matchCelebration}
        onSendMessage={() => {
          if (!matchCelebration) return;
          const id = matchCelebration.matchId;
          closeMatchCelebration(true);
          navigate(`/app/chat?thread=${encodeURIComponent(id)}`);
        }}
        onKeepSwiping={() => closeMatchCelebration(true)}
      />

      <Snackbar
        open={!!toast}
        autoHideDuration={toast?.includes('sign in') || toast?.includes('Session expired') ? 10000 : 5200}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{
          bottom: { xs: 100, sm: 108 },
          '& .MuiSnackbarContent-root': { maxWidth: 420 },
        }}
        action={
          toast && (toast.includes('sign in') || toast.includes('Session expired')) ? (
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setToast(null);
                logout();
                navigate('/login', { state: { from: '/app/discover' }, replace: true });
              }}
            >
              Sign in
            </Button>
          ) : undefined
        }
      />

      <Snackbar
        open={skipUndoOpen}
        autoHideDuration={4500}
        onClose={() => setSkipUndoOpen(false)}
        message={t('discover.skipped_toast')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        action={
          me?.profile?.discoverCanRewindLastSkip !== false ? (
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                void handleUndoSkip();
              }}
            >
              Undo
            </Button>
          ) : undefined
        }
      />

      <OnboardingModal open={onboardingModalOpen} onClose={() => setOnboardingModalOpen(false)} />

      <Modal
        open={dailyLimitModalOpen}
        onClose={() => setDailyLimitModalOpen(false)}
        title="Daily match limit reached"
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            You&apos;ve used your {DAILY_LIKE_LIMIT} free matches for today (UTC). Add credits to unlock unlimited
            discovery — paying members keep swiping without a daily cap.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="outlined" onClick={() => setDailyLimitModalOpen(false)}>
              Close
            </Button>
            <Button variant="contained" onClick={() => { setDailyLimitModalOpen(false); navigate('/pricing'); }}>
              Get credits
            </Button>
          </Box>
        </Box>
      </Modal>
    </div>
  );
};
