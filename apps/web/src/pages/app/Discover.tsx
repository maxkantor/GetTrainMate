import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Box, Button, Typography, Alert, Snackbar, useMediaQuery, useTheme } from '@mui/material';
import { ProfileCardSkeleton } from '@/components/ui/Skeleton';
import { FiltersDrawer, DiscoverFilters } from '@/components/discover/FiltersDrawer';
import { OnboardingModal, shouldShowOnboardingModal } from '@/components/onboarding/OnboardingModal';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { matchService, MatchFeedItem } from '@/services/matchService';
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
  NO_PHOTO_PLACEHOLDER,
} from '@/utils/profilePhotos';
import { IMAGE_BUCKET_BASE } from '@/config/media';
import { getLocationFromIp, FALLBACK_LOCATION } from '@/services/locationService';
import { buildDiscoverDemoCards, isDummyNearbyProfile } from '@/data/nearbyDummyProfiles';
import { DiscoverLayout } from './discover/DiscoverLayout';
import { ProfileCard } from './discover/ProfileCard';
import { MatchPanel } from './discover/MatchPanel';
import { ActionBar } from './discover/ActionBar';
import { FiltersButton } from './discover/FiltersButton';
import { ConfirmConnectModal } from './discover/ConfirmConnectModal';
import { DISCOVER_STRINGS } from './discover/constants';
import { incrementDailyLike, getDailyLikeCount } from '@/utils/dailySwipeTracker';
import { DAILY_LIKE_LIMIT } from '@/config/appLimits';
import { MatchCelebrationOverlay, MatchCelebrationState } from '@/components/discover/MatchCelebrationOverlay';
import { Modal } from '@/components/ui/Modal';
import { getMatchInsight, getAiCreditCosts, isInsufficientCreditsError, getAiErrorMessage } from '@/services/aiService';
import type { MatchInsightResponse } from '@/types/ai';
import styles from './Discover.module.css';

const SKIPPED_DISCOVER_IDS_KEY = 'gtm_discover_skipped_ids';

function loadSkippedDiscoverIds(): string[] {
  try {
    const raw = sessionStorage.getItem(SKIPPED_DISCOVER_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function saveSkippedDiscoverIds(ids: Set<string>): void {
  try {
    sessionStorage.setItem(SKIPPED_DISCOVER_IDS_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

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
  const { user, logout } = useAuthContext();
  const { me, refreshMe } = useMe();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [feed, setFeed] = useState<MatchFeedItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [undoStack, setUndoStack] = useState<number[]>([]);
  const [showUndo, setShowUndo] = useState(false);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [matchCelebration, setMatchCelebration] = useState<MatchCelebrationState | null>(null);
  const [retentionMessage, setRetentionMessage] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dailyLimitModalOpen, setDailyLimitModalOpen] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [photoErrorForIndex, setPhotoErrorForIndex] = useState<number | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [userLocationLabel, setUserLocationLabel] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
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
  const [skippedDiscoverIds, setSkippedDiscoverIds] = useState<Set<string>>(
    () => new Set(loadSkippedDiscoverIds())
  );
  const [skipUndoOpen, setSkipUndoOpen] = useState(false);
  const [lastSkippedProfile, setLastSkippedProfile] = useState<MatchFeedItem | null>(null);

  const autoSeedRef = useRef(false);
  const matchOverlayOpenRef = useRef(false);
  const openDailyLimitModal = useCallback(() => {
    setDailyLimitModalOpen(true);
  }, []);
  const markSkippedProfile = useCallback((userId: string) => {
    setSkippedDiscoverIds((prev) => {
      if (prev.has(userId)) return prev;
      const next = new Set(prev);
      next.add(userId);
      saveSkippedDiscoverIds(next);
      return next;
    });
  }, []);
  const clearSkippedProfileMark = useCallback((userId: string) => {
    setSkippedDiscoverIds((prev) => {
      if (!prev.has(userId)) return prev;
      const next = new Set(prev);
      next.delete(userId);
      saveSkippedDiscoverIds(next);
      return next;
    });
  }, []);

  useEffect(() => {
    loadFeed();
  }, []);

  useEffect(() => {
    const uid = me?.user?.id ?? user?.sub ?? '';
    const last = localStorage.getItem('gtm_discover_last_visit');
    const now = Date.now();
    const dayKey = new Date().toISOString().slice(0, 10);
    const shownKey = `gtm_retention_shown_${dayKey}`;
    if (
      uid &&
      last &&
      now - parseInt(last, 10) > 60 * 60 * 1000 &&
      !sessionStorage.getItem(shownKey)
    ) {
      setRetentionMessage('🔥 3 new athletes matched your profile');
      sessionStorage.setItem(shownKey, '1');
    }
    localStorage.setItem('gtm_discover_last_visit', String(now));
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
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await authService.getJWT();
      if (!token) return;
      try {
        const costs = await getAiCreditCosts(token);
        if (!cancelled) setAiInsightCost(costs.matchInsight);
      } catch {
        /* use default 2 */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadFeed = async (isRetryAfter401 = false) => {
    try {
      setLoading(true);
      setError('');
      if (isGraphQLEnabled) {
        const result = await graphqlDiscoverCandidates(50);
        const items = (result.items || []) as {
          userId: string;
          displayName: string;
          city?: string;
          bio?: string;
          sports?: string[];
          avatarUrl?: string;
          compatibilityScore?: number;
          level?: string;
        }[];
        const feedFromApi: MatchFeedItem[] = items.map((c) => {
          const url = toPhotoUrl(c.avatarUrl, c.userId, c.displayName);
          const photoUrls = getMultiplePhotoUrls([url], c.userId, 4, c.displayName);
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
            mode: 'TRAIN',
          };
        });
        let location = await getLocationFromIp();
        if (!location) location = FALLBACK_LOCATION;
        const merged = [...feedFromApi, ...buildDiscoverDemoCards(location)].filter(
          (card) => !skippedDiscoverIds.has(card.userId)
        );
        setFeed(sortDiscoverFeed(merged));
        setUserLocationLabel(location.label);
        setCurrentIndex(0);
        setUndoStack([]);
        setShowUndo(false);
        setPhotoErrorForIndex(null);
        setPhotoFallbackUrls({});
      } else {
        const token = await authService.getJWT(isRetryAfter401);
        if (!token) {
          setError('Not authenticated');
          setLoading(false);
          return;
        }
        const feedFromApi = await matchService.getDiscoveryFeed(token, 50);
        const feedWithPhotos: MatchFeedItem[] = feedFromApi.map((c) => ({
          ...c,
          photoUrls: getMultiplePhotoUrls(c.photoUrls, c.userId, 4, c.name),
        }));
        let location = await getLocationFromIp();
        if (!location) location = FALLBACK_LOCATION;
        const merged = [...feedWithPhotos, ...buildDiscoverDemoCards(location)];
        setFeed(sortDiscoverFeed(merged));
        setUserLocationLabel(location.label);
        setCurrentIndex(0);
        setUndoStack([]);
        setShowUndo(false);
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
              const result = await graphqlDiscoverCandidates(50);
              const items = (result.items || []) as {
                userId: string;
                displayName: string;
                city?: string;
                bio?: string;
                sports?: string[];
                avatarUrl?: string;
                compatibilityScore?: number;
              }[];
              const feedFromApi: MatchFeedItem[] = items.map((c) => {
                const url = toPhotoUrl(c.avatarUrl, c.userId, c.displayName);
                const photoUrls = getMultiplePhotoUrls([url], c.userId, 4, c.displayName);
                return {
                  userId: c.userId,
                  name: c.displayName,
                  city: c.city,
                  bio: c.bio ?? undefined,
                  sportTags: c.sports ?? [],
                  photoUrls,
                  compatibilityScore: c.compatibilityScore ?? 50,
                  commonSports: c.sports ?? [],
                  mode: 'TRAIN',
                };
              });
              let location = await getLocationFromIp();
              if (!location) location = FALLBACK_LOCATION;
              const merged = [...feedFromApi, ...buildDiscoverDemoCards(location)].filter(
                (card) => !skippedDiscoverIds.has(card.userId)
              );
              setFeed(sortDiscoverFeed(merged));
              setUserLocationLabel(location.label);
              setCurrentIndex(0);
              setPhotoFallbackUrls({});
            } else {
              const feedFromApi = await matchService.getDiscoveryFeed(freshToken!, 50);
              const feedWithPhotos = feedFromApi.map((c) => ({
                ...c,
                photoUrls: getMultiplePhotoUrls(c.photoUrls, c.userId, 4, c.name),
              }));
              let location = await getLocationFromIp();
              if (!location) location = FALLBACK_LOCATION;
              const merged = [...feedWithPhotos, ...buildDiscoverDemoCards(location)];
              setFeed(sortDiscoverFeed(merged));
              setUserLocationLabel(location.label);
              setCurrentIndex(0);
              setPhotoErrorForIndex(null);
              setPhotoFallbackUrls({});
            }
            setLoading(false);
            return;
          } catch {
            // fall through to error
          }
        }
        setError('Session expired. Please sign in again.');
        setLoading(false);
        await logout();
        navigate('/login', { state: { from: '/app/discover' }, replace: true });
        return;
      }

      if (isNetworkError(err)) {
        setError(
          'Unable to connect to the API. The backend may not be deployed or CORS is not configured.'
        );
      } else if (status === 401) {
        setError('Authentication required. Please sign in again.');
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const advanceWithUndo = useCallback(() => {
    const prev = currentIndex;
    setUndoStack((s) => [...s, prev]);
    setShowUndo(true);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = setTimeout(() => {
      setShowUndo(false);
      setUndoStack((s) => s.slice(0, -1));
      undoTimeoutRef.current = null;
    }, 3000);

    if (currentIndex < feed.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setFeed([]);
      setError('No more profiles to discover!');
    }
  }, [currentIndex, feed.length]);

  const handleUndo = useCallback(() => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    const stack = [...undoStack];
    if (stack.length === 0) return;
    const prevIndex = stack.pop();
    setUndoStack(stack);
    setShowUndo(false);
    if (prevIndex != null) setCurrentIndex(prevIndex);
  }, [undoStack]);

  const handleLike = useCallback(async () => {
    if (currentIndex >= feed.length) return;

    const currentCard = feed[currentIndex];
    if (isDummyNearbyProfile(currentCard.userId)) {
      setToast('This is a preview profile — keep swiping to see profiles you can like and connect with.');
      advanceWithUndo();
      return;
    }

    if (getDailyLikeCount() >= DAILY_LIKE_LIMIT) {
      setToast(`You've reached today's ${DAILY_LIKE_LIMIT}-match limit.`);
      openDailyLimitModal();
      return;
    }

    const celebrationPhoto = (() => {
      const urls = getMultiplePhotoUrls(currentCard.photoUrls, currentCard.userId, 4, currentCard.name);
      const g = inferGenderFromName(currentCard.name);
      return urls[0] || placeholderPhotoUrl(currentCard.userId, 0, g);
    })();

    try {
      setLikeLoading(true);
      if (isGraphQLEnabled) {
        const result = await graphqlLikeUser(currentCard.userId);
        incrementDailyLike();
        await refreshMe();
        if (result.isMatched) {
          setMatchCelebration({
            name: currentCard.name,
            photoUrl: celebrationPhoto,
            matchId: result.matchId,
          });
          return;
        }
        if (getDailyLikeCount() >= DAILY_LIKE_LIMIT) {
          setToast(`You've reached today's ${DAILY_LIKE_LIMIT}-match limit.`);
          openDailyLimitModal();
        } else {
          setToast(DISCOVER_STRINGS.liked);
        }
        advanceWithUndo();
      } else {
        let token = await authService.getJWT(true);
        if (!token) {
          setToast('Please sign in again.');
          return;
        }
        try {
          const result = await matchService.likeUser(token, currentCard.userId);
          incrementDailyLike();
          await refreshMe();
          if (result.isMatched) {
            setMatchCelebration({
              name: currentCard.name,
              photoUrl: celebrationPhoto,
              matchId: result.matchId,
            });
            return;
          }
          if (getDailyLikeCount() >= DAILY_LIKE_LIMIT) {
            setToast(`You've reached today's ${DAILY_LIKE_LIMIT}-match limit.`);
            openDailyLimitModal();
          } else {
            setToast(DISCOVER_STRINGS.liked);
          }
          advanceWithUndo();
        } catch (likeErr: unknown) {
          const status = (likeErr as { response?: { status?: number } })?.response?.status;
          if (status === 401) {
            token = await authService.getJWT(true) ?? '';
            if (token) {
              try {
                const result = await matchService.likeUser(token, currentCard.userId);
                incrementDailyLike();
                await refreshMe();
                if (result.isMatched) {
                  setMatchCelebration({
                    name: currentCard.name,
                    photoUrl: celebrationPhoto,
                    matchId: result.matchId,
                  });
                  return;
                }
                if (getDailyLikeCount() >= DAILY_LIKE_LIMIT) {
                  setToast(`You've reached today's ${DAILY_LIKE_LIMIT}-match limit.`);
                  openDailyLimitModal();
                } else {
                  setToast(DISCOVER_STRINGS.liked);
                }
                advanceWithUndo();
                return;
              } catch {
                /* fall through */
              }
            }
            setToast('Session expired. Please sign in again.');
            setLikeLoading(false);
            return;
          }
          throw likeErr;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('INSUFFICIENT_CREDITS') || msg.includes('Insufficient')) {
        setToast('Not enough credits. Get more on the Pricing page.');
      } else {
        const apiError = handleApiError(err);
        if (
          apiError.code === 'INSUFFICIENT_CREDITS' ||
          (err as { response?: { status?: number } })?.response?.status === 402
        ) {
          setToast(apiError.message || 'Not enough credits. Get more on the Pricing page.');
        } else if (apiError.status === 401 || apiError.isAuthError) {
          setToast('Session expired. Please sign in again.');
        } else {
          setToast(apiError.message || 'Failed to like');
        }
      }
    } finally {
      setLikeLoading(false);
    }
  }, [advanceWithUndo, currentIndex, feed, openDailyLimitModal, refreshMe]);

  const handlePass = async () => {
    if (currentIndex >= feed.length) return;

    const currentCard = feed[currentIndex];
    if (isDummyNearbyProfile(currentCard.userId)) {
      markSkippedProfile(currentCard.userId);
      setLastSkippedProfile(currentCard);
      setSkipUndoOpen(true);
      const nextFeed = feed.filter((_, idx) => idx !== currentIndex);
      setFeed(nextFeed);
      setCurrentIndex((prev) => Math.max(0, Math.min(prev, nextFeed.length - 1)));
      if (nextFeed.length === 0) setError('No more profiles to discover!');
      return;
    }

    try {
      if (isGraphQLEnabled) {
        await graphqlPassUser(currentCard.userId);
        markSkippedProfile(currentCard.userId);
      } else {
        let token = await authService.getJWT(true);
        if (!token) {
          setToast('Please sign in again.');
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
      setLastSkippedProfile(currentCard);
      setSkipUndoOpen(true);
      const nextFeed = feed.filter((_, idx) => idx !== currentIndex);
      setFeed(nextFeed);
      setCurrentIndex((prev) => Math.max(0, Math.min(prev, nextFeed.length - 1)));
      if (nextFeed.length === 0) setError('No more profiles to discover!');
    } catch {
      setToast('Could not save pass. Try again.');
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
        setToast('Please sign in again.');
        return;
      }
      const result = await matchService.undoPass(token, lastSkippedProfile.userId);
      if (!result.restored) {
        setToast('Could not undo skip.');
        return;
      }
    }
    clearSkippedProfileMark(lastSkippedProfile.userId);
    restoreSkippedProfile(lastSkippedProfile);
    setSkipUndoOpen(false);
  }, [clearSkippedProfileMark, lastSkippedProfile, restoreSkippedProfile]);

  const handleRewindLastSkip = useCallback(async () => {
    if (!lastSkippedProfile || skipUndoOpen) return;
    await handleUndoSkip();
  }, [handleUndoSkip, lastSkippedProfile, skipUndoOpen]);

  const handleConnectConfirm = () => {
    const currentCard = feed[currentIndex];
    if (currentCard?.userId) {
      setConnectModalOpen(false);
      navigate(`/app/profile/${currentCard.userId}`);
    }
  };

  const handleConnect = () => {
    const currentCard = feed[currentIndex];
    if (currentCard?.userId) {
      navigate(`/app/profile/${currentCard.userId}`);
    }
  };

  const discoverActionsRef = useRef({
    pass: async () => {},
    like: async () => {},
    connect: () => {},
  });
  discoverActionsRef.current = {
    pass: handlePass,
    like: handleLike,
    connect: handleConnect,
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
        void discoverActionsRef.current.like();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        discoverActionsRef.current.connect();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSeedDemo = async () => {
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
          setError('Not authenticated');
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
      setError(apiError.message || 'Failed to load demo profiles');
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    if (!loading && feed.length === 0 && !error && !autoSeedRef.current) {
      autoSeedRef.current = true;
      void handleSeedDemo();
    }
  }, [loading, feed.length, error]);

  const closeMatchCelebration = useCallback(
    (advance: boolean) => {
      setMatchCelebration(null);
      if (advance) advanceWithUndo();
    },
    [advanceWithUndo]
  );

  const handleUnlockAiInsight = useCallback(async () => {
    const card = feed[currentIndex];
    if (!card || !me?.user?.id) return;
    if (isDummyNearbyProfile(card.userId)) return;
    // Use refreshed token to avoid 401 from expired token
    const token = await authService.getJWT(true);
    if (!token) {
      setToast('Please sign in again.');
      return;
    }
    if ((me?.credits ?? 0) < aiInsightCost) {
      setToast('Not enough credits to unlock AI match insight. Get more on the Pricing page.');
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
        setToast('Session expired. Please sign in again.');
        setLoadingInsightFor(null);
        return;
      }
      if (isInsufficientCreditsError(err)) {
        setToast('Not enough credits. Get more on the Pricing page.');
      } else {
        setToast(getAiErrorMessage(err));
      }
    } finally {
      setLoadingInsightFor(null);
    }
  }, [currentIndex, feed, me, aiInsightCost, refreshMe]);

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
                {DISCOVER_STRINGS.retry}
              </Button>
            )}
          </Box>
        </div>
      </div>
    );
  }

  if (feed.length === 0 && !loading && !error) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Typography variant="h6" gutterBottom>
            {DISCOVER_STRINGS.noMatches}
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            {DISCOVER_STRINGS.noMatchesSub}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
            <Button variant="contained" onClick={handleSeedDemo} disabled={seeding}>
              {seeding ? 'Loading…' : DISCOVER_STRINGS.loadDemo}
            </Button>
            <Button variant="outlined" onClick={() => navigate('/app/profile')}>
              {DISCOVER_STRINGS.editProfile}
            </Button>
            <Button variant="outlined" onClick={() => loadFeed()}>
              {DISCOVER_STRINGS.refresh}
            </Button>
          </Box>
        </div>
      </div>
    );
  }

  const currentCard = feed[currentIndex];
  const progress = feed.length > 0 ? ((currentIndex + 1) / feed.length) * 100 : 0;
  const credits = me?.credits ?? 0;
  const photoFailed = photoErrorForIndex === currentIndex;
  const allPhotos = getMultiplePhotoUrls(currentCard.photoUrls, currentCard.userId, 4, currentCard.name);
  const photoIndex = Math.min(currentPhotoIndex, allPhotos.length - 1);
  const primaryPhotoUrl = allPhotos[photoIndex] || NO_PHOTO_PLACEHOLDER;
  const cardPhotoKey = `${currentCard.userId}-${photoIndex}`;
  const fallbackUrl = photoFallbackUrls[cardPhotoKey];
  const displayPhotoUrl = photoFailed ? NO_PHOTO_PLACEHOLDER : fallbackUrl || primaryPhotoUrl;
  const isDummy = isDummyNearbyProfile(currentCard.userId);

  const matchReasons = [
    ...(currentCard.commonSports?.length
      ? [`${currentCard.commonSports.length} common sports`]
      : []),
    currentCard.level ? `Similar level (${currentCard.level})` : null,
    currentCard.city ? 'Distance near you' : null,
    currentCard.mode ? `Same mode (${currentCard.mode})` : null,
  ].filter(Boolean) as string[];

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
        banner={
          retentionMessage ? (
            <div className={styles.retentionBanner} role="status">
              {retentionMessage}
              <button
                type="button"
                className={styles.retentionDismiss}
                aria-label="Dismiss"
                onClick={() => setRetentionMessage(null)}
              >
                ×
              </button>
            </div>
          ) : null
        }
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
            onSwipeRight={handleLike}
            matched={false}
          />
        }
        panel={
          <MatchPanel
            score={currentCard.compatibilityScore}
            reasons={matchReasons}
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
              onLike={handleLike}
              onConnect={handleConnect}
              onUndo={handleUndo}
              onRewind={handleRewindLastSkip}
              likeLoading={likeLoading}
              canUndo={undoStack.length > 0}
              showUndo={showUndo}
              canRewind={!!lastSkippedProfile && !skipUndoOpen}
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

      <ConfirmConnectModal
        open={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        onConfirm={handleConnectConfirm}
        title={DISCOVER_STRINGS.connectModalTitle}
        body={DISCOVER_STRINGS.connectModalBody}
        confirmLabel={DISCOVER_STRINGS.connectModalConfirm}
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
        autoHideDuration={toast?.includes('sign in') || toast?.includes('Session expired') ? 10000 : 5000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
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
        message="Profile skipped"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              void handleUndoSkip();
            }}
          >
            Undo
          </Button>
        }
      />

      <OnboardingModal open={onboardingModalOpen} onClose={() => setOnboardingModalOpen(false)} />

      <Modal
        open={dailyLimitModalOpen}
        onClose={() => setDailyLimitModalOpen(false)}
        title="You're out of matches for today."
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            You're at today's limit. Wait for reset, or use 1 credit to continue now.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="outlined" onClick={() => setDailyLimitModalOpen(false)}>
              Wait for reset
            </Button>
            {credits > 0 ? (
              <Button
                component={Link}
                to="/app/discover"
                variant="contained"
                onClick={() => setDailyLimitModalOpen(false)}
              >
                Use 1 credit now
              </Button>
            ) : (
              <Button
                component={Link}
                to="/pricing"
                variant="contained"
                onClick={() => setDailyLimitModalOpen(false)}
              >
                Get Credits
              </Button>
            )}
          </Box>
        </Box>
      </Modal>
    </div>
  );
};
