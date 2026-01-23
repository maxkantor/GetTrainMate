import React from 'react';
import { Container, Typography } from '@mui/material';

export const PrivacyPage: React.FC = () => {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        Privacy Policy
      </Typography>
      <Typography variant="body1" color="textSecondary">
        Coming soon...
      </Typography>
    </Container>
  );
};
