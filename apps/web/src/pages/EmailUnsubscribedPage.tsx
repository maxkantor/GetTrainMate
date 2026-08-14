import React from 'react';
import { Box, Typography } from '@mui/material';
import { Layout } from '@/components/Layout';

export const EmailUnsubscribedPage: React.FC = () => (
  <Layout>
    <Box sx={{ maxWidth: 560, mx: 'auto', py: 8, px: 2 }}>
      <Typography variant="h4" gutterBottom>
        You are unsubscribed
      </Typography>
      <Typography>
        You will no longer receive GetTrainMate partnership emails. Account and security messages are unchanged.
      </Typography>
    </Box>
  </Layout>
);
