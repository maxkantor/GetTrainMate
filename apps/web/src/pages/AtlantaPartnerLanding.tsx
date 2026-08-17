import React, { useEffect, useMemo } from 'react';
import { Link as RouterLink, Navigate, useParams } from 'react-router-dom';
import { Box, Button, Container, Typography } from '@mui/material';
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
 * Market partner invite landing. Atlanta TRAIN (EXP-002) remains the first campaign;
 * other markets use the same template without implying an existing partnership.
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
  const displayName = known && partner.displayName ? partner.displayName : `${city} training community invite`;
  const blurb =
    known && partner.blurb
      ? partner.blurb
      : `This is an invitation to find local training partners in ${city}. It does not mean the organization has an existing partnership with GetTrainMate.`;
  const signupTo = marketSignupPath({
    country,
    market,
    mode: 'TRAIN',
    inviteCode: partner.code,
    experimentId: isAtlanta ? 'EXP-002' : undefined,
  });
  const path = `/partners/${country}/${market}/${partner.code}`;

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
          sx={{ mt: 1.5, fontSize: { xs: '1.15rem', md: '1.35rem' }, fontWeight: 600 }}
        >
          {displayName}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2, maxWidth: 560, lineHeight: 1.7 }}>
          {blurb}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, maxWidth: 560, lineHeight: 1.7 }}>
          Invite code <strong>{partner.code}</strong> · {city} · TRAIN (VIBE and DATE stay available after
          signup). Create a free account, set your city, then start Discover — no match guarantees.
        </Typography>

        <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
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
              })
            }
          >
            Join with this invite
          </Button>
          <Button component={RouterLink} to={partnerHubPath(country, market)} variant="outlined" size="large">
            {city} partner invites
          </Button>
        </Box>
      </Container>
    </PageShell>
  );
};

export function LegacyAtlantaPartnerRedirect(): React.ReactElement {
  const { partnerCode } = useParams<{ partnerCode: string }>();
  return <Navigate to={`/partners/us/atlanta/${slugPart(partnerCode || '')}`} replace />;
}

export default AtlantaPartnerLandingPage;
