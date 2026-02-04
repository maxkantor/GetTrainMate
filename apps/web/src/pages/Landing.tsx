import React from 'react';
import { Hero } from '@/sections/Hero';
import { DemoProfilesSection } from '@/sections/DemoProfilesSection';
import { Features } from '@/sections/Features';
import { HowItWorks } from '@/sections/HowItWorks';
import { Testimonials } from '@/sections/Testimonials';
import { FinalCTA } from '@/sections/FinalCTA';

export const LandingPage: React.FC = () => {
  return (
    <>
      <Hero />
      <DemoProfilesSection />
      <Features />
      <HowItWorks />
      <Testimonials />
      <FinalCTA />
    </>
  );
};
