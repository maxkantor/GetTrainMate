import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Container, List, ListItem, ListItemText, Typography } from '@mui/material';
import { PageShell } from '@/components/layout/PageShell';
import { ATLANTA_PARTNERS, partnerLandingPath } from '@/data/atlantaPartners';

/**
 * Hub listing ready Atlanta partner invite landings (EXP-002).
 * Outreach is owner-approved only — this page does not send emails.
 */
export const AtlantaPartnersHubPage: React.FC = () => {
  const ready = ATLANTA_PARTNERS.filter((p) => p.status === 'ready' || p.status === 'template');

  return (
    <PageShell variant="content" showBackLink>
      <Container maxWidth="md" disableGutters sx={{ maxWidth: '100%', px: { xs: 2, sm: 0 } }}>
        <Typography
          variant="h2"
          component="h1"
          sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, fontWeight: 800, lineHeight: 1.2 }}
        >
          GetTrainMate
        </Typography>
        <Typography
          variant="h3"
          component="p"
          sx={{ mt: 1.5, fontSize: { xs: '1.15rem', md: '1.35rem' }, fontWeight: 600 }}
        >
          Atlanta TRAIN partner invites
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2, maxWidth: 560, lineHeight: 1.7 }}>
          Each community gets a unique invite link and code. Share only with people who already know
          your group — we do not create fake profiles or promise matches.
        </Typography>

        <List sx={{ mt: 3 }} dense disablePadding>
          {ready.map((p) => (
            <ListItem
              key={p.code}
              disableGutters
              sx={{ py: 1.25, borderBottom: '1px solid', borderColor: 'divider', alignItems: 'flex-start' }}
            >
              <ListItemText
                primary={p.displayName}
                secondary={`${p.code} · ${p.blurb}`}
                primaryTypographyProps={{ fontWeight: 600 }}
                secondaryTypographyProps={{ sx: { mt: 0.5 } }}
              />
              <Button
                component={RouterLink}
                to={partnerLandingPath(p.code)}
                size="small"
                variant="outlined"
                sx={{ ml: 1, flexShrink: 0 }}
              >
                Open
              </Button>
            </ListItem>
          ))}
        </List>

        <Box sx={{ mt: 4 }}>
          <Button component={RouterLink} to="/atlanta-training-partners" variant="contained">
            Atlanta training partners overview
          </Button>
        </Box>
      </Container>
    </PageShell>
  );
};

export default AtlantaPartnersHubPage;
