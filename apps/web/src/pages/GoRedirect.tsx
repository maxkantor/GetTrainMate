import React, { useEffect, useMemo } from 'react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Box, Button, Container, Typography } from '@mui/material';
import { PageShell } from '@/components/layout/PageShell';
import { useI18n } from '@/hooks/useI18n';
import { trackEvent } from '@/utils/analytics';

/** Short owned-social destination codes → mode landing pages (with preserved UTMs). */
export const GO_CODE_LANDINGS: Record<string, string> = {
  t: '/workout-partner',
  train: '/workout-partner',
  v: '/meet-people',
  vibe: '/meet-people',
  d: '/active-dating',
  date: '/active-dating',
  sf: '/san-francisco',
  signup: '/signup',
  ig: '/go',
  fb: '/go',
};

/**
 * Instant redirect for short owned-social links (Instagram captions / bio).
 * Preserves UTM + attribution query params onto the real landing.
 */
export const GoRedirectPage: React.FC = () => {
  const { t } = useI18n();
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
          {t('landing.go_opening')}
        </Typography>
      </Container>
    </PageShell>
  );
};

/** Permanent Instagram bio / caption hub — always clickable once bio points here. */
export const GoHubPage: React.FC = () => {
  const { t } = useI18n();

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
          {t('landing.go_hub_eyebrow')}
        </Typography>
        <Typography
          variant="h2"
          component="h1"
          sx={{ mt: 1, fontSize: { xs: '1.85rem', md: '2.4rem' }, fontWeight: 800, lineHeight: 1.15 }}
        >
          {t('landing.go_hub_title')}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2, maxWidth: 560, lineHeight: 1.7 }}>
          {t('landing.go_hub_sub')}
        </Typography>
        <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1.5, maxWidth: 420 }}>
          <Button
            component={RouterLink}
            to="/signup?mode=TRAIN&src=go-hub"
            variant="contained"
            size="large"
            onClick={() => trackEvent('signup_started', { source_page: '/go', mode: 'TRAIN' })}
          >
            {t('landing.go_hub_train_cta')}
          </Button>
          <Button
            component={RouterLink}
            to="/signup?mode=VIBE&src=go-hub"
            variant="outlined"
            size="large"
            onClick={() => trackEvent('signup_started', { source_page: '/go', mode: 'VIBE' })}
          >
            {t('landing.go_hub_vibe_cta')}
          </Button>
          <Button
            component={RouterLink}
            to="/signup?mode=DATE&src=go-hub"
            variant="outlined"
            size="large"
            onClick={() => trackEvent('signup_started', { source_page: '/go', mode: 'DATE' })}
          >
            {t('landing.go_hub_date_cta')}
          </Button>
        </Box>
      </Container>
    </PageShell>
  );
};
