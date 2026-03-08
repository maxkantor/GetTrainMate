import React from 'react';
import { Link } from 'react-router-dom';
import { Container, Typography, Button, Box } from '@mui/material';
import { PageShell } from '@/components/layout/PageShell';

export const AICoachPage: React.FC = () => {
  return (
    <PageShell variant="content" showBackLink>
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          AI Coach
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Get help improving your profile, understanding match quality, generating workout ideas, and suggesting first messages. Streaming responses powered by AI.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          This assistant will be available here soon. For now, use the chat screen to message your matches.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" component={Link} to="/app/chat">
            Back to Chat
          </Button>
          <Button variant="outlined" component={Link} to="/pricing">
            Credits
          </Button>
        </Box>
      </Container>
    </PageShell>
  );
};
