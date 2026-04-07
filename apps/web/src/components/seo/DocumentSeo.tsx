import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { canonicalHrefForPath, getRouteSeo } from '@/config/seoRoutes';
import { ogImageAbsoluteUrl, SITE_ORIGIN } from '@/config/site';

/**
 * Per-route title, description, canonical, robots, Open Graph, and Twitter tags.
 */
export const DocumentSeo: React.FC = () => {
  const { pathname } = useLocation();
  const seo = getRouteSeo(pathname);
  const canonical = canonicalHrefForPath(seo.canonicalPath);
  const ogImage = ogImageAbsoluteUrl();
  const robots = seo.noindex ? 'noindex, nofollow' : 'index, follow';
  const ogTitle = seo.ogTitle ?? seo.title;
  const ogDesc = seo.ogDescription ?? seo.description;

  const webPageLd =
    !seo.noindex
      ? {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: ogTitle,
          description: ogDesc,
          url: canonical,
          isPartOf: { '@type': 'WebSite', url: SITE_ORIGIN, name: 'GetTrainMate' },
        }
      : null;

  return (
    <Helmet prioritizeSeoTags>
      <html lang="en" />
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      <meta name="robots" content={robots} />
      <link rel="canonical" href={canonical} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="GetTrainMate" />
      <meta property="og:title" content={ogTitle} />
      <meta property="og:description" content={ogDesc} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={ogTitle} />
      <meta name="twitter:description" content={ogDesc} />
      <meta name="twitter:image" content={ogImage} />
      {webPageLd && (
        <script type="application/ld+json">{JSON.stringify(webPageLd)}</script>
      )}
    </Helmet>
  );
};
