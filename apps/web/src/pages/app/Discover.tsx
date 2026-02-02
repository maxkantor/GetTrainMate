import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Container,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Stack,
} from '@mui/material';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { matchService, MatchFeedItem } from '@/services/matchService';
import { authService } from '@/services/authService';
import { handleApiError, isNetworkError } from '@/utils/apiErrorHandler';

export const DiscoverPage: React.FC = () => {
  const { t } = useI18n();
  const { user, logout } = useAuthContext();
  const navigate = useNavigate();
  
  const [feed, setFeed] = useState<MatchFeedItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [matched, setMatched] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async (isRetryAfter401 = false) => {
    try {
      setLoading(true);
      setError('');
      // Use fresh token when retrying after 401
      const token = await authService.getJWT(isRetryAfter401);
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const feedData = await matchService.getDiscoveryFeed(token, 50);
      setFeed(feedData);
      setCurrentIndex(0);
    } catch (err: any) {
      const status = err.response?.status;
      const apiError = handleApiError(err);

      // On 401: try once with refreshed token, then show auth error
      if (status === 401 && !isRetryAfter401) {
        const freshToken = await authService.getJWT(true);
        if (freshToken) {
          try {
            const feedData = await matchService.getDiscoveryFeed(freshToken, 50);
            setFeed(feedData);
            setCurrentIndex(0);
            setLoading(false);
            return;
          } catch (retryErr: any) {
            if (retryErr.response?.status === 401) {
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

      console.error('Error loading feed:', err);
      if (isNetworkError(err) || apiError.isCorsError) {
        setError('Unable to connect to the API. The backend may not be deployed or CORS is not configured. Please check your API configuration.');
      } else if (status === 401) {
        setError('Authentication required. Please sign in again.');
      } else {
        setError(apiError.message || 'Failed to load discovery feed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (currentIndex >= feed.length) return;

    try {
      const token = await authService.getJWT();
      if (!token) return;

      const currentCard = feed[currentIndex];
      const result = await matchService.likeUser(token, currentCard.userId);
      
      if (result.isMatched) {
        setMatched(true);
        setTimeout(() => {
          nextCard();
          setMatched(false);
        }, 1500);
      } else {
        nextCard();
      }
    } catch (err: any) {
      console.error('Error liking user:', err);
    }
  };

  const handleSeedDemo = async () => {
    try {
      setSeeding(true);
      setError('');
      const token = await authService.getJWT();
      if (!token) {
        setError('Not authenticated');
        return;
      }
      const result = await matchService.seedDemoProfiles(token);
      setError('');
      await loadFeed();
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
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error && feed.length === 0) {
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
          onClick={() => loadFeed()}
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Container>
    );
  }

  if (feed.length === 0 && !loading && !error) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>No profiles to discover</Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          Load demo profiles to try matching, or check back later for new training partners!
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap">
          <Button
            variant="contained"
            onClick={handleSeedDemo}
            disabled={seeding}
          >
            {seeding ? 'Loading…' : 'Load demo profiles'}
          </Button>
          <Button variant="outlined" onClick={() => loadFeed()}>
            Refresh
          </Button>
        </Stack>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
        )}
      </Container>
    );
  }

  const currentCard = feed[currentIndex];
  const progress = ((currentIndex + 1) / feed.length) * 100;

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" color="textSecondary">
            {currentIndex + 1} of {feed.length}
          </Typography>
          <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold' }}>
            {currentCard.compatibilityScore}% Match
          </Typography>
        </Box>
        <Box sx={{ width: '100%', height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
          <Box
            sx={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: 'primary.main',
              transition: 'width 0.3s ease',
            }}
          />
        </Box>
      </Box>

      <Card
        sx={{
          boxShadow: matched ? '0 0 30px rgba(25, 118, 210, 0.5)' : 3,
          transition: 'all 0.3s ease',
          transform: matched ? 'scale(1.02)' : 'scale(1)',
        }}
      >
        {currentCard.photoUrls && currentCard.photoUrls.length > 0 ? (
          <CardMedia
            component="img"
            height="400"
            image={currentCard.photoUrls[0]}
            alt={currentCard.name}
            sx={{ objectFit: 'cover' }}
          />
        ) : (
          <Box
            sx={{
              height: 400,
              backgroundColor: '#f0f0f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography color="textSecondary">{t('profile.my_profile')}</Typography>
          </Box>
        )}

        <CardContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h5" component="h2" gutterBottom>
              {currentCard.name}, {currentCard.level ? currentCard.level.charAt(0).toUpperCase() + currentCard.level.slice(1) : 'N/A'}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {currentCard.city || 'Location not set'}
            </Typography>
          </Box>

          {currentCard.bio && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              {currentCard.bio}
            </Typography>
          )}

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Common Sports:
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
              {currentCard.commonSports.length > 0 ? (
                currentCard.commonSports.map((sport) => (
                  <Chip key={sport} label={sport} size="small" color="primary" variant="outlined" />
                ))
              ) : (
                <Typography variant="caption" color="textSecondary">
                  No common sports yet
                </Typography>
              )}
            </Stack>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Sports:
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
              {currentCard.sportTags.map((sport) => (
                <Chip key={sport} label={sport} size="small" variant="outlined" />
              ))}
            </Stack>
          </Box>

          {currentCard.mode && (
            <Box>
              <Chip label={`Mode: ${currentCard.mode}`} color="secondary" />
            </Box>
          )}

          <Button
            fullWidth
            variant="outlined"
            sx={{ mt: 2 }}
            onClick={() => navigate(`/app/profile/${currentCard.userId}`)}
          >
            {t('landing.view_profile')} →
          </Button>
        </CardContent>
      </Card>

      <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
        <Button
          fullWidth
          variant="outlined"
          color="error"
          size="large"
          startIcon={<ThumbDownIcon />}
          onClick={handlePass}
        >
          Pass
        </Button>
        <Button
          fullWidth
          variant="contained"
          color="primary"
          size="large"
          startIcon={<ThumbUpIcon />}
          onClick={handleLike}
        >
          Like
        </Button>
      </Stack>

      {matched && (
        <Alert severity="success" sx={{ mt: 3 }}>
          🎉 It's a match! You can now chat with {currentCard.name}
        </Alert>
      )}
    </Container>
  );
};
