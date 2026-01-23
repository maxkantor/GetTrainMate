import React from 'react';
import { Box, Container, Typography } from '@mui/material';
import { GearGrid } from '@/components/gear/GearGrid';

export const GearPage: React.FC = () => {
  return (
    <Box sx={{ py: 8 }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography
            variant="overline"
            sx={{
              display: 'inline-block',
              color: 'primary.main',
              fontWeight: 700,
              letterSpacing: 1,
              mb: 2,
            }}
          >
            Training Essentials
          </Typography>
          <Typography variant="h2" component="h1" gutterBottom>
            Recommended Training Gear
          </Typography>
          <Typography
            variant="h6"
            color="textSecondary"
            sx={{ maxWidth: '600px', mx: 'auto', mt: 2 }}
          >
            Handpicked equipment to help you and your training partners perform at your best
          </Typography>
        </Box>

        <GearGrid />
      </Container>
    </Box>
  );
};
