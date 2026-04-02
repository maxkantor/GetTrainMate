import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button as MuiButton } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import ChatIcon from '@mui/icons-material/Chat';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { chatService } from '@/services/chatService';
import { authService } from '@/services/authService';
import { isGraphQLEnabled, graphqlUnlockChat } from '@/services/graphqlService';
import { handleApiError, isNetworkError } from '@/utils/apiErrorHandler';
import { matchQueryKeys } from '@/lib/queryKeys';
import { fetchMutualMatchRows, type MutualMatchRow } from '@/services/matchExploreQueries';
import { useNavigate, Link } from 'react-router-dom';
import { formatLookingForLine } from '@/config/modes';
import { UpgradeBanner } from '@/components/discover/UpgradeBanner';
import { ProfileCardSkeleton } from '@/components/ui/Skeleton';
import styles from './Matches.module.css';

type Match = MutualMatchRow;

type SortBy = 'closest' | 'best_match' | 'newest';

export const MatchesPage: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthContext();
  const { me, refreshMe } = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userSub = user?.sub ?? '';

  const {
    data: matches = [],
    isLoading: loading,
    isError,
    error: queryError,
    refetch: refetchMatches,
  } = useQuery({
    queryKey: matchQueryKeys.mutualMatches(userSub),
    queryFn: () => fetchMutualMatchRows(userSub),
    enabled: !!userSub,
  });

  const error = (() => {
    if (!isError || !queryError) return '';
    const apiError = handleApiError(queryError);
    if (isNetworkError(queryError) || apiError.isCorsError) {
      return 'Unable to connect to the API. The backend may not be deployed or CORS is not configured.';
    }
    return apiError.message || 'Failed to load matches';
  })();

  const [unlockingMatchId, setUnlockingMatchId] = useState<string | null>(null);
  const [unlockError, setUnlockError] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('newest');

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
      setUnlockError('');
      setUnlockingMatchId(m.matchId);
      if (isGraphQLEnabled) {
        await graphqlUnlockChat(m.matchId);
      } else {
        const token = await authService.getJWT();
        if (!token) return;
        await chatService.unlockChat(token, m.matchId);
      }
      await refreshMe();
      await queryClient.invalidateQueries({ queryKey: matchQueryKeys.mutualMatches(userSub) });
      navigate(`/app/chat?thread=${m.matchId}`);
    } catch (err) {
      const apiError = handleApiError(err);
      setUnlockError(apiError.message || 'Failed to unlock chat');
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
        <MuiButton fullWidth variant="contained" onClick={() => void refetchMatches()}>
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
      {unlockError ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setUnlockError('')}>
          {unlockError}
        </Alert>
      ) : null}
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
          <article key={match.matchId} className={styles.card}>
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
