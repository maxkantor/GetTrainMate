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
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { matchService } from '@/services/matchService';
import { authService } from '@/services/authService';
import { handleApiError, isNetworkError } from '@/utils/apiErrorHandler';
import { useNavigate } from 'react-router-dom';

interface Match {
  userId: string;
  name: string;
  photoUrls?: string[];
  bio?: string;
  city?: string;
  level?: string;
  sportTags: string[];
  matchedAt: string;
  compatibilityScore?: number;
}

export const MatchesPage: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthContext();
  const navigate = useNavigate();
  
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    try {
      setLoading(true);
      setError('');
      const token = await authService.getJWT();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      // Get matches from the API
      const matchesData = await matchService.getMatches(token);
      setMatches(matchesData);
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

  const handleChat = (matchUserId: string) => {
    navigate(`/app/chat?thread=${matchUserId}`);
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
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>No matches yet</Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          Start discovering profiles to find your perfect training partner!
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

                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => handleChat(match.userId)}
                  sx={{ mt: 'auto' }}
                >
                  Start Chat
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};
