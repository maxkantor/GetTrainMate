import React from 'react';
import { Helmet } from 'react-helmet-async';
import { SITE_ORIGIN } from '@/config/site';

const organization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'GetTrainMate',
  url: SITE_ORIGIN,
  description:
    'Train, vibe, or date with active people worldwide. TRAIN, VIBE, and DATE modes with modern matching and chat.',
  logo: `${SITE_ORIGIN}/brand/gtm-icon-main.svg`,
};

const website = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'GetTrainMate',
  url: SITE_ORIGIN,
  publisher: { '@type': 'Organization', name: 'GetTrainMate' },
};

/**
 * Site-wide Organization + WebSite JSON-LD (single injection).
 */
export const GlobalJsonLd: React.FC = () => (
  <Helmet>
    <script type="application/ld+json">{JSON.stringify(organization)}</script>
    <script type="application/ld+json">{JSON.stringify(website)}</script>
  </Helmet>
);
