import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, Navigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Container,
  IconButton,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { PageShell } from '@/components/layout/PageShell';
import { trackEvent } from '@/utils/analytics';
import { mergeAndPersistAcquisition } from '@/utils/acquisitionAttribution';
import {
  INITIAL_MARKET_CANDIDATES,
  normalizeInviteCode,
  partnerHubPath,
  partnerSignupPath as marketSignupPath,
  slugPart,
} from '@/data/markets';
import { getAtlantaPartner, normalizePartnerCode } from '@/data/atlantaPartners';

function marketLabel(country: string, market: string): string {
  const hit = INITIAL_MARKET_CANDIDATES.find(
    (m) => m.country === country && m.market === market
  );
  if (hit) return hit.displayName;
  return market
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

/**
 * Acquisition invite landing for organizations and communities.
 * Does not imply an existing partnership — recipient can use GetTrainMate,
 * share with members, or learn more.
 */
export const AtlantaPartnerLandingPage: React.FC = () => {
  const { country: countryParam, market: marketParam, partnerCode, inviteCode } = useParams<{
    country?: string;
    market?: string;
    partnerCode?: string;
    inviteCode?: string;
  }>();
  const country = slugPart(countryParam || 'us') || 'us';
  const market = slugPart(marketParam || 'atlanta') || 'atlanta';
  const isAtlanta = country === 'us' && market === 'atlanta';
  const codeRaw = partnerCode || inviteCode || '';
  const { partner, known } = useMemo(() => {
    if (isAtlanta) {
      const hit = getAtlantaPartner(codeRaw);
      if (hit) return { partner: hit, known: true };
      return {
        known: false,
        partner: {
          code: normalizePartnerCode(codeRaw) || normalizeInviteCode(codeRaw) || 'atl-generic-train',
          displayName: '',
          blurb: '',
        },
      };
    }
    return {
      known: false,
      partner: {
        code: normalizeInviteCode(codeRaw) || 'invite',
        displayName: '',
        blurb: '',
      },
    };
  }, [codeRaw, isAtlanta]);
  const city = marketLabel(country, market);
  const displayName =
    known && partner.displayName ? partner.displayName : `${city} fitness community`;
  const signupTo = marketSignupPath({
    country,
    market,
    mode: 'TRAIN',
    inviteCode: partner.code,
    experimentId: isAtlanta ? 'EXP-002' : undefined,
  });
  const path = `/partners/${country}/${market}/${partner.code}`;
  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${path}`
      : `https://gettrainmate.com${path}`;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    mergeAndPersistAcquisition({
      src: 'partner',
      partner: partner.code,
      metro: city,
      mode: 'TRAIN',
      experiment_id: market === 'atlanta' ? 'EXP-002' : undefined,
      utm_source: 'partner_outreach',
      utm_medium: 'email',
      utm_campaign: `${country}_${market}_train_partners`,
    });
    trackEvent('landing_page_view', {
      source_page: path,
      metro: city,
      country,
      market,
      segment: 'TRAIN',
      acquisition_source: 'partner',
      partner_code: partner.code,
      partner_known: known ? '1' : '0',
    });
  }, [partner.code, known, city, country, market, path]);

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      trackEvent('partner_share_copy', {
        source_page: path,
        partner_code: partner.code,
      });
      mergeAndPersistAcquisition({
        src: 'partner',
        partner: partner.code,
        utm_content: 'share_members',
      });
    } catch {
      /* ignore */
    }
  };

  return (
    <PageShell variant="content" showBackLink>
      <Container maxWidth="md" disableGutters sx={{ maxWidth: '100%', px: { xs: 2, sm: 0 } }}>
        <Typography
          variant="h2"
          component="h1"
          sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, fontWeight: 800, lineHeight: 1.2 }}
        >
          GetTrainMate
        </Typography>
        <Typography
          variant="h3"
          component="p"
          sx={{ mt: 1.5, fontSize: { xs: '1.25rem', md: '1.5rem' }, fontWeight: 700 }}
        >
          Train together. See where it goes.
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2, maxWidth: 560, lineHeight: 1.7 }}>
          A social fitness platform built around real activities — for you and your community in{' '}
          {city}.
          {known && partner.displayName ? ` Invite for ${displayName}.` : null}
        </Typography>

        <Box sx={{ mt: 3, display: 'grid', gap: 1.5, maxWidth: 560 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            TRAIN
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: -1 }}>
            Find workout and sports partners.
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            VIBE
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: -1 }}>
            Meet people through shared activities.
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            DATE
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: -1 }}>
            If there&apos;s chemistry, see where it goes.
          </Typography>
        </Box>

        <Typography variant="h6" sx={{ mt: 4, fontWeight: 800 }}>
          For you or your community
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2, maxWidth: 560 }}>
          Create your own account, share an invite with members, or learn more. This page does not
          mean {displayName} is already affiliated with GetTrainMate.
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
          <Button
            component={RouterLink}
            to={signupTo}
            variant="contained"
            size="large"
            onClick={() =>
              trackEvent('signup_started', {
                source_page: path,
                metro: city,
                country,
                market,
                segment: 'TRAIN',
                acquisition_source: 'partner',
                partner_code: partner.code,
                cta: 'create_account',
              })
            }
          >
            Create an account
          </Button>
          <Button variant="outlined" size="large" onClick={() => void copyShare()}>
            Share with members
          </Button>
          <Button component={RouterLink} to="/how-it-works" variant="text" size="large">
            Learn more
          </Button>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, maxWidth: 560, mb: 2 }}>
          <TextField
            size="small"
            fullWidth
            value={shareUrl}
            InputProps={{ readOnly: true }}
            label="Member invite link"
          />
          <IconButton aria-label="Copy invite link" onClick={() => void copyShare()}>
            <ContentCopyIcon />
          </IconButton>
        </Box>

        <Typography variant="caption" color="text.secondary" display="block">
          Invite code <strong>{partner.code}</strong> · {city}
        </Typography>
        <Button
          component={RouterLink}
          to={partnerHubPath(country, market)}
          variant="text"
          size="small"
          sx={{ mt: 1, px: 0 }}
        >
          More {city} invites
        </Button>
      </Container>
      <Snackbar open={copied} autoHideDuration={2500} onClose={() => setCopied(false)}>
        <Alert severity="success" onClose={() => setCopied(false)}>
          Invite link copied — share with members.
        </Alert>
      </Snackbar>
    </PageShell>
  );
};

export function LegacyAtlantaPartnerRedirect(): React.ReactElement {
  const { partnerCode } = useParams<{ partnerCode: string }>();
  return <Navigate to={`/partners/us/atlanta/${slugPart(partnerCode || '')}`} replace />;
}

export default AtlantaPartnerLandingPage;
