import React, { useEffect, useMemo } from 'react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Box, Button, Container, Typography } from '@mui/material';
import { PageShell } from '@/components/layout/PageShell';
import { trackEvent } from '@/utils/analytics';

/** Short owned-social destination codes → signup (mode is on the query string). */
export const GO_CODE_LANDINGS: Record<string, string> = {
  t: '/signup',
  train: '/signup',
  v: '/signup',
  vibe: '/signup',
  d: '/signup',
  date: '/signup',
  sf: '/san-francisco',
  ig: '/go',
  fb: '/go',
};

/**
 * Instant redirect for short owned-social links (Instagram captions / bio).
 * Preserves UTM + attribution query params onto the real landing.
 */
export const GoRedirectPage: React.FC = () => {
  const { code: rawCode } = useParams<{ code?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = String(rawCode || '')
    .trim()
    .toLowerCase();

  const targetPath = useMemo(() => {
    if (!code) return '/go';
    return GO_CODE_LANDINGS[code] || '/go';
  }, [code]);

  useEffect(() => {
    const qs = searchParams.toString();
    // ig/fb codes land on the hub; mode codes go to /signup with UTMs + mode preserved.
    const path = code === 'ig' || code === 'fb' ? '/go' : targetPath;
    const to = path === '/go' ? '/go' : qs ? `${path}?${qs}` : path;
    trackEvent('owned_social_go_redirect', {
      source_page: `/go/${code || ''}`,
      destination: path,
      go_code: code || undefined,
    });
    navigate(to, { replace: true });
  }, [code, navigate, searchParams, targetPath]);

  return (
    <PageShell variant="content" showBackLink={false}>
      <Container maxWidth="sm" sx={{ py: 6, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          Opening GetTrainMate…
        </Typography>
      </Container>
    </PageShell>
  );
};

/** Permanent Instagram bio / caption hub — always clickable once bio points here. */
export const GoHubPage: React.FC = () => {
  useEffect(() => {
    trackEvent('landing_page_view', {
      source_page: '/go',
      acquisition_source: 'owned_social_go_hub',
    });
  }, []);

  return (
    <PageShell variant="content" showBackLink>
      <Container maxWidth="md" disableGutters sx={{ maxWidth: '100%', px: { xs: 2, sm: 0 } }}>
        <Typography
          variant="overline"
          component="p"
          sx={{ letterSpacing: 1.2, color: 'primary.main', fontWeight: 700 }}
        >
          GetTrainMate
        </Typography>
        <Typography
          variant="h2"
          component="h1"
          sx={{ mt: 1, fontSize: { xs: '1.85rem', md: '2.4rem' }, fontWeight: 800, lineHeight: 1.15 }}
        >
          Choose how you want to connect
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2, maxWidth: 560, lineHeight: 1.7 }}>
          Free to join. TRAIN, VIBE, or DATE — you pick the mode. Matches are never guaranteed.
        </Typography>
        <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1.5, maxWidth: 420 }}>
          <Button
            component={RouterLink}
            to="/signup?mode=TRAIN&src=go-hub"
            variant="contained"
            size="large"
            onClick={() => trackEvent('signup_started', { source_page: '/go', mode: 'TRAIN' })}
          >
            TRAIN — find workout partners
          </Button>
          <Button
            component={RouterLink}
            to="/signup?mode=VIBE&src=go-hub"
            variant="outlined"
            size="large"
            onClick={() => trackEvent('signup_started', { source_page: '/go', mode: 'VIBE' })}
          >
            VIBE — meet people
          </Button>
          <Button
            component={RouterLink}
            to="/signup?mode=DATE&src=go-hub"
            variant="outlined"
            size="large"
            onClick={() => trackEvent('signup_started', { source_page: '/go', mode: 'DATE' })}
          >
            DATE — activity dating
          </Button>
        </Box>
      </Container>
    </PageShell>
  );
};
