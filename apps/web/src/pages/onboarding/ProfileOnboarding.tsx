import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
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
  Grid,
  IconButton,
  StepConnector,
  stepConnectorClasses,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import PeopleIcon from '@mui/icons-material/People';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { PageShell } from '@/components/layout/PageShell';
import { profileService, UpdateProfileRequest, AvailabilitySlot } from '@/services/profileService';
import { authService } from '@/services/authService';
import { handleApiError } from '@/utils/apiErrorHandler';
import { readLandingPrefs, trainingToSportTag, landingLevelToProfileLevel } from '@/utils/landingPrefs';

const SPORTS = [
  'Running', 'Cycling', 'Swimming', 'Tennis', 'Basketball', 'Soccer',
  'Volleyball', 'Gym', 'Yoga', 'Hiking', 'Climbing', 'CrossFit',
  'Hyrox', 'Pickleball', 'Fishing', 'Boxing', 'MMA', 'Dancing',
  'Golf', 'Skiing', 'Surfing', 'Rowing', 'Paddleboarding', 'Rock Climbing',
  'Martial Arts', 'Pilates', 'Barre', 'HIIT', 'Powerlifting', 'Weightlifting',
  'Rugby', 'Baseball', 'Softball', 'Badminton', 'Squash', 'Racquetball',
  'Table Tennis', 'Archery', 'Kayaking', 'Canoeing', 'Triathlon', 'Ultramarathon',
  'Other',
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
  const { refreshMe } = useMe();

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [otherSport, setOtherSport] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        const sportTags = profile.sportTags || [];
        // Check if there's a custom sport (not in SPORTS list)
        const customSport = sportTags.find(s => !SPORTS.includes(s));
        if (customSport) {
          setOtherSport(customSport);
          // Add "Other" to sportTags if not already present
          if (!sportTags.includes('Other')) {
            sportTags.push('Other');
          }
        }
        
        setFormData({
          name: profile.name || '',
          city: profile.city || '',
          state: profile.state || '',
          country: profile.country || 'US',
          bio: profile.bio || '',
          birthDate: profile.birthDate || '',
          gender: profile.gender || '',
          sportTags: sportTags,
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
        const prefs = readLandingPrefs();
        if (prefs && (!sportTags.length || !profile.level)) {
          const tag = trainingToSportTag(prefs.training);
          setFormData((prev) => ({
            ...prev,
            sportTags: (prev.sportTags?.length ? prev.sportTags : [tag]),
            level: prev.level || landingLevelToProfileLevel(prefs.level),
          }));
        }
      } else {
        const prefs = readLandingPrefs();
        if (prefs) {
          const tag = trainingToSportTag(prefs.training);
          setFormData((prev) => ({
            ...prev,
            sportTags: [tag],
            level: landingLevelToProfileLevel(prefs.level),
          }));
        }
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const processFile = (selectedFile: File) => {
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
      if (reader.result && typeof reader.result === 'string') {
        if (reader.result.startsWith('data:image/')) {
          setPhotoPreview(reader.result);
        } else {
          setError('Invalid image data format');
        }
      } else {
        setError('Failed to load image preview');
      }
    };
    reader.onerror = () => {
      setError('Failed to read image file');
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    processFile(selectedFile);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
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

      // Use signed URL for preview (publicUrl fails for private S3 buckets)
      try {
        const signedUrl = await profileService.getPhotoUrl(token, uploadInfo.key);
        setPhotoPreview(signedUrl);
        setError('');
      } catch (urlErr) {
        console.warn('Could not get signed URL for preview', urlErr);
        // Keep showing local file as data URL so user still sees their photo
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result && typeof reader.result === 'string' && reader.result.startsWith('data:image/')) {
            setPhotoPreview(reader.result);
            setError('');
          }
        };
        reader.readAsDataURL(file);
      }
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
      setFieldErrors({});
      const token = await authService.getJWT();
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      // Build payload: include all required fields for completion (Review step)
      const updateData: UpdateProfileRequest = {};
      if (formData.name != null) updateData.name = formData.name.trim();
      if (formData.city?.trim()) updateData.city = formData.city.trim();
      if (formData.state?.trim()) updateData.state = formData.state.trim();
      if (formData.country) updateData.country = formData.country;
      if (formData.bio != null) updateData.bio = formData.bio.trim();
      if (formData.birthDate) updateData.birthDate = formData.birthDate;
      if (formData.gender) updateData.gender = formData.gender;
      if (formData.sportTags != null) {
        updateData.sportTags = formData.sportTags.filter(tag => tag !== 'Other');
      }
      if (formData.level) updateData.level = formData.level;
      if (formData.goals && formData.goals.length > 0) updateData.goals = formData.goals;
      if (formData.availabilitySchedule && formData.availabilitySchedule.length > 0) {
        updateData.availabilitySchedule = formData.availabilitySchedule.map(slot => ({
          days: slot.days ?? [],
          timeStart: slot.timeStart ?? '',
          timeEnd: slot.timeEnd ?? '',
        }));
      }
      if (formData.mode) updateData.mode = formData.mode;
      if (photoKey) updateData.photoKey = photoKey;

      if (import.meta.env.DEV) {
        console.log('Submitting profile data:', JSON.stringify(updateData, null, 2));
      }

      await profileService.updateMyProfile(token, updateData);
      await refreshMe();
      if (import.meta.env.DEV) console.log('[ProfileOnboarding] Profile saved; onboarding complete, redirecting to /app/discover');
      navigate('/app/discover', { state: { profileJustCompleted: true }, replace: true });
    } catch (err: any) {
      console.error('Error saving profile:', err);
      if (err.response) {
        if (import.meta.env.DEV) {
          console.error('API Error Response:', err.response.data);
          console.error('API Error Status:', err.response.status);
        }
        if (err.response.status === 401) {
          setError('Session expired. Please sign in again.');
          setTimeout(() => navigate('/login', { state: { from: '/onboarding/profile' }, replace: true }), 1500);
          setLoading(false);
          return;
        }
        if (err.response.status === 400 && err.response.data?.errors) {
          setFieldErrors(err.response.data.errors);
          setError(err.response.data.message || 'Please fix the errors below.');
          setLoading(false);
          return;
        }
      }
      const apiError = handleApiError(err);
      setError(apiError.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // Photo
        return (
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
              Add Your Profile Photo
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Profiles with photos get more matches
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 3 }}>
              No nude or adult content. Photos must be appropriate for a fitness partner app.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              {/* Large Circular Avatar Placeholder */}
              <Box
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  width: 200,
                  height: 200,
                  borderRadius: '50%',
                  border: dragActive ? '3px dashed #6366f1' : photoPreview ? 'none' : '2px dashed #d1d5db',
                  backgroundColor: photoPreview ? 'transparent' : '#f9fafb',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                  '&:hover': {
                    borderColor: '#6366f1',
                    backgroundColor: photoPreview ? 'transparent' : '#f3f4f6',
                  },
                }}
              >
                {photoPreview ? (
                  <>
                    <img
                      src={photoPreview}
                      alt="Profile preview"
                      onError={(e) => {
                        setError('Failed to display image preview');
                        setPhotoPreview(null);
                      }}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: '50%',
                      }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        borderRadius: '50%',
                        p: 0.5,
                        '&:hover': {
                          backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        },
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setPhotoPreview(null);
                        setPhotoKey(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      <DeleteIcon sx={{ color: 'white', fontSize: 20 }} />
                    </Box>
                  </>
                ) : (
                  <>
                    <CloudUploadIcon sx={{ fontSize: 48, color: '#9ca3af', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                      Click or drag & drop
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      JPG, PNG, or WebP (max 5MB)
                    </Typography>
                  </>
                )}
              </Box>

              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileChange}
              />

              {file && !photoKey && (
                <Button
                  variant="contained"
                  onClick={handleUploadPhoto}
                  disabled={uploading}
                  startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : <CloudUploadIcon />}
                  sx={{ borderRadius: 2 }}
                >
                  {uploading ? 'Uploading...' : 'Upload Photo'}
                </Button>
              )}

              {file && photoKey && (
                <Typography variant="body2" color="success.main" sx={{ fontWeight: 500 }}>
                  ✓ Photo uploaded successfully
                </Typography>
              )}
            </Box>
          </Box>
        );

      case 1: // Basics
        return (
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
              Basic Information
            </Typography>

            <TextField
              fullWidth
              label="Display Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              sx={{ mb: 2 }}
              required
            />

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="City"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="State"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                />
              </Grid>
            </Grid>

            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Bio *
                </Typography>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: formData.bio && (formData.bio.length < 20 || formData.bio.length > 500) 
                      ? 'error.main' 
                      : 'text.secondary' 
                  }}
                >
                  {formData.bio?.length || 0}/500
                </Typography>
              </Box>
              <TextField
                fullWidth
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                multiline
                rows={4}
                placeholder="Tell potential training partners about yourself, your fitness goals, and what you're looking for..."
                required
                error={formData.bio ? (formData.bio.length < 20 || formData.bio.length > 500) : false}
                helperText={formData.bio && formData.bio.length < 20 ? 'Minimum 20 characters required' : ''}
              />
            </Box>

            <FormControl fullWidth>
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
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
              Training Preferences
            </Typography>

            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel id="sport-tags-label">Training Types *</InputLabel>
              <Select
                labelId="sport-tags-label"
                multiple
                value={formData.sportTags || []}
                onChange={(e) => {
                  const newValue = e.target.value as string[];
                  let processedValue = [...newValue];
                  
                  if (newValue.includes('Other')) {
                    // If "Other" is selected, keep it in the list for UI
                    // The custom sport will be added separately when user types in the text field
                    if (otherSport.trim() && !processedValue.includes(otherSport.trim())) {
                      processedValue.push(otherSport.trim());
                    }
                  } else {
                    // Remove custom sport if "Other" is deselected
                    const customSport = formData.sportTags?.find(s => !SPORTS.includes(s) && s !== 'Other');
                    if (customSport) {
                      processedValue = processedValue.filter(v => v !== customSport);
                    }
                    setOtherSport('');
                  }
                  setFormData({ ...formData, sportTags: processedValue });
                }}
                input={<OutlinedInput label="Training Types *" />}
                renderValue={(selected) => {
                  // Filter out "Other" from display if we have a custom sport
                  const displayTags = (selected as string[]).filter(tag => {
                    if (tag === 'Other') {
                      return !otherSport.trim() || !(selected as string[]).some(s => !SPORTS.includes(s));
                    }
                    return true;
                  });
                  return (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {displayTags.map((value) => (
                        <Chip 
                          key={value} 
                          label={value} 
                          size="small"
                          onDelete={(e) => {
                            e.stopPropagation();
                            const newTags = (formData.sportTags || []).filter(t => t !== value);
                            // If deleting custom sport, also clear otherSport
                            if (value === otherSport.trim() || (!SPORTS.includes(value) && value !== 'Other')) {
                              setOtherSport('');
                              // Also remove "Other" if it exists
                              const finalTags = newTags.filter(t => t !== 'Other');
                              setFormData({ ...formData, sportTags: finalTags });
                            } else {
                              setFormData({ ...formData, sportTags: newTags });
                            }
                          }}
                        />
                      ))}
                    </Box>
                  );
                }}
              >
                {SPORTS.map((sport) => (
                  <MenuItem key={sport} value={sport}>
                    <Checkbox checked={(formData.sportTags || []).indexOf(sport) > -1} />
                    <span>{sport}</span>
                  </MenuItem>
                ))}
              </Select>
              {formData.sportTags?.includes('Other') && (
                <TextField
                  fullWidth
                  label="Specify other sport"
                  value={otherSport}
                  onChange={(e) => {
                    const newOtherSport = e.target.value.trim();
                    setOtherSport(e.target.value);
                    // Update sportTags: remove old custom value, add new one
                    const currentTags = formData.sportTags || [];
                    const customSport = currentTags.find(s => !SPORTS.includes(s) && s !== 'Other');
                    const updatedTags = currentTags.filter(s => s !== customSport && s !== 'Other');
                    // Always keep "Other" in the list for UI
                    updatedTags.push('Other');
                    if (newOtherSport && !updatedTags.includes(newOtherSport)) {
                      updatedTags.push(newOtherSport);
                    }
                    setFormData({ ...formData, sportTags: updatedTags });
                  }}
                  margin="normal"
                  placeholder="Enter your sport"
                  sx={{ mt: 1 }}
                />
              )}
            </FormControl>

            <FormControl fullWidth sx={{ mb: 3 }}>
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

            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 2 }}>
                Training Mode
              </Typography>
              <Grid container spacing={2}>
                {[
                  { 
                    value: 'TRAIN', 
                    title: 'TRAIN', 
                    description: 'Fitness Partners',
                    icon: <FitnessCenterIcon sx={{ fontSize: 32 }} />,
                    color: '#6366f1'
                  },
                  { 
                    value: 'VIBE', 
                    title: 'VIBE', 
                    description: 'Buddies',
                    icon: <PeopleIcon sx={{ fontSize: 32 }} />,
                    color: '#8b5cf6'
                  },
                  { 
                    value: 'DATE', 
                    title: 'DATE', 
                    description: 'Interested',
                    icon: <FavoriteIcon sx={{ fontSize: 32 }} />,
                    color: '#ec4899'
                  },
                ].map((mode) => (
                  <Grid item xs={12} sm={4} key={mode.value}>
                    <Card
                      onClick={() => setFormData({ ...formData, mode: mode.value as 'TRAIN' | 'VIBE' | 'DATE' })}
                      sx={{
                        cursor: 'pointer',
                        border: formData.mode === mode.value ? `2px solid ${mode.color}` : '2px solid transparent',
                        borderRadius: 2,
                        transition: 'all 0.2s ease',
                        backgroundColor: formData.mode === mode.value ? `${mode.color}08` : 'transparent',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: formData.mode === mode.value 
                            ? `0 8px 16px ${mode.color}30` 
                            : '0 4px 12px rgba(0,0,0,0.1)',
                          borderColor: mode.color,
                        },
                        ...(formData.mode === mode.value && {
                          boxShadow: `0 4px 12px ${mode.color}40`,
                        }),
                      }}
                    >
                      <CardContent sx={{ textAlign: 'center', py: 3 }}>
                        <Box sx={{ color: mode.color, mb: 1 }}>
                          {mode.icon}
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {mode.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {mode.description}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Box>
        );

      case 3: // Availability
        return (
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
              Availability
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Add at least one time slot when you're available to train
            </Typography>

            {(formData.availabilitySchedule || []).map((slot, index) => (
              <Card 
                key={index} 
                elevation={0}
                sx={{ 
                  mb: 2, 
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
                <CardContent sx={{ py: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Time Slot {index + 1}
                    </Typography>
                    <IconButton 
                      size="small" 
                      onClick={() => handleRemoveAvailability(index)}
                      sx={{ 
                        color: 'text.secondary',
                        '&:hover': {
                          color: 'error.main',
                          backgroundColor: 'error.light',
                        },
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                      Days
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {DAYS.map((day) => {
                        const isSelected = slot.days?.includes(day);
                        return (
                          <Chip
                            key={day}
                            label={day}
                            onClick={() => {
                              const currentDays = slot.days || [];
                              const newDays = isSelected
                                ? currentDays.filter(d => d !== day)
                                : [...currentDays, day];
                              handleUpdateAvailability(index, 'days', newDays);
                            }}
                            sx={{
                              backgroundColor: isSelected ? 'primary.main' : 'transparent',
                              color: isSelected ? 'white' : 'text.primary',
                              border: `1px solid ${isSelected ? 'primary.main' : 'divider'}`,
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: isSelected ? 'primary.dark' : 'action.hover',
                              },
                            }}
                          />
                        );
                      })}
                    </Box>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
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
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
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
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            ))}

            <Button 
              variant="outlined" 
              onClick={handleAddAvailability} 
              sx={{ 
                mt: 1,
                borderRadius: 2,
              }}
            >
              + Add Availability Slot
            </Button>
          </Box>
        );

      case 4: // Review
        return (
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
              Review Your Profile
            </Typography>

            {Object.keys(fieldErrors).length > 0 && (
              <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Please fix the following:
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {Object.entries(fieldErrors).map(([field, messages]) =>
                    (messages || []).map((msg, i) => (
                      <li key={`${field}-${i}`}>
                        <Typography variant="body2">{msg}</Typography>
                      </li>
                    ))
                  )}
                </Box>
              </Alert>
            )}

            {[
              {
                title: 'Display Name',
                value: formData.name || 'Not set',
                step: 1,
              },
              {
                title: 'Bio',
                value: formData.bio || 'Not set',
                step: 1,
              },
              {
                title: 'Training Types',
                value: formData.sportTags && formData.sportTags.length > 0 
                  ? formData.sportTags.filter(t => t !== 'Other').join(', ')
                  : 'Not set',
                step: 2,
                chips: formData.sportTags?.filter(t => t !== 'Other'),
              },
              {
                title: 'Skill Level',
                value: formData.level ? formData.level.charAt(0).toUpperCase() + formData.level.slice(1) : 'Not set',
                step: 2,
              },
              {
                title: 'Training Mode',
                value: formData.mode || 'Not set',
                step: 2,
              },
              {
                title: 'Availability',
                value: formData.availabilitySchedule && formData.availabilitySchedule.length > 0
                  ? formData.availabilitySchedule.map((slot) => 
                      `${slot.days?.join(', ') || 'No days'}: ${slot.timeStart} - ${slot.timeEnd}`
                    ).join('; ')
                  : 'Not set',
                step: 3,
                slots: formData.availabilitySchedule,
              },
            ].map((section, idx) => (
              <Card 
                key={idx}
                elevation={0}
                sx={{ 
                  mb: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    boxShadow: 2,
                  },
                }}
              >
                <CardContent sx={{ py: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.75rem', fontWeight: 500 }}>
                        {section.title}
                      </Typography>
                      {section.chips ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                          {section.chips.map((tag) => (
                            <Chip key={tag} label={tag} size="small" sx={{ borderRadius: 1 }} />
                          ))}
                        </Box>
                      ) : section.slots ? (
                        <Box sx={{ mt: 0.5 }}>
                          {section.slots.map((slot: AvailabilitySlot, slotIdx: number) => (
                            <Typography key={slotIdx} variant="body2" sx={{ mb: 0.5 }}>
                              {slot.days?.join(', ') || 'No days'}: {slot.timeStart} - {slot.timeEnd}
                            </Typography>
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {section.value}
                        </Typography>
                      )}
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setActiveStep(section.step);
                        setError('');
                      }}
                      sx={{
                        color: 'primary.main',
                        '&:hover': {
                          backgroundColor: 'primary.light',
                        },
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        );

      default:
        return null;
    }
  };

  const CustomStepConnector = () => (
    <StepConnector
      sx={{
        [`&.${stepConnectorClasses.active}`]: {
          [`& .${stepConnectorClasses.line}`]: {
            borderColor: '#6366f1',
          },
        },
        [`&.${stepConnectorClasses.completed}`]: {
          [`& .${stepConnectorClasses.line}`]: {
            borderColor: '#6366f1',
          },
        },
        [`& .${stepConnectorClasses.line}`]: {
          borderTopWidth: 2,
          borderRadius: 1,
        },
      }}
    />
  );

  return (
    <PageShell variant="onboarding" showBackLink>
      <Box sx={{ mb: 3, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 0.5 }}>
          Complete Your Profile
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Help us match you with the perfect training partner
        </Typography>
        
        {/* Compact Stepper with Step X of 5 */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
            Step {activeStep + 1} of {STEPS.length}
          </Typography>
        </Box>
        
        <Stepper 
          activeStep={activeStep} 
          connector={<CustomStepConnector />}
          sx={{ 
            mb: 0,
            '& .MuiStepLabel-root': {
              '& .MuiStepLabel-label': {
                fontSize: '0.75rem',
                fontWeight: activeStep === STEPS.indexOf(STEPS[activeStep]) ? 600 : 400,
              },
            },
            '& .MuiStepIcon-root': {
              '&.Mui-active': {
                color: '#6366f1',
                '& .MuiStepIcon-text': {
                  fill: 'white',
                },
              },
              '&.Mui-completed': {
                color: '#6366f1',
              },
            },
          }}
        >
          {STEPS.map((label, index) => (
            <Step key={label} completed={index < activeStep} active={index === activeStep}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      <Card 
        elevation={0}
        sx={{ 
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          mb: 3,
        }}
      >
        <CardContent sx={{ py: { xs: 3, md: 4 }, px: { xs: 2, md: 4 } }}>
          {renderStepContent()}
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button 
          disabled={activeStep === 0} 
          onClick={handleBack}
          sx={{ minWidth: 100 }}
        >
          Back
        </Button>
        {activeStep === STEPS.length - 1 ? (
          <Button 
            variant="contained" 
            onClick={handleSubmit} 
            disabled={loading}
            size="large"
            sx={{ 
              minWidth: 200,
              fontWeight: 600,
              px: 4,
              py: 1.5,
              borderRadius: 2,
            }}
          >
            {loading ? (
              <>
                <CircularProgress size={24} color="inherit" sx={{ mr: 1 }} />
                Saving...
              </>
            ) : (
              "You're ready to find your training mate 💪"
            )}
          </Button>
        ) : (
          <Button 
            variant="contained" 
            onClick={handleNext}
            size="large"
            sx={{ 
              minWidth: 100,
              fontWeight: 600,
              px: 3,
              borderRadius: 2,
            }}
          >
            Next
          </Button>
        )}
      </Box>
    </PageShell>
  );
};
