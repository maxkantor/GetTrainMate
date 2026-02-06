import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  IconButton,
} from '@mui/material';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useI18n } from '@/hooks/useI18n';
import { authService } from '@/services/authService';
import { profileService } from '@/services/profileService';
import { matchService } from '@/services/matchService';
import { isGraphQLEnabled, graphqlGetProfile, graphqlLikeUser } from '@/services/graphqlService';
import { handleApiError } from '@/utils/apiErrorHandler';
import { getMultiplePhotoUrls, placeholderPhotoUrl, inferGenderFromName } from '@/utils/profilePhotos';
import { getLocationFromIp, FALLBACK_LOCATION } from '@/services/locationService';
import { buildNearbyDummyProfiles, isDummyNearbyProfile } from '@/data/nearbyDummyProfiles';
import { getLandingProfile, isLandingProfileUserId } from '@/data/landingProfiles';

interface PublicProfilePageProps {
  userIdFromRoute?: string;
}

export const PublicProfilePage: React.FC<PublicProfilePageProps> = ({ userIdFromRoute: userIdProp }) => {
  const location = useLocation();
  const paramsUserId = useParams<{ userId: string }>().userId;
  const userIdFromUrl = paramsUserId ?? (location.pathname.match(/\/profile\/([^/]+)/)?.[1] ?? '');
  const userId = userIdProp ?? userIdFromUrl;
  const navigate = useNavigate();
  const { t } = useI18n();
  const lastFetchedUserId = useRef<string>('');

  const [profile, setProfile] = useState<{
    userId: string;
    name?: string;
    city?: string;
    bio?: string;
    sportTags?: string[];
    level?: string;
    mode?: string;
    photoUrls?: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liking, setLiking] = useState(false);
  const [matched, setMatched] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoErrorForIndex, setPhotoErrorForIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) {
      setError('No profile specified');
      setProfile(null);
      setLoading(false);
      return;
    }
    setProfile(null);
    setError('');
    setPhotoIndex(0);
    setPhotoErrorForIndex(null);
    loadProfile();
  }, [userId]);

  useEffect(() => {
    setPhotoErrorForIndex(null);
  }, [photoIndex]);

  const loadProfile = async () => {
    if (!userId) return;
    const requestedUserId = userId;
    lastFetchedUserId.current = requestedUserId;

    if (isLandingProfileUserId(requestedUserId)) {
      const landing = getLandingProfile(requestedUserId);
      if (!landing) {
        setError('Profile not found');
        setProfile(null);
      } else {
        const photoUrls = getMultiplePhotoUrls(undefined, landing.userId, 4, landing.name);
        setProfile({
          userId: landing.userId,
          name: `${landing.name}, ${landing.age}`,
          city: `${landing.location} · ${landing.distance} away`,
          bio: landing.bio,
          sportTags: landing.tags,
          photoUrls,
        });
      }
      setLoading(false);
      return;
    }

    if (isDummyNearbyProfile(requestedUserId)) {
      let location = await getLocationFromIp();
      if (!location) location = FALLBACK_LOCATION;
      const dummies = buildNearbyDummyProfiles(location);
      const dummy = dummies.find((d) => d.userId === requestedUserId);
      if (!dummy) {
        setError('Profile not found');
        setProfile(null);
      } else {
        setProfile({
          userId: dummy.userId,
          name: dummy.name,
          city: dummy.city,
          bio: dummy.bio,
          sportTags: dummy.sportTags,
          level: dummy.level,
          mode: dummy.mode,
          photoUrls: dummy.photoUrls,
        });
      }
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      if (isGraphQLEnabled) {
        const data = await graphqlGetProfile(requestedUserId);
        if (lastFetchedUserId.current !== requestedUserId) return;
        if (!data) {
          setError('Profile not found');
          setProfile(null);
        } else if (data.userId !== requestedUserId) {
          setError('Profile not found');
          setProfile(null);
        } else {
          setProfile(data as any);
        }
      } else {
        const token = await authService.getJWT();
        if (!token) {
          setError('Not authenticated');
          setLoading(false);
          return;
        }
        const data = await profileService.getProfile(token, requestedUserId);
        if (lastFetchedUserId.current !== requestedUserId) return;
        if (data && (data as { userId?: string }).userId !== requestedUserId) {
          setError('Profile not found');
          setProfile(null);
        } else {
          setProfile(data as any);
        }
      }
    } catch (err: any) {
      if (lastFetchedUserId.current !== requestedUserId) return;
      const apiError = handleApiError(err);
      if (err.response?.status === 404 || err.status === 404) setError('Profile not found');
      else setError(apiError.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!userId || !profile) return;
    if (isDummyNearbyProfile(userId) || isLandingProfileUserId(userId)) {
      setMatched(false);
      return;
    }
    try {
      setLiking(true);
      if (isGraphQLEnabled) {
        const result = await graphqlLikeUser(userId);
        if (result.isMatched) setMatched(true);
      } else {
        const token = await authService.getJWT();
        if (!token) return;
        const result = await matchService.likeUser(token, userId);
        if (result.isMatched) setMatched(true);
      }
    } catch (err: any) {
      console.error('Error liking user:', err);
    } finally {
      setLiking(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error || !profile) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error || 'Profile not found'}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app/discover')}>
          Back to Discover
        </Button>
      </Container>
    );
  }

  if (profile.userId !== userId) {
    return (
      <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  const name = profile.name || 'Unknown';
  const photoUrls = getMultiplePhotoUrls(profile.photoUrls, profile.userId, 4, profile.name);
  const safePhotoIndex = Math.min(photoIndex, photoUrls.length - 1);
  const currentPhotoUrl = photoUrls[safePhotoIndex];
  const photoFailed = photoErrorForIndex === safePhotoIndex;
  const gender = inferGenderFromName(name);
  const displayPhotoUrl = photoFailed
    ? placeholderPhotoUrl(profile.userId, safePhotoIndex, gender)
    : currentPhotoUrl;
  const isDemoProfile = isDummyNearbyProfile(profile.userId) || isLandingProfileUserId(profile.userId);

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/app/discover')}
        sx={{ mb: 2 }}
      >
        Back to Discover
      </Button>

      <Card sx={{ boxShadow: 3 }}>
        <Box sx={{ position: 'relative', bgcolor: 'grey.200' }}>
          <Box
            component="img"
            src={displayPhotoUrl}
            alt={`${name} — photo ${photoIndex + 1} of ${photoUrls.length}`}
            onError={() => setPhotoErrorForIndex(safePhotoIndex)}
            sx={{
              width: '100%',
              height: 400,
              objectFit: 'cover',
              display: 'block',
            }}
          />
          {photoUrls.length > 1 && (
            <>
              <IconButton
                aria-label="Previous photo"
                onClick={() => setPhotoIndex((i) => (i <= 0 ? photoUrls.length - 1 : i - 1))}
                sx={{
                  position: 'absolute',
                  left: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  bgcolor: 'rgba(255,255,255,0.8)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.95)' },
                }}
              >
                <ChevronLeftIcon />
              </IconButton>
              <IconButton
                aria-label="Next photo"
                onClick={() => setPhotoIndex((i) => (i >= photoUrls.length - 1 ? 0 : i + 1))}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  bgcolor: 'rgba(255,255,255,0.8)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.95)' },
                }}
              >
                <ChevronRightIcon />
              </IconButton>
              <Stack
                direction="row"
                justifyContent="center"
                spacing={0.5}
                sx={{
                  position: 'absolute',
                  bottom: 12,
                  left: 0,
                  right: 0,
                }}
              >
                {photoUrls.map((_, i) => (
                  <Box
                    key={i}
                    onClick={() => setPhotoIndex(i)}
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: i === photoIndex ? 'white' : 'rgba(255,255,255,0.5)',
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      '&:hover': { bgcolor: i === photoIndex ? 'white' : 'rgba(255,255,255,0.8)' },
                      transform: i === photoIndex ? 'scale(1.2)' : 'scale(1)',
                    }}
                    aria-label={`Photo ${i + 1}`}
                    role="button"
                  />
                ))}
              </Stack>
            </>
          )}
        </Box>

        <CardContent>
          <Typography variant="h5" component="h2" gutterBottom>
            {name}
            {profile.level && (
              <Typography component="span" variant="body1" color="textSecondary" sx={{ ml: 1 }}>
                · {profile.level.charAt(0).toUpperCase() + profile.level.slice(1)}
              </Typography>
            )}
          </Typography>
          {profile.city && (
            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
              {profile.city}
            </Typography>
          )}
          {profile.bio && (
            <Typography variant="body2" sx={{ mb: 2 }}>{profile.bio}</Typography>
          )}
          {profile.sportTags && profile.sportTags.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
              {profile.sportTags.map((sport) => (
                <Chip key={sport} label={sport} size="small" variant="outlined" />
              ))}
            </Stack>
          )}
          {profile.mode && (
            <Chip label={`Mode: ${profile.mode}`} color="secondary" size="small" sx={{ mt: 1 }} />
          )}
        </CardContent>
      </Card>

      {isDemoProfile && (
        <Alert severity="info" sx={{ mt: 2 }}>
          This is a preview profile. You can&apos;t match or message here. Go to Discover and keep swiping to find real profiles you can like and connect with.
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
        <Button
          fullWidth
          variant="outlined"
          onClick={() => navigate('/app/discover')}
        >
          Back to Discover
        </Button>
        <Button
          fullWidth
          variant="contained"
          color="primary"
          startIcon={<ThumbUpIcon />}
          onClick={handleLike}
          disabled={liking || isDemoProfile}
        >
          {isDemoProfile ? "Can't match (preview)" : liking ? '...' : 'Like'}
        </Button>
      </Stack>

      {matched && (
        <Alert severity="success" sx={{ mt: 3 }}>
          It's a match! You can now chat with {name}.
          <Button size="small" sx={{ ml: 1 }} onClick={() => navigate('/app/chat')}>
            Open Chat
          </Button>
        </Alert>
      )}
    </Container>
  );
};
