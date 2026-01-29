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
  Stepper,
  Step,
  StepLabel,
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
  Stack,
} from '@mui/material';
import { useAuthContext } from '@/hooks/useAuthContext';
import { profileService, UpdateProfileRequest, AvailabilitySlot } from '@/services/profileService';
import { authService } from '@/services/authService';
import { handleApiError } from '@/utils/apiErrorHandler';

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

const STEPS = ['Photo', 'Basics', 'Training', 'Availability', 'Review'];

export const ProfileOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoKey, setPhotoKey] = useState<string | null>(null);

  const [formData, setFormData] = useState<UpdateProfileRequest>({
    name: '',
    city: '',
    state: '',
    country: 'US',
    bio: '',
    birthDate: '',
    gender: '',
    sportTags: [],
    level: '',
    goals: [],
    availabilitySchedule: [],
    mode: 'TRAIN',
  });

  useEffect(() => {
    // Load existing profile if available
    loadExistingProfile();
  }, []);

  const loadExistingProfile = async () => {
    try {
      const token = await authService.getJWT();
      if (!token) return;

      const profile = await profileService.getMyProfile(token);
      if (profile) {
        setFormData({
          name: profile.name || '',
          city: profile.city || '',
          state: profile.state || '',
          country: profile.country || 'US',
          bio: profile.bio || '',
          birthDate: profile.birthDate || '',
          gender: profile.gender || '',
          sportTags: profile.sportTags || [],
          level: profile.level || '',
          goals: profile.goals || [],
          availabilitySchedule: profile.availabilitySchedule || [],
          mode: profile.mode || 'TRAIN',
        });
        if (profile.photoKey) {
          setPhotoKey(profile.photoKey);
          try {
            // Get signed URL for the photo
            const signedUrl = await profileService.getPhotoUrl(token, profile.photoKey);
            setPhotoPreview(signedUrl);
          } catch (err) {
            console.error('Error loading photo URL:', err);
            // Fallback to direct URL if signed URL fails
            const publicUrl = `https://getrainmate-media-bucket.s3.us-east-1.amazonaws.com/${profile.photoKey}`;
            setPhotoPreview(publicUrl);
          }
        }
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Please select a JPG, PNG, or WebP image');
      return;
    }

    // Validate file size (5MB max)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setFile(selectedFile);
    setError('');

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleUploadPhoto = async () => {
    if (!file) return;

    try {
      setUploading(true);
      setError('');
      const token = await authService.getJWT();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      // Get upload URL
      const uploadInfo = await profileService.getPhotoUploadUrl(token, file.type);

      // Upload to S3
      const uploadResponse = await fetch(uploadInfo.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload photo');
      }

      setPhotoKey(uploadInfo.key);
      setPhotoPreview(uploadInfo.publicUrl);
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      setError(handleApiError(err).message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleNext = () => {
    // Validate current step
    if (activeStep === 0) {
      // Photo step - optional, can skip
      if (file && !photoKey) {
        setError('Please upload the photo first');
        return;
      }
    } else if (activeStep === 1) {
      // Basics step
      if (!formData.name?.trim()) {
        setError('Display name is required');
        return;
      }
      if (!formData.bio?.trim() || formData.bio.length < 20 || formData.bio.length > 500) {
        setError('Bio must be between 20 and 500 characters');
        return;
      }
    } else if (activeStep === 2) {
      // Training step
      if (!formData.sportTags || formData.sportTags.length === 0) {
        setError('Please select at least one training type');
        return;
      }
      if (!formData.level) {
        setError('Please select your skill level');
        return;
      }
    } else if (activeStep === 3) {
      // Availability step
      if (!formData.availabilitySchedule || formData.availabilitySchedule.length === 0) {
        setError('Please add at least one availability slot');
        return;
      }
    }

    setError('');
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
    setError('');
  };

  const handleAddAvailability = () => {
    const newSlot: AvailabilitySlot = {
      days: [],
      timeStart: '17:00',
      timeEnd: '21:00',
    };
    setFormData({
      ...formData,
      availabilitySchedule: [...(formData.availabilitySchedule || []), newSlot],
    });
  };

  const handleRemoveAvailability = (index: number) => {
    const updated = [...(formData.availabilitySchedule || [])];
    updated.splice(index, 1);
    setFormData({ ...formData, availabilitySchedule: updated });
  };

  const handleUpdateAvailability = (index: number, field: keyof AvailabilitySlot, value: any) => {
    const updated = [...(formData.availabilitySchedule || [])];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, availabilitySchedule: updated });
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');
      const token = await authService.getJWT();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const updateData: UpdateProfileRequest = {
        ...formData,
        photoKey: photoKey || undefined,
      };

      await profileService.updateMyProfile(token, updateData);
      navigate('/app/discover');
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setError(handleApiError(err).message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // Photo
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Add Your Profile Photo
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Upload a clear photo of yourself (optional but recommended)
            </Typography>

            {photoPreview && (
              <Box sx={{ mb: 2, textAlign: 'center' }}>
                <img
                  src={photoPreview}
                  alt="Profile preview"
                  style={{
                    width: 200,
                    height: 200,
                    objectFit: 'cover',
                    borderRadius: '50%',
                    border: '2px solid #e0e0e0',
                  }}
                />
              </Box>
            )}

            <Box sx={{ mb: 2 }}>
              <Button variant="outlined" component="label" disabled={uploading}>
                Choose Photo
                <input type="file" hidden accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleFileChange} />
              </Button>
              {file && !photoKey && (
                <Button
                  variant="contained"
                  onClick={handleUploadPhoto}
                  disabled={uploading}
                  sx={{ ml: 2 }}
                >
                  {uploading ? <CircularProgress size={20} /> : 'Upload'}
                </Button>
              )}
            </Box>

            {file && (
              <Typography variant="body2" color="textSecondary">
                Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </Typography>
            )}
          </Box>
        );

      case 1: // Basics
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>

            <TextField
              fullWidth
              label="Display Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              margin="normal"
              required
            />

            <TextField
              fullWidth
              label="City"
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

            <TextField
              fullWidth
              label="Bio *"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              margin="normal"
              multiline
              rows={4}
              required
              helperText={`${formData.bio?.length || 0}/500 characters (minimum 20)`}
              error={formData.bio ? (formData.bio.length < 20 || formData.bio.length > 500) : false}
            />

            <FormControl fullWidth margin="normal">
              <InputLabel>Gender (Optional)</InputLabel>
              <Select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                label="Gender (Optional)"
              >
                <MenuItem value="">Prefer not to say</MenuItem>
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
                <MenuItem value="non-binary">Non-binary</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
          </Box>
        );

      case 2: // Training
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Training Preferences
            </Typography>

            <FormControl fullWidth margin="normal">
              <InputLabel>Training Types *</InputLabel>
              <Select
                multiple
                value={formData.sportTags || []}
                onChange={(e) => setFormData({ ...formData, sportTags: e.target.value as string[] })}
                input={<OutlinedInput label="Training Types *" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => (
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

            <FormControl fullWidth margin="normal">
              <InputLabel>Skill Level *</InputLabel>
              <Select
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                label="Skill Level *"
                required
              >
                {LEVELS.map((level) => (
                  <MenuItem key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl component="fieldset" margin="normal">
              <FormLabel component="legend">Training Mode</FormLabel>
              <RadioGroup
                value={formData.mode}
                onChange={(e) => setFormData({ ...formData, mode: e.target.value as 'TRAIN' | 'VIBE' | 'DATE' })}
              >
                <FormControlLabel value="TRAIN" control={<Radio />} label="TRAIN (Fitness Partners)" />
                <FormControlLabel value="VIBE" control={<Radio />} label="VIBE (Buddies)" />
                <FormControlLabel value="DATE" control={<Radio />} label="DATE (Interested)" />
              </RadioGroup>
            </FormControl>
          </Box>
        );

      case 3: // Availability
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Availability
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Add at least one time slot when you're available to train
            </Typography>

            {(formData.availabilitySchedule || []).map((slot, index) => (
              <Card key={index} sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1">Slot {index + 1}</Typography>
                    <Button size="small" color="error" onClick={() => handleRemoveAvailability(index)}>
                      Remove
                    </Button>
                  </Box>

                  <FormControl fullWidth margin="normal">
                    <InputLabel>Days</InputLabel>
                    <Select
                      multiple
                      value={slot.days}
                      onChange={(e) => handleUpdateAvailability(index, 'days', e.target.value)}
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
                        value={slot.timeStart}
                        onChange={(e) => handleUpdateAvailability(index, 'timeStart', e.target.value)}
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
                        value={slot.timeEnd}
                        onChange={(e) => handleUpdateAvailability(index, 'timeEnd', e.target.value)}
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
                </CardContent>
              </Card>
            ))}

            <Button variant="outlined" onClick={handleAddAvailability} sx={{ mt: 2 }}>
              + Add Availability Slot
            </Button>
          </Box>
        );

      case 4: // Review
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review Your Profile
            </Typography>

            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" color="textSecondary">Display Name</Typography>
                <Typography variant="body1">{formData.name || 'Not set'}</Typography>
              </CardContent>
            </Card>

            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" color="textSecondary">Bio</Typography>
                <Typography variant="body1">{formData.bio || 'Not set'}</Typography>
              </CardContent>
            </Card>

            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" color="textSecondary">Training Types</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                  {(formData.sportTags || []).map((tag) => (
                    <Chip key={tag} label={tag} size="small" />
                  ))}
                </Box>
              </CardContent>
            </Card>

            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" color="textSecondary">Skill Level</Typography>
                <Typography variant="body1">{formData.level || 'Not set'}</Typography>
              </CardContent>
            </Card>

            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" color="textSecondary">Availability</Typography>
                {(formData.availabilitySchedule || []).map((slot, idx) => (
                  <Typography key={idx} variant="body2" sx={{ mt: 1 }}>
                    {slot.days.join(', ')}: {slot.timeStart} - {slot.timeEnd}
                  </Typography>
                ))}
              </CardContent>
            </Card>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Complete Your Profile
      </Typography>
      <Typography variant="body1" color="textSecondary" align="center" sx={{ mb: 4 }}>
        Help us match you with the perfect training partner
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent sx={{ py: 4 }}>
          {renderStepContent()}
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button disabled={activeStep === 0} onClick={handleBack}>
          Back
        </Button>
        {activeStep === STEPS.length - 1 ? (
          <Button variant="contained" onClick={handleSubmit} disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Complete Profile'}
          </Button>
        ) : (
          <Button variant="contained" onClick={handleNext}>
            Next
          </Button>
        )}
      </Box>
    </Container>
  );
};
