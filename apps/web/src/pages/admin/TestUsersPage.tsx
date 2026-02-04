import React from 'react';
import { Container, Paper, Typography, Box, Alert } from '@mui/material';
const DEV_TEST_EMAILS = [
  'test1@example.com',
  'test2@example.com',
  'test3@example.com',
];

/**
 * DEV-ONLY: Test Users helper for validating multi-user flows.
 * Do not store plaintext passwords in repo. Use local dev notes or env.
 */
export const TestUsersPage: React.FC = () => {
  const isDev = import.meta.env.DEV;

  if (!isDev) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Alert severity="info">
          Test Users tool is only available in development.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          Test Users
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Sign out and sign in with another account to validate free vs paid behavior and multi-user flows.
        </Typography>
        <Box component="ul" sx={{ pl: 2, mb: 3 }}>
          {DEV_TEST_EMAILS.map((email) => (
            <li key={email}>
              <Typography variant="body2" component="span">
                {email}
              </Typography>
            </li>
          ))}
        </Box>
        <Typography variant="caption" color="text.secondary" display="block">
          Store passwords only in local dev notes or env — never in the repo.
        </Typography>
      </Paper>
    </Container>
  );
};
