import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { buildWorldCupSportsEventLd } from './src/config/worldCupSportsEventLd';
import { SITE_ORIGIN } from './src/config/site';

const BRAND = 'GetTrainMate';

const PRERENDER_PAGES = [
  {
    canonicalPath: '/world-cup',
    title: `World Cup 2026 Fan Hub | ${BRAND}`,
    description:
      'Predict. Connect. Experience Together. Free World Cup 2026 predictions, live group standings, match schedule, and connect with fans near you on GetTrainMate.',
    ogTitle: 'World Cup 2026 Fan Hub — Predict. Connect. Experience Together.',
    ogDescription:
      'Make free predictions, see live groups, share your picks, and find fans nearby. No betting — just football fans connecting worldwide.',
    ogImagePath: '/images/event-banner.png',
  },
  {
    canonicalPath: '/events/world-cup-2026',
    title: `World Cup 2026 on ${BRAND}`,
    description:
      'FIFA World Cup 2026 — hosted across the United States, Canada, and Mexico. Follow the tournament, make free fan predictions, and connect with supporters on GetTrainMate.',
    ogTitle: `World Cup 2026 on ${BRAND}`,
    ogDescription:
      'FIFA World Cup 2026 — hosted across the United States, Canada, and Mexico. Follow the tournament, make free fan predictions, and connect with supporters on GetTrainMate.',
    ogImagePath: '/images/event-banner.png',
  },
] as const;

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function canonicalHref(canonicalPath: string): string {
  if (canonicalPath === '/') return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${canonicalPath}`;
}

function injectRouteHtml(
  baseHtml: string,
  page: (typeof PRERENDER_PAGES)[number],
): string {
  const canonical = canonicalHref(page.canonicalPath);
  const ogImage = canonicalHref(page.ogImagePath);
  const sportsEventLd = buildWorldCupSportsEventLd(page.canonicalPath);
  const webPageLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.ogTitle,
    description: page.ogDescription,
    url: canonical,
    isPartOf: { '@type': 'WebSite', url: SITE_ORIGIN, name: 'GetTrainMate' },
  };

  let html = baseHtml
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(page.title)}</title>`)
    .replace(
      /<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${escapeAttr(page.description)}" />`,
    )
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${canonical}" />`)
    .replace(
      /<meta property="og:title" content="[^"]*" \/>/,
      `<meta property="og:title" content="${escapeAttr(page.ogTitle)}" />`,
    )
    .replace(
      /<meta property="og:description" content="[^"]*" \/>/,
      `<meta property="og:description" content="${escapeAttr(page.ogDescription)}" />`,
    )
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${canonical}" />`)
    .replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${ogImage}" />`)
    .replace(
      /<meta property="og:image:secure_url" content="[^"]*" \/>/,
      `<meta property="og:image:secure_url" content="${ogImage}" />`,
    )
    .replace(
      /<meta name="twitter:title" content="[^"]*" \/>/,
      `<meta name="twitter:title" content="${escapeAttr(page.ogTitle)}" />`,
    )
    .replace(
      /<meta name="twitter:description" content="[^"]*" \/>/,
      `<meta name="twitter:description" content="${escapeAttr(page.ogDescription)}" />`,
    )
    .replace(/<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${ogImage}" />`);

  const jsonLdScripts = [webPageLd, sportsEventLd]
    .map((ld) => `<script type="application/ld+json">${JSON.stringify(ld)}</script>`)
    .join('\n    ');

  return html.replace('</head>', `    ${jsonLdScripts}\n  </head>`);
}

/** Static HTML shells with JSON-LD in <head> for crawlers (SPA routes). */
export function prerenderSeoPlugin(): Plugin {
  const webRoot = dirname(fileURLToPath(import.meta.url));

  return {
    name: 'prerender-seo-html',
    closeBundle() {
      const outDir = join(webRoot, 'dist');
      const baseHtml = readFileSync(join(outDir, 'index.html'), 'utf8');

      for (const page of PRERENDER_PAGES) {
        const html = injectRouteHtml(baseHtml, page);
        const routeDir = join(outDir, ...page.canonicalPath.replace(/^\//, '').split('/'));
        mkdirSync(routeDir, { recursive: true });
        writeFileSync(join(routeDir, 'index.html'), html, 'utf8');
      }
    },
  };
}
