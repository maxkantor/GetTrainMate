import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Box, Button, Typography, Alert, Snackbar, useMediaQuery, useTheme } from '@mui/material';
import { ProfileCardSkeleton } from '@/components/ui/Skeleton';
import { FiltersDrawer, DiscoverFilters } from '@/components/discover/FiltersDrawer';
import { UpgradeBanner } from '@/components/discover/UpgradeBanner';
import { OnboardingModal, shouldShowOnboardingModal } from '@/components/onboarding/OnboardingModal';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { matchService, MatchFeedItem } from '@/services/matchService';
import { authService } from '@/services/authService';
import {
  isGraphQLEnabled,
  graphqlDiscoverCandidates,
  graphqlLikeUser,
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
import { buildNearbyDummyProfiles, isDummyNearbyProfile } from '@/data/nearbyDummyProfiles';
import { DiscoverLayout } from './discover/DiscoverLayout';
import { ProfileCard } from './discover/ProfileCard';
import { MatchPanel } from './discover/MatchPanel';
import { ActionBar } from './discover/ActionBar';
import { FiltersButton } from './discover/FiltersButton';
import { ConfirmConnectModal } from './discover/ConfirmConnectModal';
import { DISCOVER_STRINGS } from './discover/constants';
import styles from './Discover.module.css';

const BACKEND_DUMMY_PREFIX = 'dummy-user-';

function sortFeedBackendDummiesLast<T extends { userId: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aDummy = a.userId.startsWith(BACKEND_DUMMY_PREFIX) ? 1 : 0;
    const bDummy = b.userId.startsWith(BACKEND_DUMMY_PREFIX) ? 1 : 0;
    return aDummy - bDummy;
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
  const [matched, setMatched] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
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

  useEffect(() => {
    loadFeed();
  }, []);

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
        const merged = [...buildNearbyDummyProfiles(location), ...feedFromApi];
        setFeed(sortFeedBackendDummiesLast(merged));
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
        const merged = [...buildNearbyDummyProfiles(location), ...feedWithPhotos];
        setFeed(sortFeedBackendDummiesLast(merged));
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
              const merged = [...buildNearbyDummyProfiles(location), ...feedFromApi];
              setFeed(sortFeedBackendDummiesLast(merged));
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
              const merged = [...buildNearbyDummyProfiles(location), ...feedWithPhotos];
              setFeed(sortFeedBackendDummiesLast(merged));
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

  const handleLike = async () => {
    if (currentIndex >= feed.length) return;

    const currentCard = feed[currentIndex];
    if (isDummyNearbyProfile(currentCard.userId)) {
      setToast('This is a preview profile — keep swiping to see profiles you can like and connect with.');
      advanceWithUndo();
      return;
    }

    try {
      setLikeLoading(true);
      if (isGraphQLEnabled) {
        const result = await graphqlLikeUser(currentCard.userId);
        await refreshMe();
        if (result.isMatched) {
          setMatched(true);
          setToast(`${DISCOVER_STRINGS.match} ${currentCard.name}`);
          setTimeout(() => {
            advanceWithUndo();
            setMatched(false);
          }, 1500);
        } else {
          setToast(DISCOVER_STRINGS.liked);
          advanceWithUndo();
        }
      } else {
        const token = await authService.getJWT();
        if (!token) return;
        const result = await matchService.likeUser(token, currentCard.userId);
        await refreshMe();
        if (result.isMatched) {
          setMatched(true);
          setToast(`${DISCOVER_STRINGS.match} ${currentCard.name}`);
          setTimeout(() => {
            advanceWithUndo();
            setMatched(false);
          }, 1500);
        } else {
          setToast(DISCOVER_STRINGS.liked);
          advanceWithUndo();
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
        } else {
          setToast(apiError.message || 'Failed to like');
        }
      }
    } finally {
      setLikeLoading(false);
    }
  };

  const handlePass = async () => {
    if (currentIndex >= feed.length) return;

    const currentCard = feed[currentIndex];
    if (isDummyNearbyProfile(currentCard.userId)) {
      advanceWithUndo();
      return;
    }

    try {
      if (!isGraphQLEnabled) {
        const token = await authService.getJWT();
        if (!token) return;
        await matchService.passUser(token, currentCard.userId);
      }
      setToast(DISCOVER_STRINGS.passed);
      advanceWithUndo();
    } catch {
      advanceWithUndo();
    }
  };

  const handleConnectConfirm = () => {
    const currentCard = feed[currentIndex];
    if (currentCard?.userId) {
      setConnectModalOpen(false);
      navigate(`/app/profile/${currentCard.userId}`);
    }
  };

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
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Alert severity={error.includes('API') ? 'warning' : 'info'} sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button fullWidth variant="contained" color="primary" onClick={() => loadFeed()}>
            {DISCOVER_STRINGS.retry}
          </Button>
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

  const myAvatarLetter =
    user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U';
  const activeFilterCount = countActiveFilters(filters);

  return (
    <div className={styles.container}>
      <DiscoverLayout
        topBar={
          <>
            <Link to="/app/profile" className={styles.myAvatar} aria-label="Your profile">
              <span className={styles.myAvatarLetter}>{myAvatarLetter}</span>
            </Link>
            <p className={styles.creditsStrip}>
              <strong>Credits: {credits}</strong> · Chat unlock = 1 credit
              {userLocationLabel && (
                <>
                  {' '}
                  · <span className={styles.locationLabel}>Near {userLocationLabel}</span>
                </>
              )}
            </p>
            <FiltersButton
              onClick={() => setFiltersOpen(true)}
              activeCount={activeFilterCount}
            />
          </>
        }
        headerRow={
          <div className={styles.headerRow}>
            <span className={styles.headerCount}>
              {currentIndex + 1} of {feed.length}
              {isDummy ? ' (near you)' : ''}
            </span>
          </div>
        }
        progressBar={
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
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
            matched={matched}
          />
        }
        panel={
          <MatchPanel
            score={currentCard.compatibilityScore}
            reasons={matchReasons}
            aiMatchInsight={currentCard.aiMatchInsight}
            compact
            collapsible={isMobile}
            defaultCollapsed={isMobile}
          />
        }
        banner={
          credits < 1 ? (
            <UpgradeBanner message="Get credits to unlock chat when you match." />
          ) : undefined
        }
        actionBar={
          <>
            <ActionBar
              onPass={handlePass}
              onLike={handleLike}
              onConnect={() => setConnectModalOpen(true)}
              onUndo={handleUndo}
              likeLoading={likeLoading}
              credits={credits}
              canUndo={undoStack.length > 0}
              showUndo={showUndo}
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

      <Snackbar
        open={!!toast}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      <OnboardingModal open={onboardingModalOpen} onClose={() => setOnboardingModalOpen(false)} />
    </div>
  );
};
