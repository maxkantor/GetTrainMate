import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useMe } from '@/hooks/useMe';
import { useAuthContext } from '@/hooks/useAuthContext';
import { profileService } from '@/services/profileService';
import { authService } from '@/services/authService';
import { handleApiError } from '@/utils/apiErrorHandler';
import { buildDefaultBio } from '@/utils/landingPrefs';
import {
  DASHBOARD_TRAINING_OPTIONS,
  DASHBOARD_LEVEL_OPTIONS,
  DASHBOARD_TIME_OPTIONS,
  dashboardTimeToAvailabilitySlot,
  type DashboardTimeId,
} from '@/config/dashboardQuickSetup';
import { readSignupDisplayName, clearSignupDisplayName } from '@/utils/pendingSignupStorage';

/**
 * First-time dashboard: one-tap training type, level, and time — then profile is complete enough for Discover.
 */
export const DashboardQuickSetup: React.FC = () => {
  const navigate = useNavigate();
  const { me, refreshMe } = useMe();
  const { user } = useAuthContext();
  const [trainingTag, setTrainingTag] = useState<string>(DASHBOARD_TRAINING_OPTIONS[0].tag);
  const [level, setLevel] = useState<string>('intermediate');
  const [timeId, setTimeId] = useState<DashboardTimeId>('evening');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const displayName =
    me?.profile?.name?.trim() ||
    readSignupDisplayName() ||
    user?.email?.split('@')[0]?.replace(/[^a-zA-Z0-9 _-]/g, '') ||
    'Athlete';

  const handleSubmit = async () => {
    setError('');
    try {
      setSaving(true);
      const token = await authService.getJWT();
      if (!token) {
        setError('Not signed in');
        return;
      }
      const name = displayName.slice(0, 80);
      const bio = buildDefaultBio([trainingTag], level);
      const slot = dashboardTimeToAvailabilitySlot(timeId);
      await profileService.updateMyProfile(token, {
        name,
        bio,
        sportTags: [trainingTag],
        level,
        goals: [],
        availabilitySchedule: [slot],
        mode: 'TRAIN',
      });
      await refreshMe();
      clearSignupDisplayName();
      navigate('/app/discover', { replace: true });
    } catch (e: unknown) {
      setError(handleApiError(e as Error).message || 'Could not save preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 3,
        borderRadius: 3,
        borderColor: 'rgba(129, 140, 248, 0.35)',
        background:
          'linear-gradient(145deg, rgba(99, 102, 241, 0.12) 0%, rgba(15, 18, 30, 0.65) 100%)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
      }}
    >
      <CardContent sx={{ py: { xs: 2.5, sm: 3 }, px: { xs: 2, sm: 3 } }}>
        <Typography variant="overline" color="primary.light" sx={{ letterSpacing: '0.14em', fontWeight: 700 }}>
          Quick setup
        </Typography>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 800, mt: 0.5, mb: 0.5 }}>
          Let&apos;s set up your training preferences.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: 520 }}>
          We&apos;ll use this to find better matches.
        </Typography>

        {error ? (
          <Typography variant="body2" color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        ) : null}

        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700, color: 'text.secondary' }}>
          Training type
        </Typography>
        <ToggleButtonGroup
          exclusive
          value={trainingTag}
          onChange={(_, v) => v != null && setTrainingTag(v)}
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            mb: 2.5,
            '& .MuiToggleButton-root': {
              flex: '1 1 calc(50% - 8px)',
              minWidth: 120,
              minHeight: 48,
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: 2,
            },
          }}
        >
          {DASHBOARD_TRAINING_OPTIONS.map((o) => (
            <ToggleButton key={o.id} value={o.tag}>
              {o.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700, color: 'text.secondary' }}>
          Level
        </Typography>
        <ToggleButtonGroup
          exclusive
          value={level}
          onChange={(_, v) => v != null && setLevel(v)}
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            mb: 2.5,
            '& .MuiToggleButton-root': {
              flex: '1 1 calc(33% - 8px)',
              minWidth: 100,
              minHeight: 48,
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: 2,
            },
          }}
        >
          {DASHBOARD_LEVEL_OPTIONS.map((o) => (
            <ToggleButton key={o.id} value={o.id}>
              {o.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700, color: 'text.secondary' }}>
          Preferred time
        </Typography>
        <ToggleButtonGroup
          exclusive
          value={timeId}
          onChange={(_, v) => v != null && setTimeId(v)}
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            mb: 2.5,
            '& .MuiToggleButton-root': {
              flex: '1 1 calc(33% - 8px)',
              minWidth: 100,
              minHeight: 48,
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: 2,
            },
          }}
        >
          {DASHBOARD_TIME_OPTIONS.map((o) => (
            <ToggleButton key={o.id} value={o.id}>
              {o.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={saving}
          onClick={() => void handleSubmit()}
          sx={{ py: 1.5, fontWeight: 800, borderRadius: 2 }}
        >
          {saving ? <CircularProgress size={26} color="inherit" /> : 'Find My Matches'}
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1.5 }}>
          Takes less than 30 seconds
        </Typography>
      </CardContent>
    </Card>
  );
};
