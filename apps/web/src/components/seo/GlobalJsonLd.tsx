import React from 'react';
import { Helmet } from 'react-helmet-async';
import { SITE_ORIGIN } from '@/config/site';

const organization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'GetTrainMate',
  url: SITE_ORIGIN,
  description:
    'Find compatible training partners for gym, HYROX, running, and more. TRAIN, VIBE, and DATE modes with AI-powered matching.',
  logo: `${SITE_ORIGIN}/vite.svg`,
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
