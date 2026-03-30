import React from 'react';
import { Hero } from '@/sections/Hero';
import { SwipeDemoSection } from '@/sections/SwipeDemoSection';
import { Features } from '@/sections/Features';
import { Testimonials } from '@/sections/Testimonials';
import { FinalCTA } from '@/sections/FinalCTA';
import styles from '@/sections/sections.module.css';

export const LandingPage: React.FC = () => {
  return (
    <>
      <Hero />
      <SwipeDemoSection />
      <div className={styles.sectionDivider} aria-hidden />
      <Features />
      <Testimonials />
      <FinalCTA />
    </>
  );
};
