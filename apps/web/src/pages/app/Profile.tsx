import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { profileService, UpdateProfileRequest } from '@/services/profileService';
import { authService } from '@/services/authService';
import { Alert as MUIAlert, Snackbar } from '@mui/material';
import { handleApiError, isNetworkError } from '@/utils/apiErrorHandler';

const SPORTS = [
  'Running', 'Cycling', 'Swimming', 'Tennis', 'Basketball', 'Soccer',
  'Volleyball', 'Gym', 'Yoga', 'Hiking', 'Climbing', 'CrossFit',
  'Boxing', 'MMA', 'Dancing', 'Golf', 'Skiing', 'Surfing'
];

const LEVELS = ['beginner', 'intermediate', 'advanced', 'pro'];

const SCHEDULE_OPTIONS = [
  'monday-morning', 'monday-afternoon', 'monday-evening',
  'tuesday-morning', 'tuesday-afternoon', 'tuesday-evening',
  'wednesday-morning', 'wednesday-afternoon', 'wednesday-evening',
  'thursday-morning', 'thursday-afternoon', 'thursday-evening',
  'friday-morning', 'friday-afternoon', 'friday-evening',
  'saturday-morning', 'saturday-afternoon', 'saturday-evening',
  'sunday-morning', 'sunday-afternoon', 'sunday-evening',
];

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [myPhotos, setMyPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [snack, setSnack] = useState<{open: boolean; message: string; severity: 'success'|'error'|'info'}>({open: false, message: '', severity: 'success'});
  const [file, setFile] = useState<File | null>(null);

  const [formData, setFormData] = useState<UpdateProfileRequest>({
    name: '',
    city: '',
    bio: '',
    sportTags: [],
    level: '',
    goals: '',
    availabilitySchedule: [],
    mode: 'TRAIN',
  });

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
        bio: profile.bio || '',
        sportTags: profile.sportTags || [],
        level: profile.level || '',
        goals: profile.goals || '',
        availabilitySchedule: profile.availabilitySchedule || [],
        mode: profile.mode || 'TRAIN',
      });
      setMyPhotos(profile.photoUrls || []);
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
      <Typography variant="h4" component="h1" gutterBottom>
        {t('profile.edit_profile')}
      </Typography>

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

      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
        <TextField
          fullWidth
          label={t('profile.name')}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          margin="normal"
          required
        />

        <TextField
          fullWidth
          label={t('profile.city')}
          value={formData.city}
          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
          margin="normal"
          required
        />

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

        <TextField
          fullWidth
          label={t('profile.goals')}
          value={formData.goals}
          onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
          margin="normal"
          multiline
          rows={2}
          placeholder="Your fitness goals..."
        />

        <FormControl fullWidth margin="normal" required>
          <FormLabel sx={{ mb: 1 }}>{t('profile.schedule')}</FormLabel>
          <FormGroup>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
              {SCHEDULE_OPTIONS.map((slot) => (
                <FormControlLabel
                  key={slot}
                  control={
                    <Checkbox
                      checked={formData.availabilitySchedule?.includes(slot)}
                      onChange={(e) => {
                        const current = formData.availabilitySchedule || [];
                        const updated = e.target.checked
                          ? [...current, slot]
                          : current.filter((s) => s !== slot);
                        setFormData({ ...formData, availabilitySchedule: updated });
                      }}
                    />
                  }
                  label={slot.replace('-', ' ')}
                  sx={{ fontSize: '0.85rem' }}
                />
              ))}
            </Box>
          </FormGroup>
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
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', my: 1 }}>
            {myPhotos.map((u) => (
              <Box key={u} component="img" src={u} alt="profile" sx={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 1, border: '1px solid #eee' }} />
            ))}
            {myPhotos.length === 0 && (
              <Typography variant="body2" color="textSecondary">No photos yet</Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button variant="outlined" component="label" disabled={uploading}>
              Choose Photo
              <input type="file" hidden accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </Button>
            <Typography variant="body2">{file?.name || 'No file selected'}</Typography>
            <Button variant="contained" disabled={!file || uploading} onClick={async () => {
              try {
                setUploading(true);
                const token = await authService.getJWT();
                if (!token) { setSnack({open: true, message: 'Not authenticated', severity: 'error'}); return; }
                if (!file) return;
                const info = await profileService.getPhotoUploadUrl(token, file.type || 'image/jpeg');
                await fetch(info.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'image/jpeg' }, body: file });
                const updated = await profileService.addPhoto(token, info.publicUrl);
                setMyPhotos(updated.photoUrls || []);
                setSnack({ open: true, message: 'Photo uploaded', severity: 'success' });
                setFile(null);
              } catch (e: any) {
                setSnack({ open: true, message: e?.message || 'Upload failed', severity: 'error' });
              } finally {
                setUploading(false);
              }
            }}>Upload</Button>
          </Box>
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

