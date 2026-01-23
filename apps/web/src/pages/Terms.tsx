import React from 'react';
import { Container, Typography } from '@mui/material';

export const TermsPage: React.FC = () => {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        Terms of Service
      </Typography>
      <Typography variant="body1" color="textSecondary">
        Coming soon...
      </Typography>
    </Container>
  );
};
