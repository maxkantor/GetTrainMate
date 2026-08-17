import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  FormLabel,
  FormControlLabel,
  Switch,
  Card,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete,
  Checkbox,
} from '@mui/material';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useI18n } from '@/hooks/useI18n';
import { useMe } from '@/hooks/useMe';
import { useAuthContext } from '@/hooks/useAuthContext';
import { profileService, UpdateProfileRequest, AvailabilitySlot } from '@/services/profileService';
import { getUploadLimits } from '@/config/uploadLimits';
import { PROFILE_SPORTS } from '@/constants/profileSports';
import { PhotoCropModal } from '@/components/profile/PhotoCropModal';
import { authService } from '@/services/authService';
import { handleApiError, isNetworkError } from '@/utils/apiErrorHandler';
import { getProfileOptimize, getAiErrorMessage } from '@/services/aiService';
import type { ProfileOptimizeResponse } from '@/types/ai';
import { loadPremiumCatalog, PREMIUM_ACTION, creditPhrase } from '@/config/premiumCatalog';
import { activateProfileBoost24h, unlockRevealLikes } from '@/services/premiumService';
import { matchQueryKeys } from '@/lib/queryKeys';
import { trackPremiumAction } from '@/utils/analytics';
import { InviteTrainingPartnerButton } from '@/components/referral/InviteTrainingPartnerButton';

const TRAINING_GOALS = [
  'Lose fat',
  'Build muscle',
  'Race prep',
  'Improve endurance',
  'Increase strength',
  'Stay active',
  'Social connection',
  'Competition',
] as const;

const LEVELS = ['beginner', 'intermediate', 'advanced', 'pro'];

const SPORT_CHECKBOX_ICON = <CheckBoxOutlineBlankIcon fontSize="small" />;
const SPORT_CHECKBOX_CHECKED_ICON = <CheckBoxIcon fontSize="small" />;

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_SLOTS = [
  { label: 'Early Morning (6-9 AM)', start: '06:00', end: '09:00' },
  { label: 'Morning (9-12 PM)', start: '09:00', end: '12:00' },
  { label: 'Afternoon (12-5 PM)', start: '12:00', end: '17:00' },
  { label: 'Evening (5-9 PM)', start: '17:00', end: '21:00' },
  { label: 'Night (9 PM-12 AM)', start: '21:00', end: '00:00' },
];

type ProfileBaseline = { form: UpdateProfileRequest; photoKeys: string[] };

function cloneForm(f: UpdateProfileRequest): UpdateProfileRequest {
  return {
    ...f,
    sportTags: [...(f.sportTags || [])],
    goals: [...(f.goals || [])],
    modes: f.modes ? [...f.modes] : undefined,
    availabilitySchedule: (f.availabilitySchedule || []).map((s) => ({
      days: [...(s.days || [])],
      timeStart: s.timeStart,
      timeEnd: s.timeEnd,
    })),
    chatNotificationsEnabled: f.chatNotificationsEnabled,
    chatNotificationFrequency: f.chatNotificationFrequency,
  };
}

function snapshotProfile(form: UpdateProfileRequest, photoKeys: string[]): string {
  return JSON.stringify({ form, photoKeys });
}

function createEmptyProfileForm(): UpdateProfileRequest {
  return {
    name: '',
    city: '',
    state: '',
    country: 'US',
    bio: '',
    sportTags: [],
    level: '',
    goals: [],
    availabilitySchedule: [],
    mode: 'TRAIN',
    modes: ['TRAIN'],
    chatNotificationsEnabled: true,
    chatNotificationFrequency: 'smart',
    favoriteSports: [],
    favoriteTeams: [],
    activeEventIds: [],
    eventActivities: [],
  };
}

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { me, refreshMe } = useMe();
  const { user } = useAuthContext();
  const userSub = user?.sub ?? '';
  const uploadLimits = useMemo(() => getUploadLimits(me?.credits ?? 0), [me?.credits]);

  const [profileAiCost, setProfileAiCost] = useState(2);
  const [boostCost, setBoostCost] = useState(2);
  const [revealCost, setRevealCost] = useState(3);
  const [premiumBoostLoading, setPremiumBoostLoading] = useState(false);
  const [premiumRevealLoading, setPremiumRevealLoading] = useState(false);
  const [premiumToast, setPremiumToast] = useState<string | null>(null);

  useEffect(() => {
    void loadPremiumCatalog().then((cat) => {
      setProfileAiCost(cat.costs[PREMIUM_ACTION.aiProfileRewrite] ?? 2);
      setBoostCost(cat.costs[PREMIUM_ACTION.profileBoost24h] ?? 2);
      setRevealCost(cat.costs[PREMIUM_ACTION.revealLikes] ?? 3);
    });
  }, []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [error, setError] = useState('');
  const [myPhotos, setMyPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [snack, setSnack] = useState<{open: boolean; message: string; severity: 'success'|'error'|'info'}>({open: false, message: '', severity: 'success'});
  const [photoKeys, setPhotoKeys] = useState<string[]>([]);
  const [cropOpen, setCropOpen] = useState(false);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const [baseline, setBaseline] = useState<ProfileBaseline | null>(null);
  const [discardModalOpen, setDiscardModalOpen] = useState(false);
  const [sectionHint, setSectionHint] = useState<{ photo?: boolean; availability?: boolean; mode?: boolean }>({});
  const formDataRef = useRef<UpdateProfileRequest | null>(null);
  const baselineRef = useRef<ProfileBaseline | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistInFlightRef = useRef(false);
  const photoKeysRef = useRef<string[]>([]);

  const [formData, setFormData] = useState<UpdateProfileRequest>(() => createEmptyProfileForm());
  const [aiSuggestions, setAiSuggestions] = useState<ProfileOptimizeResponse | null>(null);
  const [aiSuggestionsLoading, setAiSuggestionsLoading] = useState(false);
  const [aiSuggestionsError, setAiSuggestionsError] = useState('');

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  useEffect(() => {
    baselineRef.current = baseline;
  }, [baseline]);

  useEffect(() => {
    photoKeysRef.current = photoKeys;
  }, [photoKeys]);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const token = await authService.getJWT();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const profile = await profileService.getMyProfile(token);
      const nextForm: UpdateProfileRequest = {
        name: profile.name || '',
        city: profile.city || '',
        state: profile.state || '',
        country: profile.country || 'US',
        bio: profile.bio || '',
        sportTags: profile.sportTags || [],
        level: profile.level || '',
        goals: profile.goals || [],
        availabilitySchedule: profile.availabilitySchedule || [],
        mode: profile.mode || 'TRAIN',
        modes:
          profile.modes && profile.modes.length > 0
            ? profile.modes
            : profile.mode
              ? [profile.mode]
              : ['TRAIN'],
        workoutStyle: profile.workoutStyle,
        personalityTag: profile.personalityTag,
        chatNotificationsEnabled: profile.chatNotificationsEnabled !== false,
        chatNotificationFrequency: (profile.chatNotificationFrequency as 'realtime' | 'smart' | 'daily') || 'smart',
        favoriteSports: profile.favoriteSports || [],
        favoriteTeams: profile.favoriteTeams || [],
        activeEventIds: profile.activeEventIds || [],
        eventActivities: profile.eventActivities || [],
      };
      setFormData(nextForm);
      const keys =
        profile.photoKeys && profile.photoKeys.length > 0
          ? [...profile.photoKeys]
          : profile.photoKey
            ? [profile.photoKey]
            : [];
      setPhotoKeys(keys);
      setBaseline({ form: cloneForm(nextForm), photoKeys: [...keys] });
      if (keys.length > 0) {
        try {
          const urls = await Promise.all(
            keys.map(async (key) => {
              try {
                return await profileService.getPhotoUrl(token, key);
              } catch {
                return `https://gettrainmate-media-bucket.s3.us-east-1.amazonaws.com/${key}`;
              }
            })
          );
          setMyPhotos(urls);
        } catch (err) {
          console.error('Error loading photo URLs:', err);
          setMyPhotos([]);
        }
      } else {
        setMyPhotos(profile.photoUrls || []);
      }
    } catch (err: unknown) {
      console.error('Error loading profile:', err);
      const apiError = handleApiError(err);
      if (isNetworkError(err) || apiError.isCorsError) {
        setError('Unable to connect to the API. Please check your connection and try again.');
      } else {
        setError(apiError.message || 'Failed to load profile');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userSub) {
      setFormData(createEmptyProfileForm());
      setPhotoKeys([]);
      setMyPhotos([]);
      setBaseline(null);
      setLoading(false);
      return;
    }
    setFormData(createEmptyProfileForm());
    setPhotoKeys([]);
    setMyPhotos([]);
    setBaseline(null);
    void loadProfile();
  }, [userSub, loadProfile]);

  useEffect(() => {
    if (loading) return;
    if (searchParams.get('focus') !== 'photos') return;
    const id = window.setTimeout(() => {
      document.getElementById('profile-photos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => window.clearTimeout(id);
  }, [loading, searchParams]);

  const boostActive = useMemo(() => {
    if (!me?.boostExpiresAtUtc) return false;
    const ms = Date.parse(me.boostExpiresAtUtc);
    return !Number.isNaN(ms) && ms > Date.now();
  }, [me?.boostExpiresAtUtc]);

  const isDirty = useMemo(() => {
    if (!baseline) return false;
    return snapshotProfile(formData, photoKeys) !== snapshotProfile(baseline.form, baseline.photoKeys);
  }, [baseline, formData, photoKeys]);

  const showSectionHint = useCallback((key: 'photo' | 'availability' | 'mode') => {
    setSectionHint((h) => ({ ...h, [key]: true }));
    window.setTimeout(() => {
      setSectionHint((h) => ({ ...h, [key]: false }));
    }, 2800);
  }, []);

  const persistProfile = useCallback(
    async (kind: 'manual' | 'auto'): Promise<boolean> => {
      const fd = formDataRef.current;
      if (!fd) return false;
      if (persistInFlightRef.current) return false;
      persistInFlightRef.current = true;
      try {
        const token = await authService.getJWT();
        if (!token) {
          setSnack({ open: true, message: 'Not authenticated', severity: 'error' });
          return false;
        }
        if (kind === 'manual') setSaving(true);
        if (kind === 'auto') setAutoSaving(true);

        await profileService.updateMyProfile(token, {
          ...fd,
          photoKeys: photoKeysRef.current,
        });
        const prevBaseline = baselineRef.current;
        setBaseline({ form: cloneForm(fd), photoKeys: [...photoKeysRef.current] });
        await refreshMe();
        if (kind === 'manual') {
          setSnack({ open: true, message: 'Profile updated successfully', severity: 'success' });
          if (
            prevBaseline &&
            JSON.stringify(fd.modes ?? []) !== JSON.stringify(prevBaseline.form.modes ?? [])
          ) {
            showSectionHint('mode');
          }
        } else {
          setSnack({
            open: true,
            message: 'Schedule saved — your profile is up to date.',
            severity: 'success',
          });
        }
        return true;
      } catch (err: unknown) {
        const apiError = handleApiError(err);
        if (isNetworkError(err) || apiError.isCorsError) {
          setSnack({
            open: true,
            message: 'Unable to connect to the API. Please check your connection and try again.',
            severity: 'error',
          });
        } else {
          setSnack({ open: true, message: apiError.message || 'Failed to update profile', severity: 'error' });
        }
        return false;
      } finally {
        if (kind === 'manual') setSaving(false);
        if (kind === 'auto') setAutoSaving(false);
        persistInFlightRef.current = false;
      }
    },
    [refreshMe, showSectionHint]
  );

  /** Only availability auto-saves. Intent modes are saved explicitly so Save stays enabled until the user confirms. */
  const autoSaveKey = useMemo(
    () => JSON.stringify(formData.availabilitySchedule),
    [formData.availabilitySchedule]
  );

  const baselineAutoKey = useMemo(
    () => (baseline ? JSON.stringify(baseline.form.availabilitySchedule) : ''),
    [baseline]
  );

  useEffect(() => {
    if (!baseline) return;
    if (autoSaveKey === baselineAutoKey) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      const b = baselineRef.current;
      const fd = formDataRef.current;
      if (!b || !fd) return;
      const avChanged =
        JSON.stringify(fd.availabilitySchedule) !== JSON.stringify(b.form.availabilitySchedule);
      const ok = await persistProfile('auto');
      if (ok && avChanged) showSectionHint('availability');
    }, 650);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [autoSaveKey, baselineAutoKey, baseline, persistProfile, showSectionHint]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isDirty) {
      setSnack({
        open: true,
        message:
          'Everything is already saved. Schedule changes save automatically a moment after you edit them.',
        severity: 'info',
      });
      return;
    }

    const fd = formDataRef.current;
    if (!fd) return;

    /*
     * Do not rely on HTML5 `required` on MUI multi-select Autocomplete: the combobox input stays empty
     * when only chips are selected, so the browser falsely focuses “Sports” and blocks submit.
     */
    if (!fd.name?.trim()) {
      setSnack({ open: true, message: 'Please enter your name.', severity: 'error' });
      return;
    }
    if (!(fd.sportTags && fd.sportTags.length > 0)) {
      setSnack({ open: true, message: 'Please select at least one sport.', severity: 'error' });
      return;
    }
    if (!fd.level?.trim()) {
      setSnack({ open: true, message: 'Please select your level.', severity: 'error' });
      return;
    }
    const slots = fd.availabilitySchedule || [];
    if (slots.length === 0) {
      setSnack({
        open: true,
        message:
          'Add at least one availability slot — scroll to Schedule and tap “+ Add Availability Slot”, then pick days and times.',
        severity: 'error',
      });
      return;
    }
    const badSlot = slots.some(
      (s) => !s.days?.length || !String(s.timeStart ?? '').trim() || !String(s.timeEnd ?? '').trim()
    );
    if (badSlot) {
      setSnack({
        open: true,
        message: 'For each schedule row, choose at least one day and set start and end times.',
        severity: 'error',
      });
      return;
    }
    const modes = fd.modes?.length ? fd.modes : fd.mode ? [fd.mode] : [];
    if (modes.length === 0) {
      setSnack({
        open: true,
        message: 'Pick at least one option under “What are you open to?”',
        severity: 'error',
      });
      return;
    }

    await persistProfile('manual');
  };

  const handleCancel = () => {
    if (!isDirty) {
      navigate(-1);
      return;
    }
    setDiscardModalOpen(true);
  };

  const handleDiscardAndLeave = () => {
    setDiscardModalOpen(false);
    navigate(-1);
  };

  const removePhotoAt = async (index: number) => {
    const nextKeys = photoKeys.filter((_, i) => i !== index);
    try {
      const token = await authService.getJWT();
      if (!token) {
        setSnack({ open: true, message: 'Not authenticated', severity: 'error' });
        return;
      }
      await profileService.updateMyProfile(token, { photoKeys: nextKeys });
      setPhotoKeys(nextKeys);
      if (nextKeys.length > 0) {
        const urls = await Promise.all(
          nextKeys.map((key) => profileService.getPhotoUrl(token, key))
        );
        setMyPhotos(urls);
      } else {
        setMyPhotos([]);
      }
      setBaseline((b) => (b ? { ...b, photoKeys: nextKeys } : null));
      await refreshMe();
      showSectionHint('photo');
      setSnack({ open: true, message: 'Profile updated successfully', severity: 'success' });
    } catch (e: unknown) {
      const apiError = handleApiError(e);
      setSnack({ open: true, message: apiError.message || 'Could not remove photo', severity: 'error' });
    }
  };

  /** Cover = first entry in photoKeys (same order Discover uses). */
  const makeCoverAt = async (index: number) => {
    if (index <= 0 || index >= photoKeys.length) return;
    try {
      const token = await authService.getJWT();
      if (!token) {
        setSnack({ open: true, message: 'Not authenticated', severity: 'error' });
        return;
      }
      const chosen = photoKeys[index];
      const nextKeys = [chosen, ...photoKeys.filter((_, i) => i !== index)];
      await profileService.updateMyProfile(token, { photoKeys: nextKeys });
      setPhotoKeys(nextKeys);
      const urls = await Promise.all(nextKeys.map((key) => profileService.getPhotoUrl(token, key)));
      setMyPhotos(urls);
      setBaseline((b) => (b ? { ...b, photoKeys: nextKeys } : null));
      await refreshMe();
      showSectionHint('photo');
      setSnack({ open: true, message: 'Cover photo updated', severity: 'success' });
    } catch (e: unknown) {
      const apiError = handleApiError(e);
      setSnack({ open: true, message: apiError.message || 'Could not update cover photo', severity: 'error' });
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ marginBottom: 0 }}>
            {t('profile.edit_profile')}
          </Typography>
          {autoSaving && (
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.02 }}>
              Saving…
            </Typography>
          )}
        </Box>
        <Button
          variant="outlined"
          color="primary"
          size="small"
          onClick={async () => {
            const token = await authService.getJWT();
            if (!token) return;
            setAiSuggestionsError('');
            setAiSuggestions(null);
            setAiSuggestionsLoading(true);
            try {
              const scheduleSummary = formData.availabilitySchedule?.length
                ? formData.availabilitySchedule.map((s) => `${(s.days ?? []).join('/')} ${s.timeStart ?? ''}-${s.timeEnd ?? ''}`).join('; ')
                : undefined;
              const res = await getProfileOptimize(token, {
                bio: formData.bio ?? undefined,
                goals: formData.goals ?? [],
                sportTags: formData.sportTags ?? [],
                level: formData.level ?? undefined,
                scheduleSummary,
              });
              setAiSuggestions(res);
              await refreshMe();
              trackPremiumAction('ai_profile_rewrite', 'success');
            } catch (err) {
              setAiSuggestionsError(getAiErrorMessage(err));
            } finally {
              setAiSuggestionsLoading(false);
            }
          }}
          disabled={aiSuggestionsLoading}
          title="Get AI suggestions to improve your bio, goals, and preferences"
        >
          {aiSuggestionsLoading ? 'Generating…' : `Improve with AI (${creditPhrase(profileAiCost)})`}
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
          Premium:
        </Typography>
        <Button
          size="small"
          variant="outlined"
          disabled={premiumBoostLoading}
          onClick={async () => {
            const token = await authService.getJWT();
            if (!token) return;
            setPremiumBoostLoading(true);
            try {
              await activateProfileBoost24h(token);
              await refreshMe();
              trackPremiumAction('profile_boost_24h', 'success');
              if (me?.user?.id) {
                void queryClient.invalidateQueries({ queryKey: matchQueryKeys.incomingLikes(me.user.id) });
              }
              setPremiumToast('Boost activated');
            } catch (err: unknown) {
              const st = (err as Error & { status?: number }).status;
              trackPremiumAction('profile_boost_24h', st === 402 ? 'insufficient_credits' : 'fail');
              setPremiumToast(err instanceof Error ? err.message : handleApiError(err).message);
            } finally {
              setPremiumBoostLoading(false);
            }
          }}
        >
          {premiumBoostLoading
            ? '…'
            : boostActive
              ? `Profile Boost active — tap to add 24h (${creditPhrase(boostCost)})`
              : `Profile Boost (24h) (${creditPhrase(boostCost)})`}
        </Button>
        <Button
          size="small"
          variant="outlined"
          disabled={premiumRevealLoading || me?.revealLikesUnlocked}
          onClick={async () => {
            const token = await authService.getJWT();
            if (!token) return;
            setPremiumRevealLoading(true);
            try {
              await unlockRevealLikes(token);
              await refreshMe();
              trackPremiumAction('reveal_likes', 'success');
              if (me?.user?.id) {
                void queryClient.invalidateQueries({ queryKey: matchQueryKeys.incomingLikes(me.user.id) });
              }
              setPremiumToast('You can see who liked you under Sent requests.');
            } catch (err: unknown) {
              const st = (err as Error & { status?: number }).status;
              trackPremiumAction('reveal_likes', st === 402 ? 'insufficient_credits' : 'fail');
              setPremiumToast(err instanceof Error ? err.message : handleApiError(err).message);
            } finally {
              setPremiumRevealLoading(false);
            }
          }}
        >
          {me?.revealLikesUnlocked
            ? 'Reveal Likes (unlocked)'
            : premiumRevealLoading
              ? '…'
              : `Reveal Likes (${creditPhrase(revealCost)})`}
        </Button>
        <Button size="small" component={Link} to="/pricing" variant="text">
          {t('header.get_credits')}
        </Button>
      </Box>

      <Snackbar
        open={!!premiumToast}
        autoHideDuration={4500}
        onClose={() => setPremiumToast(null)}
        message={premiumToast ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <InviteTrainingPartnerButton
        userId={userSub || me?.user?.id}
        profile={formData.modes || formData.mode ? formData : me?.profile}
        surface="profile"
      />

      {!loading && photoKeys.length === 0 && (
        <Box
          sx={{
            mb: 3,
            p: 2.5,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'rgba(129, 140, 248, 0.45)',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(15, 23, 42, 0.85) 100%)',
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.5 }}>
            Add a clear training photo
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, maxWidth: 640 }}>
            Your first photo is the cover card in Discover — bright, natural light, athletic kit, eyes visible. Scroll to{' '}
            <strong>Profile photos</strong> below or jump there now.
          </Typography>
          <Button
            type="button"
            variant="contained"
            size="medium"
            onClick={() => document.getElementById('profile-photos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            Go to photo upload
          </Button>
        </Box>
      )}

      {aiSuggestionsError && (
        <Alert severity="error" onClose={() => setAiSuggestionsError('')} sx={{ mb: 2 }}>
          {aiSuggestionsError}
        </Alert>
      )}

      {aiSuggestions && (
        <Card sx={{ mb: 3, p: 2, bgcolor: 'action.hover' }}>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            AI suggestions — apply what you like
          </Typography>
          {aiSuggestions.suggestedBio && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">Bio</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 1 }}>{aiSuggestions.suggestedBio}</Typography>
              <Button size="small" onClick={() => { setFormData((f) => ({ ...f, bio: aiSuggestions.suggestedBio ?? f.bio })); setAiSuggestions((a) => a ? { ...a, suggestedBio: undefined } : null); }}>Use this</Button>
            </Box>
          )}
          {aiSuggestions.suggestedGoals?.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">Goals</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                {aiSuggestions.suggestedGoals.map((g, i) => (
                  <Chip key={i} label={g} size="small" onDelete={() => {}} onClick={() => setFormData((f) => ({ ...f, goals: [...(f.goals ?? []), g] }))} />
                ))}
              </Box>
              <Button size="small" sx={{ mt: 1 }} onClick={() => setFormData((f) => ({ ...f, goals: aiSuggestions.suggestedGoals ?? f.goals ?? [] }))}>Use all</Button>
            </Box>
          )}
          {aiSuggestions.suggestedScheduleSummary && (
            <Box>
              <Typography variant="caption" color="text.secondary">Schedule summary</Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>{aiSuggestions.suggestedScheduleSummary}</Typography>
              <Button size="small" onClick={() => setAiSuggestions((a) => a ? { ...a, suggestedScheduleSummary: undefined } : null)}>Dismiss</Button>
            </Box>
          )}
          <Button size="small" sx={{ mt: 1 }} onClick={() => setAiSuggestions(null)}>Close</Button>
        </Card>
      )}

      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
        <TextField
          fullWidth
          label={t('profile.name')}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          margin="normal"
          required
        />

        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            fullWidth
            label={t('profile.city')}
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="State"
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            margin="normal"
          />
        </Box>

        <TextField
          fullWidth
          label="Bio"
          value={formData.bio}
          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
          margin="normal"
          multiline
          rows={3}
          placeholder="Tell us about yourself..."
        />

        <Autocomplete
          multiple
          disableCloseOnSelect
          options={[...PROFILE_SPORTS]}
          value={formData.sportTags || []}
          onChange={(_, v) => setFormData({ ...formData, sportTags: v })}
          getOptionLabel={(o) => o}
          renderOption={(props, option, { selected }) => (
            <li {...props} key={option}>
              <Checkbox
                icon={SPORT_CHECKBOX_ICON}
                checkedIcon={SPORT_CHECKBOX_CHECKED_ICON}
                style={{ marginRight: 8 }}
                checked={selected}
              />
              {option}
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              margin="normal"
              label={t('profile.sport_tags')}
              placeholder="Search or pick sports"
              helperText="Multi-select: check any sport. Click away when done."
            />
          )}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip {...getTagProps({ index })} key={option} label={option} size="small" />
            ))
          }
        />

        <FormControl fullWidth margin="normal">
          <InputLabel>{t('profile.level')}</InputLabel>
          <Select
            value={formData.level}
            onChange={(e) => setFormData({ ...formData, level: e.target.value })}
            label={t('profile.level')}
          >
            {LEVELS.map((level) => (
              <MenuItem key={level} value={level}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Autocomplete
          multiple
          disableCloseOnSelect
          options={[...TRAINING_GOALS]}
          value={formData.goals || []}
          onChange={(_, v) => setFormData({ ...formData, goals: v })}
          getOptionLabel={(o) => o}
          renderOption={(props, option, { selected }) => (
            <li {...props} key={option}>
              <Checkbox
                icon={SPORT_CHECKBOX_ICON}
                checkedIcon={SPORT_CHECKBOX_CHECKED_ICON}
                style={{ marginRight: 8 }}
                checked={selected}
              />
              {option}
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              margin="normal"
              label="Training goals (optional)"
              placeholder="Pick goals"
              helperText="Optional — same multi-select as sports."
            />
          )}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip {...getTagProps({ index })} key={option} label={option} size="small" />
            ))
          }
        />

        <FormControl fullWidth margin="normal">
          <FormLabel sx={{ mb: 1 }}>{t('profile.schedule')}</FormLabel>
          {sectionHint.availability && (
            <Typography variant="caption" color="success.main" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
              Saved ✓
            </Typography>
          )}
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Add at least one time slot when you're available to train
          </Typography>
          
          {(formData.availabilitySchedule || []).map((slot, index) => (
            <Card key={`${userSub || 'me'}-slot-${index}`} sx={{ mb: 2, p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2">Slot {index + 1}</Typography>
                <Button size="small" color="error" onClick={() => {
                  const updated = [...(formData.availabilitySchedule || [])];
                  updated.splice(index, 1);
                  setFormData({ ...formData, availabilitySchedule: updated });
                }}>
                  Remove
                </Button>
              </Box>

              <FormControl fullWidth margin="normal">
                <InputLabel>Days</InputLabel>
                <Select
                  multiple
                  value={slot.days || []}
                  onChange={(e) => {
                    const updated = [...(formData.availabilitySchedule || [])];
                    updated[index] = { ...updated[index], days: e.target.value as string[] };
                    setFormData({ ...formData, availabilitySchedule: updated });
                  }}
                  input={<OutlinedInput label="Days" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((day) => (
                        <Chip key={day} label={day} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {DAYS.map((day) => (
                    <MenuItem key={day} value={day}>
                      {day}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Start Time</InputLabel>
                  <Select
                    value={slot.timeStart || '17:00'}
                    onChange={(e) => {
                      const updated = [...(formData.availabilitySchedule || [])];
                      updated[index] = { ...updated[index], timeStart: e.target.value };
                      setFormData({ ...formData, availabilitySchedule: updated });
                    }}
                    label="Start Time"
                  >
                    {TIME_SLOTS.map((ts) => (
                      <MenuItem key={ts.start} value={ts.start}>
                        {ts.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth margin="normal">
                  <InputLabel>End Time</InputLabel>
                  <Select
                    value={slot.timeEnd || '21:00'}
                    onChange={(e) => {
                      const updated = [...(formData.availabilitySchedule || [])];
                      updated[index] = { ...updated[index], timeEnd: e.target.value };
                      setFormData({ ...formData, availabilitySchedule: updated });
                    }}
                    label="End Time"
                  >
                    {TIME_SLOTS.map((ts) => (
                      <MenuItem key={ts.end} value={ts.end}>
                        {ts.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Card>
          ))}

          <Button
            variant="outlined"
            onClick={() => {
              const newSlot: AvailabilitySlot = {
                days: [],
                timeStart: '17:00',
                timeEnd: '21:00',
              };
              setFormData({
                ...formData,
                availabilitySchedule: [...(formData.availabilitySchedule || []), newSlot],
              });
            }}
            sx={{ mt: 1 }}
          >
            + Add Availability Slot
          </Button>
        </FormControl>

        <FormControl fullWidth margin="normal">
          <FormLabel>{t('profile.intent_title')}</FormLabel>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            {t('profile.intent_helper')}
          </Typography>
          {sectionHint.mode && (
            <Typography variant="caption" color="success.main" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
              Saved ✓
            </Typography>
          )}
          <ToggleButtonGroup
            value={formData.modes ?? ['TRAIN']}
            onChange={(_, v) => {
              if (!v.length) return;
              const next = v as ('TRAIN' | 'VIBE' | 'DATE')[];
              setFormData({ ...formData, modes: next, mode: next[0] });
            }}
            aria-label="Intent modes"
            sx={{
              flexWrap: 'wrap',
              gap: 1,
              '& .MuiToggleButton-root': {
                borderRadius: '12px !important',
                px: 1.5,
                py: 1,
                textTransform: 'none',
                fontWeight: 700,
                lineHeight: 1.35,
                transition: 'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
              },
            }}
          >
            <ToggleButton
              value="TRAIN"
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'rgba(16, 185, 129, 0.16) !important',
                  color: '#0f766e',
                  borderColor: 'rgba(16, 185, 129, 0.45) !important',
                  boxShadow: 'inset 0 0 0 1px rgba(16, 185, 129, 0.2)',
                },
                '&.Mui-selected:hover': {
                  backgroundColor: 'rgba(16, 185, 129, 0.22) !important',
                },
              }}
            >
              🏋️ Train <span style={{ opacity: 0.78, fontWeight: 600 }}>· {t('profile.intent_train_label')}</span>
            </ToggleButton>
            <ToggleButton
              value="VIBE"
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'rgba(99, 102, 241, 0.16) !important',
                  color: '#3730a3',
                  borderColor: 'rgba(99, 102, 241, 0.42) !important',
                  boxShadow: 'inset 0 0 0 1px rgba(99, 102, 241, 0.22)',
                },
                '&.Mui-selected:hover': {
                  backgroundColor: 'rgba(99, 102, 241, 0.22) !important',
                },
              }}
            >
              🧑‍🤝‍🧑 Vibe <span style={{ opacity: 0.78, fontWeight: 600 }}>· {t('profile.intent_vibe_label')}</span>
            </ToggleButton>
            <ToggleButton
              value="DATE"
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'rgba(244, 63, 94, 0.12) !important',
                  color: '#9f1239',
                  borderColor: 'rgba(244, 63, 94, 0.38) !important',
                  boxShadow: 'inset 0 0 0 1px rgba(244, 63, 94, 0.18)',
                },
                '&.Mui-selected:hover': {
                  backgroundColor: 'rgba(244, 63, 94, 0.18) !important',
                },
              }}
            >
              ❤️ Date <span style={{ opacity: 0.78, fontWeight: 600 }}>· {t('profile.intent_date_label')}</span>
            </ToggleButton>
          </ToggleButtonGroup>
        </FormControl>

        <TextField
          fullWidth
          margin="normal"
          label="Workout style (optional)"
          placeholder="e.g. HIIT, powerlifting, HYROX"
          value={formData.workoutStyle ?? ''}
          onChange={(e) => setFormData({ ...formData, workoutStyle: e.target.value || undefined })}
        />
        <TextField
          fullWidth
          margin="normal"
          label="Personality tag (optional)"
          placeholder="e.g. Early bird, coach energy, chill"
          value={formData.personalityTag ?? ''}
          onChange={(e) => setFormData({ ...formData, personalityTag: e.target.value || undefined })}
        />
        <Typography variant="subtitle2" sx={{ mt: 2 }}>
          Sports event interests (optional)
        </Typography>
        <TextField
          fullWidth
          margin="normal"
          label="Favorite sport"
          value={(formData.favoriteSports || []).join(', ')}
          onChange={(e) =>
            setFormData({
              ...formData,
              favoriteSports: e.target.value.split(',').map((x) => x.trim()).filter(Boolean),
            })
          }
        />
        <TextField
          fullWidth
          margin="normal"
          label="Favorite team"
          value={(formData.favoriteTeams || []).join(', ')}
          onChange={(e) =>
            setFormData({
              ...formData,
              favoriteTeams: e.target.value.split(',').map((x) => x.trim()).filter(Boolean),
            })
          }
        />
        <TextField
          fullWidth
          margin="normal"
          label="Interested in (Train / Play / Watch / Meet / Vibe / Date)"
          value={(formData.eventActivities || []).join(', ')}
          onChange={(e) =>
            setFormData({
              ...formData,
              eventActivities: e.target.value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean),
            })
          }
        />

        <FormControl fullWidth margin="normal">
          <FormLabel>Chat notifications</FormLabel>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            When you&apos;re not active in the app, we can email you about new messages — grouped and rate-limited so it never feels spammy.
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={formData.chatNotificationsEnabled !== false}
                onChange={(e) => setFormData({ ...formData, chatNotificationsEnabled: e.target.checked })}
              />
            }
            label="Notify me about new messages (email when offline)"
          />
          <FormControl fullWidth margin="dense" sx={{ mt: 1.5 }}>
            <InputLabel id="chat-notify-freq">Email frequency</InputLabel>
            <Select
              labelId="chat-notify-freq"
              label="Email frequency"
              value={formData.chatNotificationFrequency || 'smart'}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  chatNotificationFrequency: e.target.value as 'realtime' | 'smart' | 'daily',
                })
              }
              disabled={formData.chatNotificationsEnabled === false}
            >
              <MenuItem value="realtime">Real-time (min. 15 min between emails per conversation)</MenuItem>
              <MenuItem value="smart">Smart — balanced (default)</MenuItem>
              <MenuItem value="daily">Daily (at most one email per day per conversation)</MenuItem>
            </Select>
          </FormControl>
        </FormControl>

        <Box id="profile-photos" sx={{ mt: 3 }}>
          <FormLabel>Profile Photos</FormLabel>
          {sectionHint.photo && (
            <Typography variant="caption" color="success.main" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
              Saved ✓
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, maxWidth: 560 }}>
            You can upload up to <strong>{uploadLimits.maxPhotos}</strong> photo
            {uploadLimits.maxPhotos === 1 ? '' : 's'} (you have {photoKeys.length}).
            {uploadLimits.maxVideoSeconds > 0 ? (
              <>
                {' '}
                Your plan also allows an intro video (up to <strong>{uploadLimits.maxVideoSeconds}s</strong>) where the app
                supports it.
              </>
            ) : (
              <> More photo slots unlock as you earn or purchase credits.</>
            )}
          </Typography>
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 0.5 }}>
            No nude or adult content. Photos must be appropriate for a fitness partner app.
          </Typography>
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 1.5 }}>
            The first photo is your cover in Discover. With multiple photos, use{' '}
            <strong>Make cover</strong> on any thumbnail to move it to the front. More slots unlock with credits.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', my: 1 }}>
            {photoKeys.map((key, index) => (
              <Box
                key={`${key}-${index}`}
                sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 0.5, maxWidth: 120 }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    width: 96,
                    height: 96,
                    borderRadius: 1,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box
                    component="img"
                    src={myPhotos[index] || ''}
                    alt=""
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
                  />
                  <IconButton
                    size="small"
                    aria-label="Remove photo"
                    onClick={() => void removePhotoAt(index)}
                    sx={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      bgcolor: 'rgba(0,0,0,0.5)',
                      color: 'common.white',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                    }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                  {index === 0 && (
                    <Typography
                      variant="caption"
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        textAlign: 'center',
                        bgcolor: 'rgba(0,0,0,0.55)',
                        color: 'common.white',
                        py: 0.25,
                        fontSize: '0.65rem',
                      }}
                    >
                      Cover
                    </Typography>
                  )}
                </Box>
                {photoKeys.length > 1 && index > 0 ? (
                  <Button
                    size="small"
                    variant="text"
                    sx={{ fontSize: '0.7rem', minHeight: 28, py: 0, textTransform: 'none' }}
                    onClick={() => void makeCoverAt(index)}
                  >
                    Make cover
                  </Button>
                ) : (
                  <Box sx={{ height: 28 }} aria-hidden />
                )}
              </Box>
            ))}
            {photoKeys.length === 0 && (
              <Typography variant="body2" color="textSecondary">No photos yet</Typography>
            )}
          </Box>
          {(() => {
            const atLimit = photoKeys.length >= uploadLimits.maxPhotos;
            return (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              component="label"
              disabled={uploading}
              title={atLimit ? 'Replace cover photo (first slot)' : 'Add a profile photo'}
            >
              {atLimit ? 'Replace cover photo' : 'Add photo'}
              <input 
                type="file" 
                hidden 
                accept="image/jpeg,image/jpg,image/png,image/webp" 
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (!selectedFile) return;
                  
                  // Validate file type
                  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
                  if (!validTypes.includes(selectedFile.type)) {
                    setSnack({ open: true, message: 'Please select a JPG, PNG, or WebP image', severity: 'error' });
                    return;
                  }
                  
                  // Validate file size (5MB max)
                  if (selectedFile.size > 5 * 1024 * 1024) {
                    setSnack({ open: true, message: 'Image must be less than 5MB', severity: 'error' });
                    return;
                  }
                  
                  setPendingCropFile(selectedFile);
                  setCropOpen(true);
                  e.target.value = '';
                }} 
              />
            </Button>
            <PhotoCropModal
              open={cropOpen}
              imageFile={pendingCropFile}
              onClose={() => {
                if (!uploading) {
                  setCropOpen(false);
                  setPendingCropFile(null);
                }
              }}
              saving={uploading}
              onSave={async (blob) => {
                try {
                  setUploading(true);
                  const token = await authService.getJWT();
                  if (!token) {
                    setSnack({ open: true, message: 'Not authenticated', severity: 'error' });
                    return;
                  }
                  const file = new File([blob], 'profile.jpg', { type: 'image/jpeg' });
                  const info = await profileService.getPhotoUploadUrl(token, 'image/jpeg');
                  const uploadResponse = await fetch(info.uploadUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'image/jpeg' },
                    body: file,
                  });
                  if (!uploadResponse.ok) {
                    throw new Error('Failed to upload photo');
                  }
                  let nextKeys: string[];
                  if (photoKeysRef.current.length >= uploadLimits.maxPhotos) {
                    nextKeys = [...photoKeysRef.current];
                    nextKeys[0] = info.key;
                  } else {
                    nextKeys = [...photoKeysRef.current, info.key];
                  }
                  await profileService.updateMyProfile(token, { photoKeys: nextKeys });
                  setPhotoKeys(nextKeys);
                  const urls = await Promise.all(
                    nextKeys.map((k) => profileService.getPhotoUrl(token, k))
                  );
                  setMyPhotos(urls);
                  setBaseline((b) => (b ? { ...b, photoKeys: nextKeys } : null));
                  await refreshMe();
                  showSectionHint('photo');
                  setSnack({ open: true, message: 'Profile updated successfully', severity: 'success' });
                  setCropOpen(false);
                  setPendingCropFile(null);
                } catch (e: unknown) {
                  const msg = e instanceof Error ? e.message : 'Upload failed';
                  setSnack({ open: true, message: msg, severity: 'error' });
                } finally {
                  setUploading(false);
                }
              }}
            />
            {atLimit && uploadLimits.maxPhotos < 10 && (
              <Typography variant="body2" color="primary" component={Link} to="/pricing" sx={{ textDecoration: 'underline' }}>
                Get credits to unlock more photo slots (currently {uploadLimits.maxPhotos})
              </Typography>
            )}
          </Box>
            );
          })()}
        </Box>

        <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Button
              fullWidth
              variant={isDirty ? 'contained' : 'outlined'}
              color={isDirty ? 'primary' : 'success'}
              type="submit"
              disabled={saving || loading}
              sx={{
                flex: 1,
                minWidth: 160,
                ...(isDirty && !saving
                  ? {
                      boxShadow: '0 0 0 2px rgba(124, 58, 237, 0.45)',
                    }
                  : {}),
              }}
            >
              {saving ? (
                <>
                  <CircularProgress size={18} sx={{ mr: 1 }} color="inherit" />
                  Saving…
                </>
              ) : !isDirty ? (
                'Saved · up to date'
              ) : (
                t('profile.save_profile')
              )}
            </Button>
            <Button
              fullWidth
              variant="outlined"
              onClick={handleCancel}
              disabled={saving}
              sx={{ flex: 1, minWidth: 160 }}
            >
              {t('common.cancel')}
            </Button>
          </Box>
          <Button component={Link} to="/app" variant="text" color="primary" sx={{ alignSelf: 'center' }}>
            Back to dashboard
          </Button>
        </Box>
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={5000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        message={snack.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      <Dialog open={discardModalOpen} onClose={() => setDiscardModalOpen(false)} aria-labelledby="discard-title">
        <DialogTitle id="discard-title">You have unsaved changes</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            If you leave now, changes you have not saved will be lost.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={() => setDiscardModalOpen(false)} variant="contained" color="primary">
            Stay and Continue Editing
          </Button>
          <Button onClick={handleDiscardAndLeave} variant="outlined" color="error">
            Discard Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

