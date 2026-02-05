import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import PersonIcon from '@mui/icons-material/Person';
import LinkIcon from '@mui/icons-material/Link';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { matchService, MatchFeedItem } from '@/services/matchService';
import { authService } from '@/services/authService';
import { isGraphQLEnabled, graphqlDiscoverCandidates, graphqlLikeUser, graphqlSeedDemoData } from '@/services/graphqlService';
import { handleApiError, getErrorMessage, isNetworkError } from '@/utils/apiErrorHandler';
import { IMAGE_BUCKET_BASE } from '@/config/media';
import styles from './Discover.module.css';

/** Person portraits for placeholder avatars (randomuser.me: men/women 1–99). */
function placeholderPersonUrl(userId: string): string {
  const n = userId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const idx = (n % 99) + 1;
  const gender = n % 2 === 0 ? 'women' : 'men';
  return `https://randomuser.me/api/portraits/${gender}/${idx}.jpg`;
}

/** Backend may return avatarUrl as full URL or S3 key; normalize to full URL for img src. Never return undefined for discover cards - use person placeholder so there is always a photo. */
function toPhotoUrl(avatarUrl: string | undefined, userId: string): string {
  if (avatarUrl && (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://'))) return avatarUrl;
  if (avatarUrl) return `${IMAGE_BUCKET_BASE}/${avatarUrl.replace(/^\//, '')}`;
  return placeholderPersonUrl(userId);
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
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadFeed();
  }, []);

  // Reset photo error when changing card (must be at top level with other hooks)
  useEffect(() => {
    setPhotoErrorForIndex(null);
  }, [currentIndex]);

  const loadFeed = async (isRetryAfter401 = false) => {
    try {
      setLoading(true);
      setError('');
      if (isGraphQLEnabled) {
        const result = await graphqlDiscoverCandidates(50);
        const items = (result.items || []) as { userId: string; displayName: string; city?: string; bio?: string; sports?: string[]; avatarUrl?: string; compatibilityScore?: number }[];
        const feedData: MatchFeedItem[] = items.map((c) => {
          const url = toPhotoUrl(c.avatarUrl, c.userId);
          return {
            userId: c.userId,
            name: c.displayName,
            city: c.city,
            bio: c.bio ?? undefined,
            sportTags: c.sports ?? [],
            photoUrls: [url],
            compatibilityScore: c.compatibilityScore ?? 50,
            commonSports: c.sports ?? [],
            mode: 'TRAIN',
          };
        });
        setFeed(feedData);
        setCurrentIndex(0);
        setPhotoErrorForIndex(null);
      } else {
        const token = await authService.getJWT(isRetryAfter401);
        if (!token) {
          setError('Not authenticated');
          setLoading(false);
          return;
        }
        const feedData = await matchService.getDiscoveryFeed(token, 50);
        setFeed(feedData);
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
              const feedData: MatchFeedItem[] = items.map((c) => {
                const url = toPhotoUrl(c.avatarUrl, c.userId);
                return {
                  userId: c.userId,
                  name: c.displayName,
                  city: c.city,
                  bio: c.bio ?? undefined,
                  sportTags: c.sports ?? [],
                  photoUrls: [url],
                  compatibilityScore: c.compatibilityScore ?? 50,
                  commonSports: c.sports ?? [],
                  mode: 'TRAIN',
                };
              });
              setFeed(feedData);
              setCurrentIndex(0);
            } else {
              const feedData = await matchService.getDiscoveryFeed(freshToken!, 50);
              setFeed(feedData);
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

    try {
      setLikeLoading(true);
      const currentCard = feed[currentIndex];
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
        await graphqlSeedDemoData();
        setError('');
        await loadFeed();
      } else {
        const token = await authService.getJWT();
        if (!token) {
          setError('Not authenticated');
          return;
        }
        await matchService.seedDemoProfiles(token);
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

    try {
      if (isGraphQLEnabled) {
        nextCard();
        return;
      }
      const token = await authService.getJWT();
      if (!token) return;

      const currentCard = feed[currentIndex];
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
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
          <CircularProgress />
        </Box>
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
  const primaryPhotoUrl = (currentCard.photoUrls && currentCard.photoUrls[0]) || placeholderPersonUrl(currentCard?.userId || '');
  const displayPhotoUrl = photoFailed ? placeholderPersonUrl(currentCard?.userId || '') : primaryPhotoUrl;
  const levelLabel = currentCard.level ? currentCard.level.charAt(0).toUpperCase() + currentCard.level.slice(1) : null;

  const handleViewProfile = () => {
    const uid = currentUserIdRef.current;
    if (uid) navigate(`/app/profile/${uid}`);
  };

  return (
    <div className={styles.container}>
      <p className={styles.creditsStrip}>
        <strong>Credits: {credits}</strong> · Like costs 1 credit
      </p>

      <div className={styles.headerRow}>
        <span className={styles.headerCount}>{currentIndex + 1} of {feed.length}</span>
        <span className={styles.headerMatch}>{currentCard.compatibilityScore}% Match</span>
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      <article
        role="button"
        tabIndex={0}
        className={`${styles.cardStack} ${styles.cardClickable} ${matched ? styles.cardStackMatched : ''}`}
        aria-label={`Profile card: ${currentCard.name}. Click to view full profile.`}
        onClick={handleViewProfile}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleViewProfile(); } }}
      >
        <div className={styles.mediaWrap}>
          <img
            src={displayPhotoUrl}
            alt={currentCard.name}
            className={styles.mediaImage}
            onError={() => setPhotoErrorForIndex(currentIndex)}
            referrerPolicy="no-referrer"
          />
          <div className={styles.mediaOverlay} aria-hidden />
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
      </article>

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
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.actionBtnConnect}`}
          onClick={handleViewProfile}
          aria-label={`View full profile of ${currentCard.name}`}
        >
          <LinkIcon aria-hidden sx={{ fontSize: 22 }} />
          Connect
        </button>
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
    </div>
  );
};
