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

export const ContactPage: React.FC = () => {
  const { t: _t } = useI18n();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'general',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.email || !formData.message) {
      setError('Please fill in all required fields');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    trackContactSubmit(formData.subject);
    trackLead('contact', { subject_category: formData.subject });
    setSubmitted(true);

    // Reset form
    setTimeout(() => {
      setFormData({ name: '', email: '', subject: 'general', message: '' });
      setSubmitted(false);
    }, 5000);
  };

  const subjects = [
    { value: 'general', label: 'General Inquiry' },
    { value: 'support', label: 'Technical Support' },
    { value: 'billing', label: 'Billing & Subscriptions' },
    { value: 'partnership', label: 'Partnership Opportunities' },
    { value: 'feedback', label: 'Feedback & Suggestions' },
    { value: 'report', label: 'Report an Issue' },
  ];

  return (
    <PageShell variant="content" showBackLink>
      <Container maxWidth="md" disableGutters sx={{ maxWidth: '100%' }}>
        <Box sx={{ textAlign: 'center', mb: 2.5 }}>
          <Typography variant="h2" component="h1" gutterBottom sx={{ fontSize: '1.75rem', color: 'rgba(255,255,255,0.95)' }}>
            Get in Touch
          </Typography>
          <Typography variant="body1" sx={{ mt: 0.5, color: 'rgba(255,255,255,0.75)' }}>
            Have a question or feedback? Send us a message and we'll respond as soon as possible.
          </Typography>
        </Box>

        <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 520, mx: 'auto' }}>
          {submitted && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Thank you for your message! We'll get back to you soon.
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
            label="Your Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            disabled={submitted}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            required
            label="Email Address"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            disabled={submitted}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            select
            label="Subject"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            disabled={submitted}
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
            label="Message"
            multiline
            rows={4}
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            placeholder="Tell us how we can help you..."
            disabled={submitted}
            sx={{ mb: 2 }}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={submitted}
            sx={{ py: 1.25 }}
          >
            {submitted ? 'Message Sent!' : 'Send Message'}
          </Button>
        </Box>

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.9)', mb: 0.5 }}>
            Looking for quick answers?
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', mb: 1.5 }}>
            Check out our FAQ page for immediate answers to common questions.
          </Typography>
          <Button variant="outlined" size="medium" component={Link} to="/faq" sx={{ borderColor: 'rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.9)' }}>
            Visit FAQ
          </Button>
        </Box>
      </Container>
    </PageShell>
  );
};
