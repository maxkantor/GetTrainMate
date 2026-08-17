import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Snackbar, Typography } from '@mui/material';
import { trackEvent } from '@/utils/analytics';
import {
  buildReferralShareUrl,
  opaqueReferralCode,
  profileHasTrainMode,
  shareOrCopyReferralLink,
} from '@/utils/referralInvite';

type InviteTrainingPartnerButtonProps = {
  userId?: string;
  profile?: { mode?: string; modes?: string[] } | null;
  surface: 'profile' | 'discover';
};

export const InviteTrainingPartnerButton: React.FC<InviteTrainingPartnerButtonProps> = ({
  userId,
  profile,
  surface,
}) => {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const eligible = Boolean(userId) && profileHasTrainMode(profile);

  useEffect(() => {
    if (!eligible) return;
    trackEvent('referral_cta_impression', {
      source_page: surface === 'profile' ? '/app/profile' : '/app/discover',
      metro: 'Atlanta',
      segment: 'TRAIN',
      experiment_id: 'EXP-003',
    });
  }, [eligible, surface]);

  if (!eligible || !userId) return null;

  const onInvite = async () => {
    setBusy(true);
    trackEvent('referral_share_attempted', {
      source_page: surface === 'profile' ? '/app/profile' : '/app/discover',
      metro: 'Atlanta',
      segment: 'TRAIN',
      experiment_id: 'EXP-003',
    });
    try {
      const code = await opaqueReferralCode(userId);
      const url = buildReferralShareUrl(code);
      const result = await shareOrCopyReferralLink(url);
      if (result === 'shared') {
        trackEvent('referral_share_confirmed', {
          source_page: surface === 'profile' ? '/app/profile' : '/app/discover',
          experiment_id: 'EXP-003',
        });
        setToast('Invite shared. They can create an Atlanta TRAIN profile from your link.');
      } else if (result === 'copied') {
        trackEvent('referral_link_copied', {
          source_page: surface === 'profile' ? '/app/profile' : '/app/discover',
          experiment_id: 'EXP-003',
        });
        setToast('Invite link copied. Paste it to someone looking for an Atlanta training partner.');
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
        Invite a training partner
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Share a private Atlanta TRAIN signup link. You choose who sees it — we never message your contacts.
      </Typography>
      <Button variant="contained" onClick={() => void onInvite()} disabled={busy}>
        {busy ? 'Preparing link…' : 'Invite a training partner'}
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
