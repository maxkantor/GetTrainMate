import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Card,
  CardContent,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { PageShell } from '@/components/layout/PageShell';
import { profileService, UpdateProfileRequest, AvailabilitySlot } from '@/services/profileService';
import { authService } from '@/services/authService';
import { handleApiError } from '@/utils/apiErrorHandler';
import {
  readLandingPrefs,
  trainingToSportTag,
  landingLevelToProfileLevel,
  timePrefToAvailabilitySlot,
  buildDefaultBio,
} from '@/utils/landingPrefs';
import { getUploadLimits } from '@/config/uploadLimits';

const SPORTS = [
  'Running', 'Cycling', 'Swimming', 'Tennis', 'Basketball', 'Soccer',
  'Volleyball', 'Gym', 'Yoga', 'Hiking', 'Climbing', 'CrossFit',
  'Hyrox', 'Pickleball', 'Fishing', 'Boxing', 'MMA', 'Dancing',
  'Golf', 'Skiing', 'Surfing', 'Rowing', 'CrossFit', 'HIIT',
];

const STEPS = ['Photo', 'Tags', 'Extra photo'];

export const ProfileOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { me, refreshMe } = useMe();

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadingSecond, setUploadingSecond] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [secondFile, setSecondFile] = useState<File | null>(null);
  const [secondPreview, setSecondPreview] = useState<string | null>(null);
  const [secondPhotoKey, setSecondPhotoKey] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const secondInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<UpdateProfileRequest>({
    name: '',
    sportTags: [],
    level: '',
    goals: [],
    availabilitySchedule: [],
    mode: 'TRAIN',
  });

  const defaultName =
    (user?.email?.split('@')[0] || 'Athlete').replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 40) || 'Athlete';

  const loadExisting = useCallback(async () => {
    try {
      const token = await authService.getJWT();
      if (!token) return;
      const profile = await profileService.getMyProfile(token);
      const prefs = readLandingPrefs();
      if (profile) {
        setFormData({
          name: profile.name || defaultName,
          sportTags: profile.sportTags?.length ? profile.sportTags : prefs ? [trainingToSportTag(prefs.training)] : [],
          level: profile.level || (prefs ? landingLevelToProfileLevel(prefs.level) : ''),
          goals: profile.goals ?? [],
          availabilitySchedule: profile.availabilitySchedule ?? [],
          mode: profile.mode || 'TRAIN',
        });
        if (profile.photoKey) {
          setPhotoKey(profile.photoKey);
          try {
            setPhotoPreview(await profileService.getPhotoUrl(token, profile.photoKey));
          } catch {
            /* ignore */
          }
        }
      } else {
        setFormData((prev) => ({
          ...prev,
          name: defaultName,
          sportTags: prefs ? [trainingToSportTag(prefs.training)] : [],
          level: prefs ? landingLevelToProfileLevel(prefs.level) : '',
        }));
      }
    } catch (e) {
      console.error(e);
    }
  }, [defaultName]);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  const processFile = (selectedFile: File, which: 'first' | 'second') => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Please select a JPG, PNG, or WebP image');
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }
    setError('');
    if (which === 'first') {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result && typeof reader.result === 'string') setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setSecondFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result && typeof reader.result === 'string') setSecondPreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleUploadPrimary = async () => {
    if (!file) return;
    try {
      setUploading(true);
      setError('');
      const token = await authService.getJWT();
      if (!token) {
        setError('Not authenticated');
        return;
      }
      const uploadInfo = await profileService.getPhotoUploadUrl(token, file.type);
      const uploadResponse = await fetch(uploadInfo.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!uploadResponse.ok) throw new Error('Failed to upload photo');
      setPhotoKey(uploadInfo.key);
      try {
        setPhotoPreview(await profileService.getPhotoUrl(token, uploadInfo.key));
      } catch {
        /* keep data url */
      }
    } catch (err: unknown) {
      setError(handleApiError(err as Error).message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadSecond = async () => {
    if (!secondFile) return;
    const limits = getUploadLimits(me?.credits ?? 0);
    if (limits.maxPhotos < 2) {
      setError('More photos require credits. See Pricing.');
      return;
    }
    try {
      setUploadingSecond(true);
      setError('');
      const token = await authService.getJWT();
      if (!token) return;
      const uploadInfo = await profileService.getPhotoUploadUrl(token, secondFile.type);
      const uploadResponse = await fetch(uploadInfo.uploadUrl, {
        method: 'PUT',
        body: secondFile,
        headers: { 'Content-Type': secondFile.type },
      });
      if (!uploadResponse.ok) throw new Error('Failed to upload');
      setSecondPhotoKey(uploadInfo.key);
      try {
        setSecondPreview(await profileService.getPhotoUrl(token, uploadInfo.key));
      } catch {
        /* keep data url */
      }
    } catch (err: unknown) {
      setError(handleApiError(err as Error).message || 'Upload failed');
    } finally {
      setUploadingSecond(false);
    }
  };

  const toggleTag = (sport: string) => {
    setFormData((prev) => {
      const cur = [...(prev.sportTags || [])].filter((t) => t !== 'Other');
      const has = cur.includes(sport);
      let next = has ? cur.filter((t) => t !== sport) : [...cur, sport];
      if (next.length > 3) next = next.slice(0, 3);
      return { ...prev, sportTags: next };
    });
  };

  const handleNext = () => {
    if (activeStep === 0) {
      if (!photoKey) {
        setError('Upload a profile photo to continue.');
        return;
      }
    }
    if (activeStep === 1) {
      const tags = (formData.sportTags || []).filter((t) => t && t !== 'Other');
      if (tags.length < 2 || tags.length > 3) {
        setError('Select 2–3 tags (sports or goals).');
        return;
      }
      if (!formData.level) {
        setError('Select your level.');
        return;
      }
    }
    setError('');
    setActiveStep((s) => s + 1);
  };

  const handleBack = () => {
    setError('');
    setActiveStep((s) => Math.max(0, s - 1));
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
      const prefs = readLandingPrefs();
      const name = (formData.name?.trim() || defaultName).slice(0, 80);
      const level = formData.level || landingLevelToProfileLevel(prefs?.level || 'Intermediate');
      const tags = (formData.sportTags || []).filter((t) => t && t !== 'Other').slice(0, 3);
      const bio = buildDefaultBio(tags, level);
      const timeKey = prefs?.timePref ?? 'Evening';
      const slot: AvailabilitySlot = timePrefToAvailabilitySlot(timeKey);

      await profileService.updateMyProfile(token, {
        name,
        bio,
        sportTags: tags,
        level,
        goals: formData.goals?.length ? formData.goals : [],
        availabilitySchedule: [slot],
        mode: 'TRAIN',
        photoKey: photoKey || undefined,
      });

      if (secondPhotoKey) {
        await profileService.addPhoto(token, secondPhotoKey);
      }

      await refreshMe();
      navigate('/app/discover', { state: { profileJustCompleted: true }, replace: true });
    } catch (err: unknown) {
      setError(handleApiError(err as Error).message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const limits = getUploadLimits(me?.credits ?? 0);

  return (
    <PageShell variant="onboarding" showBackLink>
      <Box sx={{ mb: 3, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 0.5 }}>
          Complete your profile
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Step {activeStep + 1} of {STEPS.length}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 3 }}>
        <CardContent sx={{ py: { xs: 3, md: 4 }, px: { xs: 2, md: 4 } }}>
          {activeStep === 0 && (
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                Profile photo
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Profiles with photos get more matches. Add a clear face photo.
              </Typography>
              <Box
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) processFile(f, 'first');
                }}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  width: 200,
                  height: 200,
                  borderRadius: '50%',
                  border: dragActive ? '3px dashed #6366f1' : photoPreview ? 'none' : '2px dashed #d1d5db',
                  mx: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {photoPreview ? (
                  <>
                    <img
                      src={photoPreview}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                    />
                    <Box
                      sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.5)', borderRadius: '50%', p: 0.5 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setPhotoPreview(null);
                        setPhotoKey(null);
                      }}
                    >
                      <DeleteIcon sx={{ color: 'white', fontSize: 20 }} />
                    </Box>
                  </>
                ) : (
                  <>
                    <CloudUploadIcon sx={{ fontSize: 48, color: '#9ca3af', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      Click or drop photo
                    </Typography>
                  </>
                )}
              </Box>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) processFile(f, 'first');
                }}
              />
              {file && !photoKey && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Button variant="contained" onClick={handleUploadPrimary} disabled={uploading}>
                    {uploading ? <CircularProgress size={22} color="inherit" /> : 'Upload photo'}
                  </Button>
                </Box>
              )}
            </Box>
          )}

          {activeStep === 1 && (
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                Sports & goals
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select 2–3 tags.
              </Typography>
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel id="lvl-label">Level</InputLabel>
                <Select
                  labelId="lvl-label"
                  label="Level"
                  value={formData.level || ''}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                >
                  <MenuItem value="beginner">Beginner</MenuItem>
                  <MenuItem value="intermediate">Intermediate</MenuItem>
                  <MenuItem value="advanced">Advanced</MenuItem>
                </Select>
              </FormControl>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {SPORTS.map((s) => {
                  const selected = (formData.sportTags || []).includes(s);
                  return (
                    <Chip
                      key={s}
                      label={s}
                      onClick={() => toggleTag(s)}
                      color={selected ? 'primary' : 'default'}
                      variant={selected ? 'filled' : 'outlined'}
                    />
                  );
                })}
              </Box>
            </Box>
          )}

          {activeStep === 2 && (
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                Extra photo (optional)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Profiles with photos get more matches.
                {limits.maxPhotos < 2 && (
                  <>
                    {' '}
                    <Link to="/pricing">Get credits</Link> to add more photos.
                  </>
                )}
              </Typography>
              {limits.maxPhotos >= 2 && (
                <>
                  <Box
                    onClick={() => secondInputRef.current?.click()}
                    sx={{
                      width: 160,
                      height: 160,
                      borderRadius: 2,
                      border: '2px dashed #d1d5db',
                      mx: 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      overflow: 'hidden',
                    }}
                  >
                    {secondPreview ? (
                      <img src={secondPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Typography variant="caption" color="text.secondary" align="center" sx={{ px: 1 }}>
                        Add second photo
                      </Typography>
                    )}
                  </Box>
                  <input
                    ref={secondInputRef}
                    type="file"
                    hidden
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) processFile(f, 'second');
                    }}
                  />
                  {secondFile && !secondPhotoKey && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                      <Button variant="outlined" onClick={handleUploadSecond} disabled={uploadingSecond}>
                        {uploadingSecond ? <CircularProgress size={22} /> : 'Upload'}
                      </Button>
                    </Box>
                  )}
                </>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button disabled={activeStep === 0} onClick={handleBack} sx={{ minWidth: 100 }}>
          Back
        </Button>
        {activeStep < STEPS.length - 1 ? (
          <Button variant="contained" onClick={handleNext} size="large" sx={{ fontWeight: 600, px: 3, borderRadius: 2 }}>
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading}
            size="large"
            sx={{ fontWeight: 600, px: 3, borderRadius: 2 }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Finish & go to Discover'}
          </Button>
        )}
      </Box>
    </PageShell>
  );
};
