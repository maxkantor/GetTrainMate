import React from 'react';
import { Helmet } from 'react-helmet-async';
import { SITE_ORIGIN } from '@/config/site';

export type FaqJsonLdItem = { question: string; answer: string };

type Props = { items: FaqJsonLdItem[] };

/**
 * FAQPage schema — only render when `items` match visible FAQ content on the page.
 */
export const FaqJsonLd: React.FC<Props> = ({ items }) => {
  if (!items.length) return null;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
    url: `${SITE_ORIGIN}/faq`,
  };
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(data)}</script>
    </Helmet>
  );
};
