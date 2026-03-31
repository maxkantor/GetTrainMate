import React, { useState, useEffect } from 'react';
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
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  FormGroup,
  Card,
  CardContent,
} from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { profileService, UpdateProfileRequest, AvailabilitySlot } from '@/services/profileService';
import { getUploadLimits } from '@/config/uploadLimits';
import { PhotoCropModal } from '@/components/profile/PhotoCropModal';
import { authService } from '@/services/authService';
import { Alert as MUIAlert, Snackbar } from '@mui/material';
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

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuthContext();
  const { me } = useMe();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [myPhotos, setMyPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [snack, setSnack] = useState<{open: boolean; message: string; severity: 'success'|'error'|'info'}>({open: false, message: '', severity: 'success'});
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);

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
  });
  const [aiSuggestions, setAiSuggestions] = useState<ProfileOptimizeResponse | null>(null);
  const [aiSuggestionsLoading, setAiSuggestionsLoading] = useState(false);
  const [aiSuggestionsError, setAiSuggestionsError] = useState('');

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
      setFormData({
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
      });
      // Show photo from photoKey if available, otherwise use photoUrls
      if (profile.photoKey) {
        try {
          // Get signed URL for the photo
          const signedUrl = await profileService.getPhotoUrl(token, profile.photoKey);
          setMyPhotos([signedUrl]);
          setPhotoKey(profile.photoKey);
        } catch (err) {
          console.error('Error loading photo URL:', err);
          // Fallback to direct URL if signed URL fails
          const photoUrl = `https://getrainmate-media-bucket.s3.us-east-1.amazonaws.com/${profile.photoKey}`;
          setMyPhotos([photoUrl]);
          setPhotoKey(profile.photoKey);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      setSaving(true);
      const token = await authService.getJWT();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      await profileService.updateMyProfile(token, formData);
      setSuccess(t('profile.save_profile') + ' successful!');
      
      setTimeout(() => {
        navigate('/app/discover');
      }, 1500);
    } catch (err: any) {
      const apiError = handleApiError(err);
      if (isNetworkError(err) || apiError.isCorsError) {
        setError('Unable to connect to the API. Please check your connection and try again.');
      } else {
        setError(apiError.message || 'Failed to update profile');
      }
    } finally {
      setSaving(false);
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
        <Typography variant="h4" component="h1" gutterBottom sx={{ marginBottom: 0 }}>
          {t('profile.edit_profile')}
        </Typography>
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

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
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
          <RadioGroup
            row
            value={formData.mode}
            onChange={(e) => setFormData({ ...formData, mode: e.target.value as any })}
          >
            <FormControlLabel value="TRAIN" control={<Radio />} label="TRAIN (Fitness Partners)" />
            <FormControlLabel value="VIBE" control={<Radio />} label="VIBE (Buddies)" />
            <FormControlLabel value="DATE" control={<Radio />} label="DATE (Interested)" />
          </RadioGroup>
        </FormControl>

        <Box sx={{ mt: 3 }}>
          <FormLabel>Profile Photos</FormLabel>
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 0.5 }}>
            No nude or adult content. Photos must be appropriate for a fitness partner app.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', my: 1 }}>
            {myPhotos.map((u) => (
              <Box key={u} component="img" src={u} alt="profile" sx={{ width: 96, height: 96, objectFit: 'cover', objectPosition: 'center top', borderRadius: 1, border: '1px solid #eee' }} />
            ))}
            {myPhotos.length === 0 && (
              <Typography variant="body2" color="textSecondary">No photos yet</Typography>
            )}
          </Box>
          {(() => {
            const limits = getUploadLimits(me?.credits ?? 0);
            const atLimit = myPhotos.length >= limits.maxPhotos;
            return (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              component="label"
              disabled={uploading}
              title={atLimit ? 'Replace your profile photo' : 'Add a profile photo'}
            >
              {atLimit ? 'Replace photo' : 'Choose Photo'}
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
                  await profileService.updateMyProfile(token, { photoKey: info.key });
                  setPhotoKey(info.key);
                  const displayUrl = await profileService.getPhotoUrl(token, info.key);
                  setMyPhotos([displayUrl]);
                  setSnack({ open: true, message: 'Photo saved', severity: 'success' });
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

        <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
          <Button
            fullWidth
            variant="contained"
            color="primary"
            type="submit"
            disabled={saving}
          >
            {saving ? <CircularProgress size={24} /> : t('profile.save_profile')}
          </Button>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => navigate('/app/discover')}
            disabled={saving}
          >
            {t('common.cancel')}
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

