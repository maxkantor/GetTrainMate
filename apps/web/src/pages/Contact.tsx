import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  Alert,
  MenuItem,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { useI18n } from '@/hooks/useI18n';

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

    // TODO: Connect to backend API to save the contact form submission
    // For now, just simulate success
    console.log('Contact form submitted:', formData);
    setSubmitted(true);

    // Reset form
    setTimeout(() => {
      setFormData({ name: '', email: '', subject: 'general', message: '' });
      setSubmitted(false);
    }, 5000);
  };

  const contactInfo = [
    {
      icon: <EmailIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
      title: 'Email Us',
      detail: 'support@getrainmate.com',
      subdDetail: 'We typically respond within 24 hours',
    },
    {
      icon: <PhoneIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
      title: 'Call Us',
      detail: '+1 (555) 123-4567',
      subdDetail: 'Mon-Fri 9AM-6PM EST',
    },
    {
      icon: <LocationOnIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
      title: 'Visit Us',
      detail: '123 Fitness Street, San Francisco, CA 94105',
      subdDetail: 'By appointment only',
    },
  ];

  const subjects = [
    { value: 'general', label: 'General Inquiry' },
    { value: 'support', label: 'Technical Support' },
    { value: 'billing', label: 'Billing & Subscriptions' },
    { value: 'partnership', label: 'Partnership Opportunities' },
    { value: 'feedback', label: 'Feedback & Suggestions' },
    { value: 'report', label: 'Report an Issue' },
  ];

  return (
    <Box sx={{ py: 8 }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h2" component="h1" gutterBottom>
            Get in Touch
          </Typography>
          <Typography variant="h6" color="textSecondary" sx={{ mt: 2, maxWidth: '600px', mx: 'auto' }}>
            Have a question or feedback? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {/* Contact Info Cards */}
          <Grid item xs={12}>
            <Grid container spacing={3}>
              {contactInfo.map((info, index) => (
                <Grid item xs={12} md={4} key={index}>
                  <Card elevation={2} sx={{ height: '100%', textAlign: 'center' }}>
                    <CardContent sx={{ p: 4 }}>
                      <Box sx={{ mb: 2 }}>{info.icon}</Box>
                      <Typography variant="h6" gutterBottom>
                        {info.title}
                      </Typography>
                      <Typography variant="body1" color="primary" gutterBottom fontWeight={600}>
                        {info.detail}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {info.subdDetail}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* Contact Form */}
          <Grid item xs={12} md={8} sx={{ mx: 'auto' }}>
            <Card elevation={3}>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                  Send us a Message
                </Typography>

                {submitted && (
                  <Alert severity="success" sx={{ mb: 3 }}>
                    Thank you for your message! We'll get back to you soon.
                  </Alert>
                )}

                {error && (
                  <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                  </Alert>
                )}

                <Box component="form" onSubmit={handleSubmit}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        required
                        label="Your Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        disabled={submitted}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        required
                        label="Email Address"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        disabled={submitted}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        select
                        label="Subject"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        disabled={submitted}
                      >
                        {subjects.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        required
                        label="Message"
                        multiline
                        rows={6}
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder="Tell us how we can help you..."
                        disabled={submitted}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Button
                        type="submit"
                        variant="contained"
                        size="large"
                        fullWidth
                        disabled={submitted}
                        sx={{ py: 1.5 }}
                      >
                        {submitted ? 'Message Sent!' : 'Send Message'}
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Additional Help Section */}
        <Box sx={{ mt: 8, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            Looking for quick answers?
          </Typography>
          <Typography variant="body1" color="textSecondary" paragraph>
            Check out our FAQ page for immediate answers to common questions.
          </Typography>
          <Button variant="outlined" size="large" href="/faq" sx={{ mt: 2 }}>
            Visit FAQ
          </Button>
        </Box>
      </Container>
    </Box>
  );
};
