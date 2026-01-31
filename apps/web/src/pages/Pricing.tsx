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

      <Box sx={{ py: 3, bgcolor: 'white', borderBottom: '1px solid #e5e7eb' }}>
        <Container>
          <PricingToggle isAnnual={isAnnual} onChange={setIsAnnual} />
        </Container>
      </Box>

      {/* Trust strip: closer to pricing cards */}
      <Box sx={{ py: 2, bgcolor: '#fafafa', textAlign: 'center' }}>
        <Container>
          <p style={{ fontSize: '13px', color: '#6b7280', fontWeight: 600, letterSpacing: '0.5px' }}>
            Trusted by 10,000+ athletes
          </p>
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

      {/* Mobile sticky CTA: Start Free */}
      <StickyUpgradeBar />
    </Box>
  );
};
