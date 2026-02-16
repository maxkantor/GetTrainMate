import React from 'react';
import { Alert, AlertTitle, Box, Link as MuiLink } from '@mui/material';

export const AuthNotConfiguredBanner: React.FC = () => {
  const isConfigured = 
    import.meta.env.VITE_COGNITO_USER_POOL_ID && 
    import.meta.env.VITE_COGNITO_CLIENT_ID;

  if (isConfigured) {
    return null;
  }

  return (
    <Box sx={{ position: 'fixed', top: 64, left: 0, right: 0, zIndex: 1300 }}>
      <Alert severity="warning" sx={{ borderRadius: 0 }}>
        <AlertTitle>Development Mode - Authentication Not Configured</AlertTitle>
        Login and signup features require AWS Cognito credentials. 
        {' '}
        <MuiLink 
          href="https://github.com/maxkantor/GetTrainMate/blob/main/docs/COGNITO_SETUP.md"
          target="_blank"
          rel="noopener"
          sx={{ color: 'inherit', textDecoration: 'underline' }}
        >
          See setup guide
        </MuiLink>
        {' '}to configure authentication.
      </Alert>
    </Box>
  );
};
