import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Snackbar, Typography } from '@mui/material';
import { trackEvent } from '@/utils/analytics';
import {
  buildReferralShareUrl,
  opaqueReferralCode,
  profileHasSupportedMode,
  referralMode,
  shareOrCopyReferralLink,
} from '@/utils/referralInvite';

type InviteTrainingPartnerButtonProps = {
  userId?: string;
  profile?: { mode?: string; modes?: string[]; city?: string } | null;
  surface: 'profile' | 'discover';
};

function inviteCopy(mode: string): { title: string; body: string; cta: string; toastShared: string; toastCopied: string } {
  if (mode === 'VIBE') {
    return {
      title: 'Invite someone to hang out',
      body: 'Share a private VIBE signup link. You choose who sees it — we never message your contacts.',
      cta: 'Invite a friend',
      toastShared: 'Invite shared. They can create a VIBE profile from your link.',
      toastCopied: 'Invite link copied. Paste it to someone looking for local plans.',
    };
  }
  if (mode === 'DATE') {
    return {
      title: 'Invite someone to DATE',
      body: 'Share a private DATE signup link. You choose who sees it — we never message your contacts.',
      cta: 'Invite someone',
      toastShared: 'Invite shared. They can create a DATE profile from your link.',
      toastCopied: 'Invite link copied. Paste it to someone interested in activity-based dating.',
    };
  }
  return {
    title: 'Invite a training partner',
    body: 'Share a private TRAIN signup link. You choose who sees it — we never message your contacts.',
    cta: 'Invite a training partner',
    toastShared: 'Invite shared. They can create a TRAIN profile from your link.',
    toastCopied: 'Invite link copied. Paste it to someone looking for a local training partner.',
  };
}

/** User-initiated invite for TRAIN, VIBE, or DATE (EXP-003 expanded). */
export const InviteTrainingPartnerButton: React.FC<InviteTrainingPartnerButtonProps> = ({
  userId,
  profile,
  surface,
}) => {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const eligible = Boolean(userId) && profileHasSupportedMode(profile);
  const city = String(profile && 'city' in profile ? profile.city : '').trim();
  const mode = referralMode(profile);
  const copy = inviteCopy(mode);

  useEffect(() => {
    if (!eligible) return;
    trackEvent('invite_impression', {
      source_page: surface === 'profile' ? '/app/profile' : '/app/discover',
      metro: city || undefined,
      mode,
      experiment_id: 'EXP-003',
    });
    trackEvent('referral_cta_impression', {
      source_page: surface === 'profile' ? '/app/profile' : '/app/discover',
      metro: city || undefined,
      segment: mode,
      experiment_id: 'EXP-003',
    });
  }, [eligible, surface, city, mode]);

  if (!eligible || !userId) return null;

  const onInvite = async () => {
    setBusy(true);
    trackEvent('invite_start', {
      source_page: surface === 'profile' ? '/app/profile' : '/app/discover',
      metro: city || undefined,
      mode,
      experiment_id: 'EXP-003',
    });
    trackEvent('referral_share_attempted', {
      source_page: surface === 'profile' ? '/app/profile' : '/app/discover',
      metro: city || undefined,
      segment: mode,
      experiment_id: 'EXP-003',
    });
    try {
      const code = await opaqueReferralCode(userId);
      const url = buildReferralShareUrl(code, undefined, { city, mode });
      const result = await shareOrCopyReferralLink(url);
      if (result === 'shared') {
        trackEvent('invite_sent', {
          source_page: surface === 'profile' ? '/app/profile' : '/app/discover',
          mode,
          experiment_id: 'EXP-003',
        });
        trackEvent('referral_share_confirmed', {
          source_page: surface === 'profile' ? '/app/profile' : '/app/discover',
          experiment_id: 'EXP-003',
        });
        setToast(copy.toastShared);
      } else if (result === 'copied') {
        trackEvent('invite_link_copied', {
          source_page: surface === 'profile' ? '/app/profile' : '/app/discover',
          mode,
          experiment_id: 'EXP-003',
        });
        trackEvent('referral_link_copied', {
          source_page: surface === 'profile' ? '/app/profile' : '/app/discover',
          experiment_id: 'EXP-003',
        });
        setToast(copy.toastCopied);
      } else if (result === 'aborted') {
        setToast(null);
      } else {
        setToast('Could not share or copy the link. Try again from this device.');
      }
    } catch {
      setToast('Could not create an invite link. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.5 }}>
        {copy.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {copy.body}
      </Typography>
      <Button variant="contained" onClick={() => void onInvite()} disabled={busy}>
        {busy ? 'Preparing link…' : copy.cta}
      </Button>
      <Snackbar
        open={!!toast}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="info" onClose={() => setToast(null)} sx={{ width: '100%' }}>
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
};
