import React, { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  CircularProgress,
  Button as MuiButton,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import ChatIcon from '@mui/icons-material/Chat';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { matchService } from '@/services/matchService';
import { profileService } from '@/services/profileService';
import { chatService } from '@/services/chatService';
import { authService } from '@/services/authService';
import { isGraphQLEnabled, graphqlListMyMatches, graphqlUnlockChat } from '@/services/graphqlService';
import { handleApiError, isNetworkError } from '@/utils/apiErrorHandler';
import { useNavigate, Link } from 'react-router-dom';
import { formatLookingForLine } from '@/config/modes';
import { UpgradeBanner } from '@/components/discover/UpgradeBanner';
import { ProfileCardSkeleton } from '@/components/ui/Skeleton';
import styles from './Matches.module.css';

interface Match {
  matchId: string;
  userId: string;
  name: string;
  photoUrls?: string[];
  bio?: string;
  city?: string;
  level?: string;
  sportTags: string[];
  /** Intent modes from profile (array-based). */
  modes?: string[];
  matchedAt: string;
  compatibilityScore?: number;
  unlockedByMe?: boolean;
}

type SortBy = 'closest' | 'best_match' | 'newest';

export const MatchesPage: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthContext();
  const { me, refreshMe } = useMe();
  const navigate = useNavigate();

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unlockingMatchId, setUnlockingMatchId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('newest');

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    try {
      setLoading(true);
      setError('');
      if (isGraphQLEnabled) {
        const items = await graphqlListMyMatches();
        const transformedMatches: Match[] = (
          items as {
            matchId: string;
            threadId: string;
            unlockedByMe: boolean;
            createdAt?: string;
            otherUserProfile?: {
              userId: string;
              displayName: string;
              city?: string;
              bio?: string;
              sports?: string[];
              avatarUrl?: string;
              modes?: string[];
              mode?: string;
            };
          }[]
        ).map((m) => {
          const op = m.otherUserProfile;
          const modes =
            op?.modes && op.modes.length > 0
              ? op.modes.map(String)
              : op?.mode
                ? [String(op.mode)]
                : [];
          return {
            matchId: m.matchId,
            userId: op?.userId ?? '',
            name: op?.displayName ?? 'Unknown User',
            photoUrls: op?.avatarUrl ? [op.avatarUrl] : [],
            bio: op?.bio ?? '',
            city: op?.city ?? '',
            sportTags: op?.sports ?? [],
            modes,
            matchedAt: m.createdAt ?? new Date().toISOString(),
            unlockedByMe: m.unlockedByMe,
          };
        });
        setMatches(transformedMatches);
      } else {
        const token = await authService.getJWT();
        if (!token) {
          setError('Not authenticated');
          return;
        }

        const matchesData = await matchService.getMyMatches(token);
        const currentUserId = user?.sub ?? '';

        const transformedMatches: Match[] = await Promise.all(
          matchesData.map(async (match: { matchId: string; userId1: string; userId2: string; createdAt?: string; compatibilityScore?: number }) => {
            const otherUserId = match.userId1 === currentUserId ? match.userId2 : match.userId1;
            let unlockedByMe = false;
            try {
              const threadStatus = await chatService.getThreadByMatch(token, match.matchId);
              unlockedByMe = threadStatus.unlockedByCurrentUser;
            } catch {
              // thread may not exist yet
            }
            try {
              const profile = await profileService.getProfile(token, otherUserId);
              const modes =
                profile.modes && profile.modes.length > 0
                  ? profile.modes.map(String)
                  : profile.mode
                    ? [String(profile.mode)]
                    : [];
              return {
                matchId: match.matchId,
                userId: otherUserId,
                name: profile.name || 'Unknown User',
                photoUrls: profile.photoUrls || [],
                bio: profile.bio || '',
                city: profile.city || '',
                level: profile.level || '',
                sportTags: profile.sportTags || [],
                modes,
                matchedAt: match.createdAt || new Date().toISOString(),
                compatibilityScore: match.compatibilityScore || 0,
                unlockedByMe,
              };
            } catch (err) {
              console.error(`Failed to fetch profile for ${otherUserId}:`, err);
              return {
                matchId: match.matchId,
                userId: otherUserId,
                name: 'Unknown User',
                photoUrls: [],
                bio: '',
                city: '',
                level: '',
                sportTags: [],
                modes: [],
                matchedAt: match.createdAt || new Date().toISOString(),
                compatibilityScore: match.compatibilityScore || 0,
                unlockedByMe,
              };
            }
          })
        );

        setMatches(transformedMatches);
      }
    } catch (err: any) {
      console.error('Error loading matches:', err);
      const apiError = handleApiError(err);

      if (isNetworkError(err) || apiError.isCorsError) {
        setError('Unable to connect to the API. The backend may not be deployed or CORS is not configured.');
      } else {
        setError(apiError.message || 'Failed to load matches');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...matches];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.city?.toLowerCase().includes(q) ||
          m.sportTags.some((s) => s.toLowerCase().includes(q))
      );
    }
    if (sortBy === 'best_match') {
      result.sort((a, b) => (b.compatibilityScore ?? 0) - (a.compatibilityScore ?? 0));
    } else if (sortBy === 'newest') {
      result.sort((a, b) => new Date(b.matchedAt).getTime() - new Date(a.matchedAt).getTime());
    }
    return result;
  }, [matches, search, sortBy]);

  const handleUnlockChat = async (m: Match) => {
    if (unlockingMatchId || (me?.credits ?? 0) < 1) return;
    try {
      setUnlockingMatchId(m.matchId);
      if (isGraphQLEnabled) {
        await graphqlUnlockChat(m.matchId);
      } else {
        const token = await authService.getJWT();
        if (!token) return;
        await chatService.unlockChat(token, m.matchId);
      }
      await refreshMe();
      setMatches((prev) =>
        prev.map((x) => (x.matchId === m.matchId ? { ...x, unlockedByMe: true } : x))
      );
      navigate(`/app/chat?thread=${m.matchId}`);
    } catch (err) {
      const apiError = handleApiError(err);
      setError(apiError.message || 'Failed to unlock chat');
    } finally {
      setUnlockingMatchId(null);
    }
  };

  const credits = me?.credits ?? 0;

  if (loading) {
    return (
      <div className={styles.container}>
        <ProfileCardSkeleton />
      </div>
    );
  }

  if (error && matches.length === 0) {
    return (
      <div className={styles.container}>
        <Alert severity={error.includes('API') ? 'warning' : 'info'} sx={{ mb: 2 }}>
          {error}
        </Alert>
        <MuiButton fullWidth variant="contained" onClick={loadMatches}>
          Retry
        </MuiButton>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>No matches yet</h2>
          <p className={styles.emptyDesc}>
            Matches happen when both users like each other. Unlock chat when you match (1 credit).
          </p>
          <Link to="/app/discover" className={styles.emptyBtn}>
            Start Discovering
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Your Matches</h1>
      <div className={styles.subNav}>
        {me?.profile?.discoverCanReviewLikedProfiles !== false ? (
          <Link to="/app/sent-requests">Sent requests</Link>
        ) : null}
        {me?.profile?.discoverCanReviewSkippedProfiles !== false ? (
          <Link to="/app/skipped">Skipped</Link>
        ) : null}
        <Link to="/app/discover">Discover</Link>
      </div>

      {credits < 1 && <UpgradeBanner message="Get credits to unlock chat with your matches." />}

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <input
            type="search"
            placeholder="Search by name, city, sports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
            aria-label="Search matches"
          />
        </div>
        <select
          className={styles.sortSelect}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
        >
          <option value="newest">Newest first</option>
          <option value="best_match">Best match</option>
          <option value="closest">Closest</option>
        </select>
      </div>

      <div className={styles.grid}>
        {filteredAndSorted.map((match) => (
          <article key={match.userId} className={styles.card}>
            {match.photoUrls && match.photoUrls.length > 0 ? (
              <img
                src={match.photoUrls[0]}
                alt={match.name}
                className={styles.cardImage}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className={styles.cardImagePlaceholder}>
                {match.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className={styles.cardContent}>
              <h2 className={styles.cardName}>
                {match.name}
                {match.level && (
                  <span className={styles.chip} style={{ marginLeft: 8 }}>
                    {match.level.charAt(0).toUpperCase() + match.level.slice(1)}
                  </span>
                )}
              </h2>
              <p className={styles.cardMeta}>
                {match.city && `${match.city} · `}
                {match.compatibilityScore ? `${match.compatibilityScore}% match` : 'Mutual match'}
              </p>
              {match.modes && match.modes.length > 0 ? (
                <p className={styles.cardModes}>{formatLookingForLine(match.modes)}</p>
              ) : null}
              {match.bio && (
                <p className={styles.cardBio}>
                  {match.bio.length > 100 ? `${match.bio.substring(0, 100)}...` : match.bio}
                </p>
              )}
              {match.sportTags && match.sportTags.length > 0 && (
                <div className={styles.chips}>
                  {match.sportTags.slice(0, 3).map((sport) => (
                    <span key={sport} className={styles.chip}>{sport}</span>
                  ))}
                  {match.sportTags.length > 3 && (
                    <span className={styles.chip}>+{match.sportTags.length - 3}</span>
                  )}
                </div>
              )}

              {match.unlockedByMe ? (
                <Link
                  to={`/app/chat?thread=${match.matchId}`}
                  className={styles.chatBtn}
                >
                  <ChatIcon sx={{ fontSize: 20 }} />
                  Open chat
                </Link>
              ) : (
                <button
                  type="button"
                  className={styles.unlockBtn}
                  onClick={() => handleUnlockChat(match)}
                  disabled={unlockingMatchId === match.matchId || credits < 1}
                >
                  <LockIcon sx={{ fontSize: 20 }} />
                  {unlockingMatchId === match.matchId ? 'Unlocking…' : 'Unlock chat (1 credit)'}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
