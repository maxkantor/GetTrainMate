import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, Container, Snackbar, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { BackLink } from '@/components/ui/BackLink';
import { useI18n } from '@/hooks/useI18n';
import { formatI18n } from '@/i18n';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import { trackEvent } from '@/utils/analytics';

const ACTIVITY_LABEL_KEYS: Record<string, string> = {
  train: 'sports_event_layer.activity_train',
  play: 'sports_event_layer.activity_play',
  watch: 'sports_event_layer.activity_watch',
  meet: 'sports_event_layer.activity_meet',
  vibe: 'sports_event_layer.activity_vibe',
  date: 'sports_event_layer.activity_date',
};
const EN_DEFAULT_EVENT_COPY = 'find people to train, play, watch, meet, vibe, or date';
const EN_SOCIAL_PROOF_LINE = 'fans are already connecting near you';

const isSeededEnglishEventCopy = (value?: string) => {
  const normalized = (value ?? '').toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();
  return normalized.includes(EN_DEFAULT_EVENT_COPY) || normalized.includes(EN_SOCIAL_PROOF_LINE);
};

export const EventLandingPage: React.FC = () => {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const [toast, setToast] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ['sports-event', eventId],
    queryFn: () => sportsEventLayerService.getEvent(eventId),
    enabled: !!eventId,
  });

  useEffect(() => {
    if (!data) return;
    trackEvent('event_page_view', {
      eventId: data.eventId,
      eventLabel: data.label,
      sport: data.sport,
      sourcePage: `/events/${data.eventId}`,
    });
  }, [data]);

  useEffect(() => {
    const firstClickFlag = window.sessionStorage.getItem('gtm_event_first_click');
    if (firstClickFlag !== '1') return;
    window.sessionStorage.removeItem('gtm_event_first_click');
    setToast(t('sports_event_layer.toast_first_connection'));
    const timer = window.setTimeout(() => {
      setToast(t('sports_event_layer.toast_connections_left'));
    }, 2100);
    return () => window.clearTimeout(timer);
  }, [t]);

  const title = useMemo(
    () => formatI18n(t('sports_event_layer.title_template'), { label: data?.label ?? t('nav.events') }),
    [data?.label, t]
  );
  const crmDescription = data?.description?.trim();
  const eventDescription = crmDescription && (locale === 'en' || !isSeededEnglishEventCopy(crmDescription))
    ? crmDescription
    : t('sports_event_layer.default_description');

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Box sx={{ mb: 2 }}>
        <BackLink label={t('common.back')} />
      </Box>
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          p: { xs: 2, sm: 3 },
          mb: 3,
          background: `linear-gradient(130deg, ${(data?.themeColor || '#27318a')}22, rgba(10,12,24,0.92))`,
        }}
      >
      <Typography variant="h3" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
        {title}
      </Typography>
      <Typography sx={{ mb: 1, fontWeight: 700 }}>
        {t('sports_event_layer.emotional_line')}
      </Typography>
      {data?.bannerImageUrl ? (
        <Box
          sx={{
            mb: 2,
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <img src={data.bannerImageUrl} alt={data.label} style={{ display: 'block', width: '100%', maxHeight: 280, objectFit: 'cover' }} />
        </Box>
      ) : null}
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {eventDescription + ` ${t('sports_event_layer.disclaimer')}`}
      </Typography>
      <Typography color="warning.main" sx={{ mb: 2, fontWeight: 700 }}>
        {t('sports_event_layer.credit_line')}
      </Typography>
      {(data?.tags ?? []).length > 0 ? (
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
          {(data?.tags ?? []).slice(0, 8).map((tag) => <Chip key={tag} size="small" label={tag} />)}
        </Stack>
      ) : null}
      <Stack spacing={1.2} sx={{ mb: 3 }}>
        {(data?.activities ?? ['train', 'play', 'watch', 'meet', 'vibe', 'date']).map((activity) => (
          <Box key={activity} sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
            <Typography variant="body2">{ACTIVITY_LABEL_KEYS[activity] ? t(ACTIVITY_LABEL_KEYS[activity]) : activity}</Typography>
          </Box>
        ))}
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
        <Button variant="contained" size="large" onClick={() => navigate('/signup')} sx={{ minHeight: 44, minWidth: { sm: 220 }, fontWeight: 800 }}>
          {t('sports_event_layer.primary_cta')}
        </Button>
        <Button variant="text" size="large" component={RouterLink} to="/login" sx={{ minHeight: 44 }}>
          {t('header.login')}
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1.2, display: 'block' }}>
        {t('sports_event_layer.trust_text')}
      </Typography>
      </Box>
      <Snackbar open={!!toast} autoHideDuration={1800} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setToast(null)} severity="success" sx={{ width: '100%' }}>
          {toast ?? ''}
        </Alert>
      </Snackbar>
    </Container>
  );
};
