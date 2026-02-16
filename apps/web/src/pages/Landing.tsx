import React from 'react';
import { Hero } from '@/sections/Hero';
import { HowItWorks } from '@/sections/HowItWorks';
import { Features } from '@/sections/Features';
import { Testimonials } from '@/sections/Testimonials';
import { FinalCTA } from '@/sections/FinalCTA';

export const LandingPage: React.FC = () => {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Features />
      <Testimonials />
      <FinalCTA />
    </>
  );
};
