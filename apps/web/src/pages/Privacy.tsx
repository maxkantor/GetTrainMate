import React from 'react';
import { Container, Typography, Box } from '@mui/material';

export const PrivacyPage: React.FC = () => {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        Privacy Policy
      </Typography>
      <Typography variant="body2" color="textSecondary" gutterBottom>
        Last updated: {new Date().toLocaleDateString('en-US')}
      </Typography>
      <Box component="section" sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          1. Information We Collect
        </Typography>
        <Typography variant="body1" paragraph>
          GetTrainMate collects information you provide directly, including your name, email address,
          profile information (sports, goals, location, availability), and photos. We also collect
          usage data and device information when you use our services.
        </Typography>
      </Box>
      <Box component="section" sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          2. How We Use Your Information
        </Typography>
        <Typography variant="body1" paragraph>
          We use your information to provide, maintain, and improve our matching services; to
          personalize your experience; to communicate with you about your account; and to ensure
          safety and prevent fraud.
        </Typography>
      </Box>
      <Box component="section" sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          3. Sharing Your Information
        </Typography>
        <Typography variant="body1" paragraph>
          Your profile (name, photos, bio, sports, location) is visible to other GetTrainMate users
          for matching purposes. We do not sell your personal information to third parties. We may
          share data with service providers who assist our operations, subject to confidentiality
          agreements.
        </Typography>
      </Box>
      <Box component="section" sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          4. Data Security
        </Typography>
        <Typography variant="body1" paragraph>
          We implement industry-standard security measures to protect your data. Your information
          is stored securely and transmitted over encrypted connections.
        </Typography>
      </Box>
      <Box component="section" sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          5. Your Rights
        </Typography>
        <Typography variant="body1" paragraph>
          You may access, update, or delete your profile at any time through the app. You can also
          contact us to request a copy of your data or to exercise your privacy rights.
        </Typography>
      </Box>
      <Box component="section" sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          6. Contact Us
        </Typography>
        <Typography variant="body1" paragraph>
          For privacy-related questions, contact us at support@gettrainmate.com.
        </Typography>
      </Box>
    </Container>
  );
};
