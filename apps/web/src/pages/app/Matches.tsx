import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Container,
  Typography,
  CircularProgress,
  Alert,
  Grid,
  Chip,
  Stack,
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
import { useNavigate } from 'react-router-dom';

interface Match {
  matchId: string;
  userId: string;
  name: string;
  photoUrls?: string[];
  bio?: string;
  city?: string;
  level?: string;
  sportTags: string[];
  matchedAt: string;
  compatibilityScore?: number;
  unlockedByMe?: boolean;
}

export const MatchesPage: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthContext();
  const { me, refreshMe } = useMe();
  const navigate = useNavigate();

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unlockingMatchId, setUnlockingMatchId] = useState<string | null>(null);

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    try {
      setLoading(true);
      setError('');
      if (isGraphQLEnabled) {
        const items = await graphqlListMyMatches();
        const transformedMatches: Match[] = (items as { matchId: string; threadId: string; unlockedByMe: boolean; createdAt?: string; otherUserProfile?: { userId: string; displayName: string; city?: string; bio?: string; sports?: string[]; avatarUrl?: string } }[]).map((m) => ({
          matchId: m.matchId,
          userId: m.otherUserProfile?.userId ?? '',
          name: m.otherUserProfile?.displayName ?? 'Unknown User',
          photoUrls: m.otherUserProfile?.avatarUrl ? [m.otherUserProfile.avatarUrl] : [],
          bio: m.otherUserProfile?.bio ?? '',
          city: m.otherUserProfile?.city ?? '',
          sportTags: m.otherUserProfile?.sports ?? [],
          matchedAt: m.createdAt ?? new Date().toISOString(),
          unlockedByMe: m.unlockedByMe,
        }));
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
              return {
                matchId: match.matchId,
                userId: otherUserId,
                name: profile.name || 'Unknown User',
                photoUrls: profile.photoUrls || [],
                bio: profile.bio || '',
                city: profile.city || '',
                level: profile.level || '',
                sportTags: profile.sportTags || [],
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
        setError('Unable to connect to the API. The backend may not be deployed or CORS is not configured. Please check your API configuration.');
      } else {
        setError(apiError.message || 'Failed to load matches');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChat = (m: Match) => {
    if (m.unlockedByMe) {
      navigate(`/app/chat?thread=${m.matchId}`);
    }
  };

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

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error && matches.length === 0) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Alert 
          severity={error.includes('API is not available') ? 'warning' : 'info'}
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
        <Button
          fullWidth
          variant="contained"
          color="primary"
          onClick={loadMatches}
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Container>
    );
  }

  if (matches.length === 0) {
    return (
      <Container maxWidth="md" sx={{ py: 6, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>No matches yet</Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          Matches happen when both users like each other. Unlock chat when you match (1 credit).
        </Typography>
        <Button variant="contained" onClick={() => navigate('/app/discover')}>
          Start Discovering
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
        Your Matches
      </Typography>

      <Grid container spacing={3}>
        {matches.map((match) => (
          <Grid item xs={12} sm={6} md={4} key={match.userId}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                },
              }}
            >
              {match.photoUrls && match.photoUrls.length > 0 ? (
                <CardMedia
                  component="img"
                  height="200"
                  image={match.photoUrls[0]}
                  alt={match.name}
                  sx={{ objectFit: 'cover' }}
                />
              ) : (
                <Box
                  sx={{
                    height: 200,
                    backgroundColor: '#f0f0f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography color="textSecondary">No photo</Typography>
                </Box>
              )}

              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6" component="h2" gutterBottom>
                    {match.name}
                    {match.level && (
                      <Chip
                        label={match.level.charAt(0).toUpperCase() + match.level.slice(1)}
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Typography>
                  {match.city && (
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      {match.city}
                    </Typography>
                  )}
                  {match.compatibilityScore && (
                    <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold', mt: 1 }}>
                      {match.compatibilityScore}% Match
                    </Typography>
                  )}
                </Box>

                {match.bio && (
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2, flexGrow: 1 }}>
                    {match.bio.length > 100 ? `${match.bio.substring(0, 100)}...` : match.bio}
                  </Typography>
                )}

                {match.sportTags && match.sportTags.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                      {match.sportTags.slice(0, 3).map((sport) => (
                        <Chip key={sport} label={sport} size="small" variant="outlined" />
                      ))}
                      {match.sportTags.length > 3 && (
                        <Chip label={`+${match.sportTags.length - 3}`} size="small" variant="outlined" />
                      )}
                    </Stack>
                  </Box>
                )}

                {match.unlockedByMe ? (
                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<ChatIcon />}
                    onClick={() => handleOpenChat(match)}
                    sx={{ mt: 'auto' }}
                  >
                    Open chat
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<LockIcon />}
                    onClick={() => handleUnlockChat(match)}
                    disabled={unlockingMatchId === match.matchId || (me?.credits ?? 0) < 1}
                    sx={{ mt: 'auto' }}
                  >
                    {unlockingMatchId === match.matchId ? 'Unlocking…' : 'Unlock chat (1 credit)'}
                  </Button>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};
