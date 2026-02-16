import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Alert,
  Snackbar,
} from '@mui/material';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import LinkIcon from '@mui/icons-material/Link';
import FilterListIcon from '@mui/icons-material/FilterList';
import { ProfileCardSkeleton } from '@/components/ui/Skeleton';
import { FiltersDrawer, DiscoverFilters } from '@/components/discover/FiltersDrawer';
import { UpgradeBanner } from '@/components/discover/UpgradeBanner';
import { OnboardingModal, shouldShowOnboardingModal } from '@/components/onboarding/OnboardingModal';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { matchService, MatchFeedItem } from '@/services/matchService';
import { authService } from '@/services/authService';
import { isGraphQLEnabled, graphqlDiscoverCandidates, graphqlLikeUser, graphqlSeedDemoData } from '@/services/graphqlService';
import { handleApiError, getErrorMessage, isNetworkError } from '@/utils/apiErrorHandler';
import { IMAGE_BUCKET_BASE } from '@/config/media';
import { getMultiplePhotoUrls, placeholderPhotoUrl, inferGenderFromName } from '@/utils/profilePhotos';
import { getLocationFromIp, FALLBACK_LOCATION } from '@/services/locationService';
import { buildNearbyDummyProfiles, isDummyNearbyProfile } from '@/data/nearbyDummyProfiles';
import styles from './Discover.module.css';

/** Backend seed profiles (e.g. Alex) go to end of feed so you see "near you" first; they are still likeable/connectable. */
const BACKEND_DUMMY_PREFIX = 'dummy-user-';
function sortFeedBackendDummiesLast<T extends { userId: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aDummy = a.userId.startsWith(BACKEND_DUMMY_PREFIX) ? 1 : 0;
    const bDummy = b.userId.startsWith(BACKEND_DUMMY_PREFIX) ? 1 : 0;
    return aDummy - bDummy;
  });
}

/** Backend may return avatarUrl as full URL or S3 key; normalize to full URL. Use gender-matched placeholder when missing. */
function toPhotoUrl(avatarUrl: string | undefined, userId: string, displayName?: string): string {
  if (avatarUrl && (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://'))) return avatarUrl;
  if (avatarUrl) return `${IMAGE_BUCKET_BASE}/${avatarUrl.replace(/^\//, '')}`;
  const gender = displayName ? inferGenderFromName(displayName) : 'male';
  return placeholderPhotoUrl(userId, 0, gender);
}

export const DiscoverPage: React.FC = () => {
  const { t } = useI18n();
  const { user, logout } = useAuthContext();
  const { me, refreshMe } = useMe();
  const navigate = useNavigate();

  const [feed, setFeed] = useState<MatchFeedItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
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
  const [filters, setFilters] = useState<DiscoverFilters>({
    distance: '30 miles',
    goals: [],
    schedule: [],
    experienceLevel: 'Any',
  });
  const currentUserIdRef = useRef<string | null>(null);
  const touchStartX = useRef<number | null>(null);
  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false);

  useEffect(() => {
    loadFeed();
  }, []);

  useEffect(() => {
    if (!loading && shouldShowOnboardingModal(me?.isProfileComplete ?? true)) {
      setOnboardingModalOpen(true);
    }
  }, [loading, me?.isProfileComplete]);

  // Reset photo error and photo index when changing card
  useEffect(() => {
    setPhotoErrorForIndex(null);
    setCurrentPhotoIndex(0);
  }, [currentIndex]);

  const loadFeed = async (isRetryAfter401 = false) => {
    try {
      setLoading(true);
      setError('');
      if (isGraphQLEnabled) {
        const result = await graphqlDiscoverCandidates(50);
        const items = (result.items || []) as { userId: string; displayName: string; city?: string; bio?: string; sports?: string[]; avatarUrl?: string; compatibilityScore?: number }[];
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
        setPhotoErrorForIndex(null);
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
        setPhotoErrorForIndex(null);
      }
    } catch (err: any) {
      const status = err.response?.status ?? err.status;
      const apiError = handleApiError(err);

      if (status === 401 && !isRetryAfter401) {
        const freshToken = await authService.getJWT(true);
        if (freshToken || isGraphQLEnabled) {
          try {
            if (isGraphQLEnabled) {
              const result = await graphqlDiscoverCandidates(50);
              const items = (result.items || []) as { userId: string; displayName: string; city?: string; bio?: string; sports?: string[]; avatarUrl?: string; compatibilityScore?: number }[];
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
            }
            setLoading(false);
            return;
          } catch (retryErr: any) {
            const retryStatus = retryErr.response?.status ?? retryErr.status;
            if (retryStatus === 401) {
              setError('Session expired. Please sign in again.');
              setLoading(false);
              await logout();
              navigate('/login', { state: { from: '/app/discover' }, replace: true });
              return;
            }
            throw retryErr;
          }
        }
        setError('Session expired. Please sign in again.');
        setLoading(false);
        await logout();
        navigate('/login', { state: { from: '/app/discover' }, replace: true });
        return;
      }

      if (import.meta.env.DEV) {
        const statusLog = err.response?.status ?? err.status ?? 'no status';
        console.error('[Discover] loadFeed failed:', statusLog, apiError.message, apiError.code ?? '');
        if (statusLog === 'no status' && err != null && typeof err === 'object') {
          const keys = Object.keys(err).filter((k) => !k.startsWith('_'));
          console.error('[Discover] raw error shape (for debugging):', keys, err?.message);
        }
      }
      if (isNetworkError(err) || apiError.isCorsError) {
        setError('Unable to connect to the API. The backend may not be deployed or CORS is not configured. Please check your API configuration.');
      } else if (status === 401) {
        setError('Authentication required. Please sign in again.');
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (currentIndex >= feed.length) return;

    const currentCard = feed[currentIndex];
    if (isDummyNearbyProfile(currentCard.userId)) {
      setToast('This is a preview profile — keep swiping to see profiles you can like and connect with.');
      nextCard();
      return;
    }

    try {
      setLikeLoading(true);
      if (isGraphQLEnabled) {
        const result = await graphqlLikeUser(currentCard.userId);
        await refreshMe();
        if (result.isMatched) {
          setMatched(true);
          setToast("It's a match! You can chat after you both unlock.");
          setTimeout(() => {
            nextCard();
            setMatched(false);
          }, 1500);
        } else {
          setToast('Liked');
          nextCard();
        }
      } else {
        const token = await authService.getJWT();
        if (!token) return;
        const result = await matchService.likeUser(token, currentCard.userId);
        await refreshMe();
        if (result.isMatched) {
          setMatched(true);
          setToast("It's a match! You can chat after you both unlock.");
          setTimeout(() => {
            nextCard();
            setMatched(false);
          }, 1500);
        } else {
          setToast('Liked');
          nextCard();
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('INSUFFICIENT_CREDITS') || msg.includes('Insufficient')) {
        setToast('Not enough credits. Get more on the Pricing page.');
      } else {
        const apiError = handleApiError(err);
        if (apiError.code === 'INSUFFICIENT_CREDITS' || (err as { response?: { status?: number } })?.response?.status === 402) {
          setToast(apiError.message || 'Not enough credits. Get more on the Pricing page.');
        } else {
          console.error('Error liking user:', err);
          setToast(apiError.message || 'Failed to like');
        }
      }
    } finally {
      setLikeLoading(false);
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
          // Backend may not support seedDemoData; still load feed with "near you" profiles
        }
        setError('');
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
          // Seed endpoint may fail; still load feed with "near you" profiles
        }
        setError('');
        await loadFeed();
      }
    } catch (err: unknown) {
      const apiError = handleApiError(err as Error);
      setError(apiError.message || 'Failed to load demo profiles');
    } finally {
      setSeeding(false);
    }
  };

  const handlePass = async () => {
    if (currentIndex >= feed.length) return;

    const currentCard = feed[currentIndex];
    if (isDummyNearbyProfile(currentCard.userId)) {
      nextCard();
      return;
    }

    try {
      if (isGraphQLEnabled) {
        nextCard();
        return;
      }
      const token = await authService.getJWT();
      if (!token) return;
      await matchService.passUser(token, currentCard.userId);
      nextCard();
    } catch (err: any) {
      console.error('Error passing user:', err);
    }
  };

  const nextCard = () => {
    if (currentIndex < feed.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setFeed([]);
      setError('No more profiles to discover!');
    }
  };

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
        <Alert
          severity={error.includes('API is not available') ? 'warning' : 'info'}
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
        <Button fullWidth variant="contained" color="primary" onClick={() => loadFeed()} sx={{ mt: 2 }}>
          Retry
        </Button>
      </div>
    );
  }

  if (feed.length === 0 && !loading && !error) {
    return (
      <div className={styles.container}>
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>No profiles yet</Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Try expanding filters or check back soon. You can load demo profiles to try the flow.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
            <Button variant="contained" onClick={handleSeedDemo} disabled={seeding}>
              {seeding ? 'Loading…' : 'Load demo profiles'}
            </Button>
            <Button variant="outlined" onClick={() => navigate('/app/profile')}>
              Edit profile
            </Button>
            <Button variant="outlined" onClick={() => loadFeed()}>
              Refresh
            </Button>
          </Box>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </Box>
      </div>
    );
  }

  const currentCard = feed[currentIndex];
  currentUserIdRef.current = currentCard?.userId ?? null;
  const progress = feed.length > 0 ? ((currentIndex + 1) / feed.length) * 100 : 0;
  const credits = me?.credits ?? 0;
  const photoFailed = photoErrorForIndex === currentIndex;
  const allPhotos = getMultiplePhotoUrls(currentCard.photoUrls, currentCard.userId, 4, currentCard.name);
  const photoIndex = Math.min(currentPhotoIndex, allPhotos.length - 1);
  const gender = currentCard?.name ? inferGenderFromName(currentCard.name) : 'male';
  const primaryPhotoUrl = allPhotos[photoIndex] || placeholderPhotoUrl(currentCard?.userId || '', photoIndex, gender);
  const displayPhotoUrl = photoFailed ? placeholderPhotoUrl(currentCard?.userId || '', photoIndex, gender) : primaryPhotoUrl;
  const levelLabel = currentCard.level ? currentCard.level.charAt(0).toUpperCase() + currentCard.level.slice(1) : null;
  const isDummy = isDummyNearbyProfile(currentCard.userId);

  const profilePath = currentCard?.userId ? `/app/profile/${currentCard.userId}` : null;
  const showUpgradeBanner = credits < 1;
  const matchReasons = [
    ...(currentCard.commonSports?.length ? [`${currentCard.commonSports.length} common sports`] : []),
    currentCard.level ? `Similar level (${currentCard.level})` : null,
    currentCard.mode ? `Same mode (${currentCard.mode})` : null,
  ].filter(Boolean) as string[];

  const handlePhotoSwipe = (dir: 'prev' | 'next') => {
    setCurrentPhotoIndex((i) => {
      if (dir === 'prev') return i <= 0 ? allPhotos.length - 1 : i - 1;
      return i >= allPhotos.length - 1 ? 0 : i + 1;
    });
    setPhotoErrorForIndex(null);
  };

  const onMediaTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0]?.clientX ?? null;
  };
  const onMediaTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null || allPhotos.length <= 1) return;
    const end = e.changedTouches[0]?.clientX;
    if (end == null) return;
    const delta = start - end;
    const minSwipe = 40;
    if (delta > minSwipe) handlePhotoSwipe('next');
    else if (delta < -minSwipe) handlePhotoSwipe('prev');
  };

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <p className={styles.creditsStrip}>
          <strong>Credits: {credits}</strong> · Like costs 1 credit
        {userLocationLabel && (
          <> · <span className={styles.locationLabel}>Near {userLocationLabel}</span></>
        )}
        </p>
        <button
          type="button"
          className={styles.filterBtn}
          onClick={() => setFiltersOpen(true)}
          aria-label="Open filters"
        >
          <FilterListIcon sx={{ fontSize: 20 }} />
          Filters
        </button>
      </div>

      {showUpgradeBanner && <UpgradeBanner />}

      <div className={styles.headerRow}>
        <span className={styles.headerCount}>{currentIndex + 1} of {feed.length}{isDummy ? ' (near you)' : ''}</span>
        <span className={styles.headerMatch}>{currentCard.compatibilityScore}% Match</span>
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      <div className={styles.cardWithPanel}>
        <article
          className={`${styles.cardStack} ${styles.cardClickable} ${matched ? styles.cardStackMatched : ''}`}
          aria-label={`Profile card: ${currentCard.name}. Click to view full profile.`}
        >
          <Link to={profilePath || '/app/discover'} className={styles.cardLink} aria-label={`View full profile of ${currentCard.name}`}>
          <div
            className={styles.mediaWrap}
            onTouchStart={onMediaTouchStart}
            onTouchEnd={onMediaTouchEnd}
            role="img"
            aria-label={`Swipe to see more photos. Photo ${photoIndex + 1} of ${allPhotos.length}.`}
          >
            <img
              src={displayPhotoUrl}
              alt={`${currentCard.name} — photo ${photoIndex + 1} of ${allPhotos.length}`}
              className={styles.mediaImage}
              onError={() => setPhotoErrorForIndex(currentIndex)}
              referrerPolicy="no-referrer"
              draggable={false}
            />
            <div className={styles.mediaOverlay} aria-hidden />
            {allPhotos.length > 1 && (
              <div className={styles.photoDots} aria-label="Photo gallery">
                {allPhotos.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`${styles.photoDot} ${i === photoIndex ? styles.photoDotActive : ''}`}
                    aria-label={`Photo ${i + 1}`}
                    aria-pressed={i === photoIndex}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentPhotoIndex(i); setPhotoErrorForIndex(null); }}
                  />
                ))}
              </div>
            )}
          </div>
          <div className={styles.content}>
            <h2 className={styles.contentName}>
              {currentCard.name}{levelLabel ? `, ${levelLabel}` : ''}
            </h2>
            <p className={styles.contentLocation}>
              {currentCard.city || 'Location not set'}
            </p>
            {currentCard.bio && (
              <p className={styles.contentBio}>{currentCard.bio}</p>
            )}
            {currentCard.commonSports && currentCard.commonSports.length > 0 && (
              <div className={styles.contentSection}>
                <p className={styles.contentSectionTitle}>Common Sports</p>
                <div className={styles.chips}>
                  {currentCard.commonSports.map((sport) => (
                    <span key={sport} className={styles.chipPrimary}>{sport}</span>
                  ))}
                </div>
              </div>
            )}
            {currentCard.sportTags && currentCard.sportTags.length > 0 && (
              <div className={styles.contentSection}>
                <p className={styles.contentSectionTitle}>Sports</p>
                <div className={styles.chips}>
                  {currentCard.sportTags.map((sport) => (
                    <span key={sport} className={styles.chipDefault}>{sport}</span>
                  ))}
                </div>
              </div>
            )}
            {currentCard.mode && (
              <div className={styles.contentSection}>
                <div className={styles.chips}>
                  <span className={styles.chipDefault}>Mode: {currentCard.mode}</span>
                </div>
              </div>
            )}
          </div>
        </Link>
      </article>

        <aside className={styles.compatibilityPanel}>
          <h3 className={styles.panelTitle}>Compatibility</h3>
          <div className={styles.matchPercent}>{currentCard.compatibilityScore}%</div>
          <p className={styles.panelSummary}>
            {matchReasons.length > 0
              ? `Strong match: ${matchReasons.slice(0, 2).join(', ')}.`
              : 'Based on your profile and preferences.'}
          </p>
          {matchReasons.length > 0 && (
            <ul className={styles.reasonsList}>
              {matchReasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <FiltersDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onFiltersChange={setFilters}
        onApply={() => loadFeed()}
      />

      <div className={styles.actionBar}>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.actionBtnPass}`}
          onClick={handlePass}
          aria-label="Pass on this profile"
        >
          <ThumbDownIcon aria-hidden sx={{ fontSize: 22 }} />
          Pass
        </button>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.actionBtnLike}`}
          onClick={handleLike}
          disabled={likeLoading || credits < 1}
          aria-label={credits < 1 ? 'Like (no credits)' : 'Like this profile'}
        >
          <ThumbUpIcon aria-hidden sx={{ fontSize: 22 }} />
          Like{credits < 1 ? ' (no credits)' : ''}
        </button>
        <Link
          to={profilePath || '/app/discover'}
          className={`${styles.actionBtn} ${styles.actionBtnConnect}`}
          aria-label={`View full profile of ${currentCard.name}`}
          style={{ textDecoration: 'none', color: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <LinkIcon aria-hidden sx={{ fontSize: 22 }} />
          Connect
        </Link>
      </div>

      {matched && (
        <Alert severity="success" className={styles.matchToast}>
          🎉 It&apos;s a match! You can now chat with {currentCard.name}
        </Alert>
      )}

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
