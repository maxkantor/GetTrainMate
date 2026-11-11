import React, { useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { Layout } from '@/components/Layout';
import { API_BASE_URL } from '@/config/api';

/**
 * Unsubscribe page for the link in partner emails:
 * https://gettrainmate.com/email/unsubscribe?t=<signed token>
 * (built by PartnerOutreachService.BuildUnsubUrl; the token is valid for 30 days).
 *
 * The token is only acted on when the visitor confirms with the button —
 * email clients and link scanners prefetch links, so an automatic
 * unsubscribe on page load would remove people who never asked.
 * The POST is the API's EmailUnsubscribeController (anonymous); on
 * success we show the existing "You're unsubscribed" confirmation page.
 */
export const EmailUnsubscribePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('t');
  const [status, setStatus] = useState<'confirm' | 'submitting' | 'invalid' | 'failed'>('confirm');

  const unsubscribe = async () => {
    if (!token || status === 'submitting') return;
    setStatus('submitting');
    try {
      const response = await fetch(`${API_BASE_URL}/email/unsubscribe?t=${encodeURIComponent(token)}`, { method: 'POST' });
      if (response.ok) {
        navigate('/email/unsubscribed');
        return;
      }
      // The API returns 400 for a missing/expired/invalid token.
      setStatus(response.status === 400 ? 'invalid' : 'failed');
    } catch {
      setStatus('failed');
    }
  };

  const renderMessage = (title: string, body: string, actions: React.ReactNode) => (
    <Box sx={{ maxWidth: 720, mx: 'auto', py: 10, textAlign: 'center' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body1" sx={{ mb: 3 }}>
        {body}
      </Typography>
      {actions}
    </Box>
  );

  if (!token) {
    return (
      <Layout>
        {renderMessage(
          'This unsubscribe link is incomplete',
          'It is missing the security token from your email, so we cannot tell which address to remove. Please use the unsubscribe link in the email itself.',
          <Button component={RouterLink} to="/contact" variant="outlined">
            Contact us
          </Button>,
        )}
      </Layout>
    );
  }

  if (status === 'invalid') {
    return (
      <Layout>
        {renderMessage(
          'This unsubscribe link has expired',
          'Unsubscribe links are valid for 30 days. If you still want to stop partnership emails, please contact us and we will remove your address.',
          <Button component={RouterLink} to="/contact" variant="outlined">
            Contact us
          </Button>,
        )}
      </Layout>
    );
  }

  if (status === 'failed') {
    return (
      <Layout>
        {renderMessage(
          'We could not process that yet',
          'The unsubscribe service did not respond. Please try again, or reply to the email and ask to be removed.',
          <Button onClick={unsubscribe} variant="contained">
            Try again
          </Button>,
        )}
      </Layout>
    );
  }

  return (
    <Layout>
      <Box sx={{ maxWidth: 720, mx: 'auto', py: 10, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Unsubscribe from GetTrainMate emails
        </Typography>
        <Typography variant="body1" sx={{ mb: 3 }}>
          This will stop partnership emails to the address this link was sent to. Account and security messages are unchanged.
        </Typography>
        <Button
          onClick={unsubscribe}
          variant="contained"
          disabled={status === 'submitting'}
          startIcon={status === 'submitting' ? <CircularProgress size={20} /> : undefined}
        >
          {status === 'submitting' ? 'Unsubscribing...' : 'Unsubscribe'}
        </Button>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2">
            Changed your mind? <RouterLink to="/">Go home</RouterLink>
          </Typography>
        </Box>
      </Box>
    </Layout>
  );
};
