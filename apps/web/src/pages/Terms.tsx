import React from 'react';
import { Container, Typography, Box } from '@mui/material';
import { PageShell } from '@/components/layout/PageShell';

export const TermsPage: React.FC = () => {
  return (
    <PageShell variant="content" showBackLink>
      <Container maxWidth="md" disableGutters sx={{ maxWidth: '100%', py: 0 }}>
        <Typography variant="h1" component="h1" gutterBottom sx={{ fontSize: '1.75rem', fontWeight: 700 }}>
          Terms of Service
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Last updated: {new Date().toLocaleDateString('en-US')}
        </Typography>
        <Box component="section" sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          1. Acceptance of Terms
        </Typography>
        <Typography variant="body1" paragraph>
          By accessing or using GetTrainMate, you agree to be bound by these Terms of Service. If
          you do not agree, please do not use our services.
        </Typography>
      </Box>
      <Box component="section" sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          2. Description of Service
        </Typography>
        <Typography variant="body1" paragraph>
          GetTrainMate is a platform that connects people with compatible training partners based
          on fitness goals, sports, location, and availability. We provide matching, chat, and
          event features to help you find and coordinate with training partners.
        </Typography>
      </Box>
      <Box component="section" sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          3. Account and Eligibility
        </Typography>
        <Typography variant="body1" paragraph>
          You must be at least 18 years old to use GetTrainMate. You are responsible for
          maintaining the security of your account and for all activity that occurs under it. You
          must provide accurate and complete profile information.
        </Typography>
      </Box>
      <Box component="section" sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          4. User Conduct
        </Typography>
        <Typography variant="body1" paragraph>
          You agree to use GetTrainMate lawfully and respectfully. Prohibited behavior includes
          harassment, impersonation, fraud, spam, and any content that is abusive, illegal, or
          violates others&apos; rights. We reserve the right to suspend or terminate accounts that
          violate these terms.
        </Typography>
      </Box>
      <Box component="section" sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          5. Subscriptions and Payments
        </Typography>
        <Typography variant="body1" paragraph>
          Paid plans (Pro, Elite) are billed monthly. Subscriptions renew automatically unless
          canceled. Refunds are handled in accordance with our billing policy. Contact support for
          subscription changes.
        </Typography>
      </Box>
      <Box component="section" sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          6. Disclaimer
        </Typography>
        <Typography variant="body1" paragraph>
          GetTrainMate facilitates connections between users. We do not guarantee the accuracy,
          safety, or conduct of other users. You are responsible for your own safety when meeting
          training partners. Exercise caution and meet in public places.
        </Typography>
      </Box>
      <Box component="section" sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          7. Limitation of Liability
        </Typography>
        <Typography variant="body1" paragraph>
          To the extent permitted by law, GetTrainMate shall not be liable for any indirect,
          incidental, special, or consequential damages arising from your use of the service.
        </Typography>
      </Box>
      <Box component="section" sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          8. Changes
        </Typography>
        <Typography variant="body1" paragraph>
          We may update these terms from time to time. Continued use of the service after changes
          constitutes acceptance of the new terms.
        </Typography>
      </Box>
        <Box component="section" sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            9. Contact
          </Typography>
          <Typography variant="body1" paragraph>
            For questions about these terms, contact us at support@gettrainmate.com.
          </Typography>
        </Box>
      </Container>
    </PageShell>
  );
};
