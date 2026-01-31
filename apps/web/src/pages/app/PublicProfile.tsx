import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useI18n } from '@/hooks/useI18n';
import { authService } from '@/services/authService';
import { profileService } from '@/services/profileService';
import { matchService } from '@/services/matchService';
import { handleApiError } from '@/utils/apiErrorHandler';

export const PublicProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();

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

  useEffect(() => {
    if (!userId) {
      setError('No profile specified');
      setLoading(false);
      return;
    }
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError('');
      const token = await authService.getJWT();
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }
      const data = await profileService.getProfile(token, userId);
      setProfile(data as any);
    } catch (err: any) {
      const apiError = handleApiError(err);
      if (err.response?.status === 404) setError('Profile not found');
      else setError(apiError.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!userId || !profile) return;
    try {
      setLiking(true);
      const token = await authService.getJWT();
      if (!token) return;
      const result = await matchService.likeUser(token, userId);
      if (result.isMatched) setMatched(true);
      setLiking(false);
    } catch (err: any) {
      console.error('Error liking user:', err);
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

  const name = profile.name || 'Unknown';
  const photoUrl = profile.photoUrls?.[0];

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
        {photoUrl ? (
          <CardMedia
            component="img"
            height="400"
            image={photoUrl}
            alt={name}
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
            <Typography color="textSecondary">{name}</Typography>
          </Box>
        )}

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
          disabled={liking}
        >
          {liking ? '...' : 'Like'}
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
