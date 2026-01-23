import React, { useState } from 'react';
import { Box } from '@mui/material';
import { PricingHero } from '@/components/pricing/PricingHero';
import { PricingToggle } from '@/components/pricing/PricingToggle';
import { PricingCards } from '@/components/pricing/PricingCards';
import { ComparisonTable } from '@/components/pricing/ComparisonTable';
import { PricingFAQ } from '@/components/pricing/PricingFAQ';
import { StickyUpgradeBar } from '@/components/pricing/StickyUpgradeBar';
import { PricingVibeStrip } from '@/components/pricing/PricingVibeStrip';
import { BoostStore } from '@/components/monetization/BoostStore';
import { ChallengeCards } from '@/components/monetization/ChallengeCards';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';

export const PricingPage: React.FC = () => {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <PricingHero />
      
      <Box sx={{ py: 4, bgcolor: 'white' }}>
        <Container>
          <PricingToggle isAnnual={isAnnual} onChange={setIsAnnual} />
        </Container>
      </Box>

      <PricingCards isAnnual={isAnnual} />

      <PricingVibeStrip />
      
      <ComparisonTable />
      
      <PricingFAQ />

      {/* More ways to level up section */}
      <Box sx={{ bgcolor: '#fafafa', py: 8, textAlign: 'center' }}>
        <Container>
          <Box sx={{ mb: 2 }}>
            <span style={{
              display: 'inline-block',
              padding: '4px 16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: 700,
              letterSpacing: '0.5px',
            }}>
              MORE WAYS TO LEVEL UP
            </span>
          </Box>
          <h2 style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            marginBottom: '16px',
            color: '#1a1a1a',
          }}>
            Maximize Your Training Experience
          </h2>
          <p style={{
            fontSize: '1.125rem',
            color: '#666',
            maxWidth: '700px',
            margin: '0 auto 40px',
          }}>
            Boost your visibility, join community challenges, and gear up with recommended equipment
          </p>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button as="a" href="/gear" variant="secondary" size="lg">
              Shop Training Gear 🛒
            </Button>
          </Box>
        </Container>
      </Box>

      <BoostStore />
      
      <ChallengeCards />

      {/* Trusted by section */}
      <Box sx={{ py: 8, bgcolor: 'white', borderTop: '1px solid #e5e7eb' }}>
        <Container>
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <p style={{ fontSize: '14px', color: '#999', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '24px' }}>
              Trusted by Athletes Worldwide
            </p>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', opacity: 0.4 }}>
              <div style={{ padding: '16px 32px', border: '2px solid #e5e7eb', borderRadius: '12px', fontWeight: 700, fontSize: '20px' }}>
                STRAVA
              </div>
              <div style={{ padding: '16px 32px', border: '2px solid #e5e7eb', borderRadius: '12px', fontWeight: 700, fontSize: '20px' }}>
                MYFITNESSPAL
              </div>
              <div style={{ padding: '16px 32px', border: '2px solid #e5e7eb', borderRadius: '12px', fontWeight: 700, fontSize: '20px' }}>
                FITBIT
              </div>
              <div style={{ padding: '16px 32px', border: '2px solid #e5e7eb', borderRadius: '12px', fontWeight: 700, fontSize: '20px' }}>
                GARMIN
              </div>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Mobile sticky upgrade bar */}
      <StickyUpgradeBar />
    </Box>
  );
};
