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
  Snackbar,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useI18n } from '@/hooks/useI18n';
import { formatI18n } from '@/i18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { authService } from '@/services/authService';
import { profileService } from '@/services/profileService';
import { matchService } from '@/services/matchService';
import { getMatchInsight, isInsufficientCreditsError, getAiErrorMessage } from '@/services/aiService';
import { loadPremiumCatalog, PREMIUM_ACTION } from '@/config/premiumCatalog';
import { trackPremiumAction } from '@/utils/analytics';
import { isGraphQLEnabled, graphqlGetProfile, graphqlLikeUser, graphqlPassUser } from '@/services/graphqlService';
import { MatchPanel } from './discover/MatchPanel';
import { handleApiError } from '@/utils/apiErrorHandler';
import { getMultiplePhotoUrls, NO_PHOTO_PLACEHOLDER } from '@/utils/profilePhotos';
import { getDiscoverDemoCard, isDummyNearbyProfile } from '@/data/nearbyDummyProfiles';
import { getLandingProfile, isLandingProfileUserId } from '@/data/landingProfiles';
import { incrementDailyLike, canSendLikeWithDailyCap } from '@/utils/dailySwipeTracker';
import { DAILY_LIKE_LIMIT } from '@/config/appLimits';
import { formatLookingForLine, getDiscoverPrimaryCta } from '@/config/modes';

interface PublicProfilePageProps {
  userIdFromRoute?: string;
}

function scheduleSummary(schedule: { days?: string[]; timeStart?: string; timeEnd?: string }[] | undefined): string {
  if (!schedule?.length) return '';
  return schedule.map((s) => `${(s.days ?? []).join('/')} ${s.timeStart ?? ''}-${s.timeEnd ?? ''}`).join('; ');
}

export const PublicProfilePage: React.FC<PublicProfilePageProps> = ({ userIdFromRoute: userIdProp }) => {
  const { user } = useAuthContext();
  const dailyLikeUserId = user?.sub ?? undefined;
  const location = useLocation();
  const paramsUserId = useParams<{ userId: string }>().userId;
  const userIdFromUrl = paramsUserId ?? (location.pathname.match(/\/profile\/([^/]+)/)?.[1] ?? '');
  const userId = userIdProp ?? userIdFromUrl;
  const navigate = useNavigate();
  const { t } = useI18n();
  const { me, refreshMe } = useMe();
  const lastFetchedUserId = useRef<string>('');

  const [profile, setProfile] = useState<{
    userId: string;
    name?: string;
    city?: string;
    bio?: string;
    sportTags?: string[];
    level?: string;
    mode?: string;
    modes?: string[];
    photoUrls?: string[];
    goals?: string[];
    availabilitySchedule?: { days?: string[]; timeStart?: string; timeEnd?: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liking, setLiking] = useState(false);
  const [matched, setMatched] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoErrorForIndex, setPhotoErrorForIndex] = useState<number | null>(null);
  const [compatibility, setCompatibility] = useState<{
    compatibilityScore: number;
    commonSports: string[];
    level?: string;
    city?: string;
    mode?: string;
  } | null>(null);
  const [insightMap, setInsightMap] = useState<Record<string, { summary: string; reasons: string[]; caution?: string }>>({});
  const [loadingInsightFor, setLoadingInsightFor] = useState<string | null>(null);
  const [aiInsightCost, setAiInsightCost] = useState(2);
  const [toast, setToast] = useState<string | null>(null);

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

  useEffect(() => {
    if (!profile || isDummyNearbyProfile(profile.userId) || isLandingProfileUserId(profile.userId)) {
      setCompatibility(null);
      return;
    }
    const load = async () => {
      const token = await authService.getJWT();
      if (!token) return;
      try {
        const info = await matchService.getCompatibility(token, profile.userId);
        setCompatibility(info ?? null);
      } catch {
        setCompatibility(null);
      }
    };
    load();
  }, [profile?.userId]);

  useEffect(() => {
    void (async () => {
      try {
        const cat = await loadPremiumCatalog();
        setAiInsightCost(cat.costs[PREMIUM_ACTION.deeperMatchInsight] ?? 2);
      } catch {
        setAiInsightCost(2);
      }
    })();
  }, []);

  const handleUnlockAiInsight = async () => {
    if (!profile || !me?.user?.id) return;
    if (isDummyNearbyProfile(profile.userId) || isLandingProfileUserId(profile.userId)) return;
    const token = await authService.getJWT(true);
    if (!token) {
      setToast('Please sign in again.');
      return;
    }
    if ((me?.credits ?? 0) < aiInsightCost) {
      const need = aiInsightCost - (me?.credits ?? 0);
      setToast(
        need === 1
          ? t('credits.need_more_credits_one')
          : formatI18n(t('credits.need_more_credits_many'), { need })
      );
      return;
    }
    setLoadingInsightFor(profile.userId);
    const myProfile = me.profile;
    const request = {
      userId: me.user.id,
      targetUserId: profile.userId,
      myName: myProfile?.name,
      myBio: myProfile?.bio,
      mySports: myProfile?.sportTags ?? [],
      myLevel: myProfile?.level,
      myGoals: myProfile?.goals ?? [],
      myScheduleSummary: scheduleSummary(myProfile?.availabilitySchedule),
      otherName: profile.name,
      otherBio: profile.bio,
      otherSports: profile.sportTags ?? [],
      otherLevel: profile.level,
      otherGoals: [],
      otherScheduleSummary: undefined,
      compatibilityScore: compatibility?.compatibilityScore ?? 50,
    };
    try {
      const result = await getMatchInsight(token, request);
      setInsightMap((prev) => ({ ...prev, [profile.userId]: result }));
      await refreshMe();
      trackPremiumAction('deeper_match_insight', 'success');
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        setToast(t('app_messages.session_expired'));
        return;
      }
      if (isInsufficientCreditsError(err)) {
        trackPremiumAction('deeper_match_insight', 'insufficient_credits');
        setToast(t('app_messages.not_enough_credits'));
      } else {
        setToast(getAiErrorMessage(err));
      }
    } finally {
      setLoadingInsightFor(null);
    }
  };

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
        const photoUrls = getMultiplePhotoUrls(undefined, landing.seedUserId, 4, landing.name);
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
      const dummy = getDiscoverDemoCard(requestedUserId);
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
          modes: dummy.modes,
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

  const handleSkipPass = async () => {
    if (!userId || !profile) return;
    if (isDummyNearbyProfile(userId) || isLandingProfileUserId(userId)) return;
    try {
      if (isGraphQLEnabled) {
        await graphqlPassUser(userId);
      } else {
        const token = await authService.getJWT(true);
        if (!token) {
          setToast('Please sign in again.');
          return;
        }
        await matchService.passUser(token, userId);
      }
      setToast(t('discover.skipped_toast'));
      navigate('/app/discover');
    } catch {
      setToast(t('discover.could_not_skip'));
    }
  };

  const handleWantToTrain = async () => {
    if (!userId || !profile) return;
    if (isDummyNearbyProfile(userId) || isLandingProfileUserId(userId)) {
      setMatched(false);
      return;
    }
    if (!canSendLikeWithDailyCap(me?.credits ?? 0, dailyLikeUserId)) {
      setToast(formatI18n(t('app_messages.daily_limit'), { limit: DAILY_LIKE_LIMIT }));
      return;
    }
    const creditBefore = me?.credits ?? 0;
    try {
      setLiking(true);
      if (isGraphQLEnabled) {
        const result = await graphqlLikeUser(userId);
        if (creditBefore === 0) incrementDailyLike(dailyLikeUserId);
        await refreshMe();
        if (result.isMatched) {
          setMatched(true);
        } else {
          setToast(t('discover.interest_sent'));
        }
      } else {
        const token = await authService.getJWT(true);
        if (!token) {
          setToast('Please sign in again.');
          return;
        }
        const result = await matchService.likeUser(token, userId);
        if (creditBefore === 0) incrementDailyLike(dailyLikeUserId);
        await refreshMe();
        if (result.isMatched) {
          setMatched(true);
        } else {
          setToast(t('discover.interest_sent'));
        }
      }
    } catch (err: unknown) {
      const apiError = handleApiError(err);
      setToast(apiError.message || t('app_messages.could_not_send_interest'));
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
  const safePhotoIndex = Math.min(photoIndex, Math.max(0, photoUrls.length - 1));
  const currentPhotoUrl = photoUrls[safePhotoIndex];
  const photoFailed = photoErrorForIndex === safePhotoIndex;
  const displayPhotoUrl = photoFailed || !currentPhotoUrl ? NO_PHOTO_PLACEHOLDER : currentPhotoUrl;
  const canNavigatePhotos = photoUrls.length > 1;
  const isDemoProfile = isDummyNearbyProfile(profile.userId) || isLandingProfileUserId(profile.userId);

  const viewerModeList =
    me?.profile?.modes && me.profile.modes.length > 0
      ? me.profile.modes.map(String)
      : me?.profile?.mode
        ? [me.profile.mode]
        : undefined;
  const cardModesForCta =
    profile.modes && profile.modes.length > 0
      ? profile.modes.map(String)
      : profile.mode
        ? [profile.mode]
        : undefined;
  const primaryInterestLabel = getDiscoverPrimaryCta(viewerModeList, cardModesForCta).label;

  return (
    <Container maxWidth="sm" sx={{ py: 4, pb: 10 }}>
      <Card sx={{ boxShadow: 3 }}>
        <Box sx={{ position: 'relative', bgcolor: 'grey.200' }}>
          <Box
            component="img"
            src={displayPhotoUrl}
            alt={`${name} — photo ${photoIndex + 1} of ${photoUrls.length}`}
            onError={() => setPhotoErrorForIndex(safePhotoIndex)}
            sx={{
              width: '100%',
              height: { xs: 360, sm: 420 },
              maxHeight: 520,
              objectFit: 'cover',
              /* Default center crop cuts foreheads on portrait uploads; anchor to top. */
              objectPosition: 'center top',
              display: 'block',
            }}
          />
          {canNavigatePhotos && (
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
          {(profile.modes && profile.modes.length > 0) || profile.mode ? (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              {profile.modes && profile.modes.length > 0
                ? formatLookingForLine(profile.modes)
                : `Looking for: ${profile.mode}`}
            </Typography>
          ) : null}
          {profile.goals && profile.goals.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                Goals
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {profile.goals.map((g) => (
                  <Chip key={g} label={g} size="small" variant="outlined" />
                ))}
              </Stack>
            </Box>
          )}
          {profile.availabilitySchedule && profile.availabilitySchedule.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              <strong>Availability:</strong> {scheduleSummary(profile.availabilitySchedule)}
            </Typography>
          )}
        </CardContent>
      </Card>

      {!isDemoProfile && (
        <MatchPanel
          score={compatibility?.compatibilityScore ?? 50}
          reasons={[
            ...(compatibility?.commonSports?.length
              ? [`${compatibility.commonSports.length} common sports`]
              : []),
            compatibility?.level ? `Similar level (${compatibility.level})` : null,
            compatibility?.city ? 'Distance near you' : null,
          ].filter(Boolean) as string[]}
          aiMatchInsightFull={insightMap[profile.userId]}
          aiInsightCreditCost={aiInsightCost}
          onUnlockAiInsight={handleUnlockAiInsight}
          aiInsightLoading={loadingInsightFor === profile.userId}
          compact
        />
      )}

      {isDemoProfile && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Preview only — open Discover to send interest to real members.
        </Alert>
      )}

      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          zIndex: 3,
          mt: 3,
          pt: 2,
          pb: { xs: 2, sm: 2.5 },
          mx: { xs: -1, sm: 0 },
          px: { xs: 1, sm: 0 },
          bgcolor: 'background.default',
          borderTop: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.35)',
        }}
      >
        <Stack spacing={1.25}>
          <Button fullWidth variant="outlined" onClick={() => navigate('/app/discover')}>
            Back to Discover
          </Button>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              fullWidth
              variant="outlined"
              onClick={handleSkipPass}
              disabled={isDemoProfile}
            >
              {t('discover.skip')}
            </Button>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={handleWantToTrain}
              disabled={liking || isDemoProfile}
            >
              {isDemoProfile
                ? 'Preview'
                : liking
                  ? <CircularProgress size={22} color="inherit" />
                  : primaryInterestLabel}
            </Button>
          </Stack>
        </Stack>
      </Box>

      {matched && (
        <Alert severity="success" sx={{ mt: 3 }}>
          It's a match! You can now chat with {name}.
          <Button size="small" sx={{ ml: 1 }} onClick={() => navigate('/app/chat')}>
            Open Chat
          </Button>
        </Alert>
      )}

      <Snackbar
        open={!!toast}
        autoHideDuration={5200}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 24, sm: 32 } }}
      />
    </Container>
  );
};
