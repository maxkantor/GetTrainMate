import React from 'react';
import { Hero } from '@/sections/Hero';
import { HowItWorks } from '@/sections/HowItWorks';
import { Features } from '@/sections/Features';
import { Testimonials } from '@/sections/Testimonials';
import { FinalCTA } from '@/sections/FinalCTA';
import styles from '@/sections/sections.module.css';

export const LandingPage: React.FC = () => {
  return (
    <>
      <Hero />
      <div className={styles.sectionDivider} aria-hidden />
      <HowItWorks />
      <Features />
      <Testimonials />
      <FinalCTA />
    </>
  );
};
