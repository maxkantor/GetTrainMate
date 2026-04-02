import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useI18n } from '@/hooks/useI18n';
import { useMe } from '@/hooks/useMe';
import { profileService, UpdateProfileRequest, AvailabilitySlot } from '@/services/profileService';
import { getUploadLimits } from '@/config/uploadLimits';
import { PhotoCropModal } from '@/components/profile/PhotoCropModal';
import { authService } from '@/services/authService';
import { handleApiError, isNetworkError } from '@/utils/apiErrorHandler';
import { getProfileOptimize, getAiErrorMessage } from '@/services/aiService';
import type { ProfileOptimizeResponse } from '@/types/ai';

const SPORTS = [
  'Running', 'Cycling', 'Swimming', 'Tennis', 'Basketball', 'Soccer',
  'Volleyball', 'Gym', 'Yoga', 'Hiking', 'Climbing', 'CrossFit',
  'Hyrox', 'Pickleball', 'Fishing', 'Boxing', 'MMA', 'Dancing',
  'Golf', 'Skiing', 'Surfing', 'Rowing', 'Paddleboarding', 'Rock Climbing',
  'Martial Arts', 'Pilates', 'Barre', 'HIIT', 'Powerlifting', 'Weightlifting',
  'Rugby', 'Baseball', 'Softball', 'Badminton', 'Squash', 'Racquetball',
  'Table Tennis', 'Archery', 'Kayaking', 'Canoeing', 'Triathlon', 'Ultramarathon',
];

const LEVELS = ['beginner', 'intermediate', 'advanced', 'pro'];

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

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { me, refreshMe } = useMe();

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

  const [formData, setFormData] = useState<UpdateProfileRequest>({
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
  });
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

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
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
                return `https://getrainmate-media-bucket.s3.us-east-1.amazonaws.com/${key}`;
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
    } catch (err: any) {
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
  };

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
        setBaseline({ form: cloneForm(fd), photoKeys: [...photoKeysRef.current] });
        await refreshMe();
        if (kind === 'manual') {
          setSnack({ open: true, message: 'Profile updated successfully', severity: 'success' });
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
    [refreshMe]
  );

  const autoSaveKey = useMemo(
    () =>
      JSON.stringify({
        modes: formData.modes,
        availabilitySchedule: formData.availabilitySchedule,
      }),
    [formData.modes, formData.availabilitySchedule]
  );

  const baselineAutoKey = useMemo(
    () =>
      baseline
        ? JSON.stringify({
            modes: baseline.form.modes,
            availabilitySchedule: baseline.form.availabilitySchedule,
          })
        : '',
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
      const modeChanged = fd.mode !== b.form.mode;
      const avChanged =
        JSON.stringify(fd.availabilitySchedule) !== JSON.stringify(b.form.availabilitySchedule);
      const ok = await persistProfile('auto');
      if (ok) {
        if (modeChanged) showSectionHint('mode');
        if (avChanged) showSectionHint('availability');
      }
    }, 650);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [autoSaveKey, baselineAutoKey, baseline, persistProfile, showSectionHint]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isDirty) return;

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
            } catch (err) {
              setAiSuggestionsError(getAiErrorMessage(err));
            } finally {
              setAiSuggestionsLoading(false);
            }
          }}
          disabled={aiSuggestionsLoading}
          title="Get AI suggestions to improve your bio, goals, and preferences"
        >
          {aiSuggestionsLoading ? 'Generating…' : 'Improve with AI'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
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

        <FormControl fullWidth margin="normal" required>
          <InputLabel>{t('profile.sport_tags')}</InputLabel>
          <Select
            multiple
            value={formData.sportTags || []}
            onChange={(e) => setFormData({ ...formData, sportTags: e.target.value as string[] })}
            input={<OutlinedInput label={t('profile.sport_tags')} />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((value) => (
                  <Chip key={value} label={value} size="small" />
                ))}
              </Box>
            )}
          >
            {SPORTS.map((sport) => (
              <MenuItem key={sport} value={sport}>
                {sport}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal" required>
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

        <FormControl fullWidth margin="normal">
          <InputLabel>Training Goals (Optional)</InputLabel>
          <Select
            multiple
            value={formData.goals || []}
            onChange={(e) => setFormData({ ...formData, goals: e.target.value as string[] })}
            input={<OutlinedInput label="Training Goals (Optional)" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(selected as string[]).map((goal) => (
                  <Chip key={goal} label={goal} size="small" />
                ))}
              </Box>
            )}
          >
            <MenuItem value="Lose fat">Lose fat</MenuItem>
            <MenuItem value="Build muscle">Build muscle</MenuItem>
            <MenuItem value="Race prep">Race prep</MenuItem>
            <MenuItem value="Improve endurance">Improve endurance</MenuItem>
            <MenuItem value="Increase strength">Increase strength</MenuItem>
            <MenuItem value="Stay active">Stay active</MenuItem>
            <MenuItem value="Social connection">Social connection</MenuItem>
            <MenuItem value="Competition">Competition</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal" required>
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
            <Card key={index} sx={{ mb: 2, p: 2 }}>
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
          <FormLabel>{t('profile.mode')}</FormLabel>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Pick one or more — we only show people you share intent with in Discover.
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
            sx={{ flexWrap: 'wrap', gap: 1 }}
          >
            <ToggleButton value="TRAIN" sx={{ textTransform: 'none', fontWeight: 700 }}>
              🏋️ Train
            </ToggleButton>
            <ToggleButton value="VIBE" sx={{ textTransform: 'none', fontWeight: 700 }}>
              🧑‍🤝‍🧑 Vibe
            </ToggleButton>
            <ToggleButton value="DATE" sx={{ textTransform: 'none', fontWeight: 700 }}>
              ❤️ Date
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

        <Box sx={{ mt: 3 }}>
          <FormLabel>Profile Photos</FormLabel>
          {sectionHint.photo && (
            <Typography variant="caption" color="success.main" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
              Saved ✓
            </Typography>
          )}
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 0.5 }}>
            No nude or adult content. Photos must be appropriate for a fitness partner app.
          </Typography>
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 1.5 }}>
            First photo is your cover image in Discover. Add more when your plan allows.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', my: 1 }}>
            {photoKeys.map((key, index) => (
              <Box
                key={key}
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
            ))}
            {photoKeys.length === 0 && (
              <Typography variant="body2" color="textSecondary">No photos yet</Typography>
            )}
          </Box>
          {(() => {
            const limits = getUploadLimits(me?.credits ?? 0);
            const atLimit = photoKeys.length >= limits.maxPhotos;
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
                  const limitsInner = getUploadLimits(me?.credits ?? 0);
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
                  if (photoKeysRef.current.length >= limitsInner.maxPhotos) {
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
            {atLimit && limits.maxPhotos < 10 && (
              <Typography variant="body2" color="primary" component={Link} to="/pricing" sx={{ textDecoration: 'underline' }}>
                Get credits to unlock more photo slots (currently {limits.maxPhotos})
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
              variant="contained"
              color="primary"
              type="submit"
              disabled={!isDirty || saving || loading}
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
            Back Home
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

