import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  TextField,
  Button,
  Alert,
  MenuItem,
} from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { PageShell } from '@/components/layout/PageShell';
import { trackContactSubmit, trackLead } from '@/utils/analytics';
import { API_BASE_URL } from '@/config/api';

export const ContactPage: React.FC = () => {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'general',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.email || !formData.message) {
      setError(t('contact.error_required'));
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError(t('contact.error_invalid_email'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/public/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          subject: formData.subject,
          message: formData.message.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : t('contact.error_send_failed'));
        return;
      }
      trackContactSubmit(formData.subject);
      trackLead('contact', { subject_category: formData.subject });
      setSubmitted(true);
      setTimeout(() => {
        setFormData({ name: '', email: '', subject: 'general', message: '' });
        setSubmitted(false);
      }, 5000);
    } catch {
      setError(t('contact.error_network'));
    } finally {
      setSubmitting(false);
    }
  };

  const subjects = [
    { value: 'general', label: t('contact.subject_general') },
    { value: 'support', label: t('contact.subject_support') },
    { value: 'billing', label: t('contact.subject_billing') },
    { value: 'partnership', label: t('contact.subject_partnership') },
    { value: 'feedback', label: t('contact.subject_feedback') },
    { value: 'report', label: t('contact.subject_report') },
  ];

  return (
    <PageShell variant="content" showBackLink>
      <Container maxWidth="md" disableGutters sx={{ maxWidth: '100%' }}>
        <Box sx={{ textAlign: 'center', mb: 2.5 }}>
          <Typography variant="h2" component="h1" gutterBottom sx={{ fontSize: '1.75rem', color: 'rgba(255,255,255,0.95)' }}>
            {t('contact.title')}
          </Typography>
          <Typography variant="body1" sx={{ mt: 0.5, color: 'rgba(255,255,255,0.75)' }}>
            {t('contact.subtitle')}
          </Typography>
        </Box>

        <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 520, mx: 'auto' }}>
          {submitted && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {t('contact.success')}
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            required
            label={t('contact.field_name')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            disabled={submitted || submitting}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            required
            label={t('contact.field_email')}
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            disabled={submitted || submitting}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            select
            label={t('contact.field_subject')}
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            disabled={submitted || submitting}
            sx={{ mb: 2 }}
          >
            {subjects.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            required
            label={t('contact.field_message')}
            multiline
            rows={4}
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            placeholder={t('contact.message_placeholder')}
            disabled={submitted || submitting}
            sx={{ mb: 2 }}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={submitted || submitting}
            sx={{ py: 1.25 }}
          >
            {submitted ? t('contact.btn_sent') : submitting ? t('contact.btn_sending') : t('contact.btn_send')}
          </Button>
        </Box>

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.9)', mb: 0.5 }}>
            {t('contact.quick_answers_title')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', mb: 1.5 }}>
            {t('contact.quick_answers_sub')}
          </Typography>
          <Button variant="outlined" size="medium" component={Link} to="/faq" sx={{ borderColor: 'rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.9)' }}>
            {t('contact.btn_visit_faq')}
          </Button>
        </Box>
      </Container>
    </PageShell>
  );
};
