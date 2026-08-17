import React from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Box, Button, Container, List, ListItem, ListItemText, Typography } from '@mui/material';
import { PageShell } from '@/components/layout/PageShell';
import { ATLANTA_PARTNERS, partnerLandingPath } from '@/data/atlantaPartners';
import { INITIAL_MARKET_CANDIDATES, slugPart } from '@/data/markets';

/**
 * Market partner invite hub. Atlanta TRAIN listings remain EXP-002.
 * Other markets show a location-specific empty state until verified orgs exist.
 */
export const AtlantaPartnersHubPage: React.FC = () => {
  const { country: countryParam, market: marketParam } = useParams<{ country?: string; market?: string }>();
  const country = slugPart(countryParam || 'us') || 'us';
  const market = slugPart(marketParam || 'atlanta') || 'atlanta';
  const campaign = INITIAL_MARKET_CANDIDATES.find((m) => m.country === country && m.market === market);
  const city = campaign?.displayName || market.replace(/-/g, ' ');
  const isAtlanta = country === 'us' && market === 'atlanta';
  const ready = isAtlanta
    ? ATLANTA_PARTNERS.filter((p) => p.status === 'ready' || p.status === 'template')
    : [];

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
          {city} TRAIN partner invites
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2, maxWidth: 560, lineHeight: 1.7 }}>
          Each community gets a unique invite link and code. An invite page is not a claim that the
          organization already partners with GetTrainMate. TRAIN is the first partner campaign; VIBE and
          DATE remain available in the app.
        </Typography>

        {ready.length > 0 ? (
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
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            No verified {city} partner invite pages yet. Add organizations from official websites in Admin
            Partner Outreach. Emails are never inferred.
          </Typography>
        )}

        {isAtlanta ? (
          <Box sx={{ mt: 4 }}>
            <Button component={RouterLink} to="/atlanta-training-partners" variant="contained">
              Atlanta training partners overview
            </Button>
          </Box>
        ) : null}
      </Container>
    </PageShell>
  );
};

export default AtlantaPartnersHubPage;
