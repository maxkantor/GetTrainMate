import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { buildWorldCupSportsEventLd } from './src/config/worldCupSportsEventLd';
import { SITE_ORIGIN } from './src/config/site';
import { WC_TEAMS } from './src/config/wcTeams';

const require = createRequire(import.meta.url);
const { isWorldCupSeoEnabled } = require('../../scripts/worldCupSeo.mjs') as {
  isWorldCupSeoEnabled: (env?: NodeJS.ProcessEnv) => boolean;
};

const BRAND = 'GetTrainMate';

type PrerenderPage = {
  canonicalPath: string;
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImagePath: string;
  jsonLd?: Record<string, unknown>[];
};

/** Always prerendered — core marketing SEO must survive after World Cup retirement. */
const MARKETING_PAGES: PrerenderPage[] = [
  {
    canonicalPath: '/pricing',
    title: `Pricing & Credits | ${BRAND}`,
    description:
      'Credit packs to unlock chats, AI insights, and boosts. Simple pricing — buy credits when you need them.',
    ogTitle: `Pricing & Credits | ${BRAND}`,
    ogDescription:
      'Credit packs to unlock chats, AI insights, and boosts. Simple pricing — buy credits when you need them.',
    ogImagePath: '/images/og-image.jpg?v=2',
  },
  {
    canonicalPath: '/about',
    title: `About Us | ${BRAND}`,
    description:
      'GetTrainMate helps active people connect worldwide — for training, social vibes, or dating — with flexible modes and safety-first design.',
    ogTitle: `About Us | ${BRAND}`,
    ogDescription:
      'GetTrainMate helps active people connect worldwide — for training, social vibes, or dating — with flexible modes and safety-first design.',
    ogImagePath: '/images/og-image.jpg?v=2',
  },
  {
    canonicalPath: '/workout-partner',
    title: `Find People Who Want to Train | ${BRAND}`,
    description:
      'Find gym, running, pickleball, and race partners on GetTrainMate TRAIN. Free to join — set your city and open Discover. Matches are never guaranteed.',
    ogTitle: `Find People Who Want to Train | ${BRAND}`,
    ogDescription:
      'Find gym, running, pickleball, and race partners on GetTrainMate TRAIN. Free to join.',
    ogImagePath: '/images/og-image.jpg?v=2',
  },
  {
    canonicalPath: '/meet-people',
    title: `Meet Active People You Click With | ${BRAND}`,
    description:
      'New in town? Meet people for events, coffee, and weekend plans in VIBE. Free to join. GetTrainMate also offers TRAIN and DATE worldwide.',
    ogTitle: `Meet Active People You Click With | ${BRAND}`,
    ogDescription:
      'Meet people for events, coffee, and weekend plans in VIBE on GetTrainMate. Free to join.',
    ogImagePath: '/images/og-image.jpg?v=2',
  },
  {
    canonicalPath: '/active-dating',
    title: `Activity Dating Beyond Swiping | ${BRAND}`,
    description:
      'Meet someone who wants to do more than swipe. DATE is optional activity-based dating on GetTrainMate — free to join. No guaranteed dates.',
    ogTitle: `Activity Dating Beyond Swiping | ${BRAND}`,
    ogDescription:
      'Activity-based dating on GetTrainMate DATE. Free to join. No guaranteed dates.',
    ogImagePath: '/images/og-image.jpg?v=2',
  },
  {
    canonicalPath: '/atlanta-training-partners',
    title: `Find a Training Partner in Atlanta | ${BRAND}`,
    description:
      'Match with gym, running, Hyrox, and CrossFit partners in Atlanta. TRAIN-first on GetTrainMate — set your city and start Discover.',
    ogTitle: `Find a Training Partner in Atlanta | ${BRAND}`,
    ogDescription:
      'Match with gym, running, Hyrox, and CrossFit partners in Atlanta. TRAIN-first on GetTrainMate — set your city and start Discover.',
    ogImagePath: '/images/og-image.jpg?v=2',
  },
  {
    canonicalPath: '/san-francisco',
    title: `Meet Active People in San Francisco | ${BRAND}`,
    description:
      'TRAIN, VIBE, or DATE in San Francisco on GetTrainMate. Free to join — set the Bay Area as your city and open Discover. Matches never guaranteed.',
    ogTitle: `Meet Active People in San Francisco | ${BRAND}`,
    ogDescription:
      'Meet active people in San Francisco on GetTrainMate — TRAIN, VIBE, and DATE. Free to join.',
    ogImagePath: '/images/og-image.jpg?v=2',
  },
  {
    canonicalPath: '/partners/atlanta',
    title: `Atlanta TRAIN Partner Invites | ${BRAND}`,
    description:
      'Unique Atlanta TRAIN partner invite links for run clubs, gyms, pickleball, and trainers. No fake density claims.',
    ogTitle: `Atlanta TRAIN Partner Invites | ${BRAND}`,
    ogDescription:
      'Unique Atlanta TRAIN partner invite links for run clubs, gyms, pickleball, and trainers. No fake density claims.',
    ogImagePath: '/images/og-image.jpg?v=2',
  },
  {
    canonicalPath: '/partners/us/atlanta',
    title: `Atlanta TRAIN Partner Invites | ${BRAND}`,
    description:
      'Unique Atlanta TRAIN partner invite links for run clubs, gyms, pickleball, and trainers. No fake density claims.',
    ogTitle: `Atlanta TRAIN Partner Invites | ${BRAND}`,
    ogDescription:
      'Unique Atlanta TRAIN partner invite links for run clubs, gyms, pickleball, and trainers. No fake density claims.',
    ogImagePath: '/images/og-image.jpg?v=2',
  },
  {
    canonicalPath: '/partners/atlanta/atl-track-club',
    title: `Atlanta Track Club community invite | ${BRAND}`,
    description:
      'Join GetTrainMate with the Atlanta Track Club community invite. TRAIN mode, Atlanta metro.',
    ogTitle: `Atlanta Track Club community invite | ${BRAND}`,
    ogDescription:
      'Join GetTrainMate with the Atlanta Track Club community invite. TRAIN mode, Atlanta metro.',
    ogImagePath: '/images/og-image.jpg?v=2',
  },
  {
    canonicalPath: '/partners/us/atlanta/atl-track-club',
    title: `Atlanta Track Club community invite | ${BRAND}`,
    description:
      'Join GetTrainMate with the Atlanta Track Club community invite. TRAIN mode, Atlanta metro. An invite is not an existing partnership claim.',
    ogTitle: `Atlanta Track Club community invite | ${BRAND}`,
    ogDescription:
      'Join GetTrainMate with the Atlanta Track Club community invite. TRAIN mode, Atlanta metro.',
    ogImagePath: '/images/og-image.jpg?v=2',
  },
  {
    canonicalPath: '/partners/atlanta/atl-f3',
    title: `F3 Atlanta community invite | ${BRAND}`,
    description: 'Join GetTrainMate with the F3 Atlanta community invite. TRAIN mode, Atlanta metro.',
    ogTitle: `F3 Atlanta community invite | ${BRAND}`,
    ogDescription: 'Join GetTrainMate with the F3 Atlanta community invite. TRAIN mode, Atlanta metro.',
    ogImagePath: '/images/og-image.jpg?v=2',
  },
  {
    canonicalPath: '/partners/us/atlanta/atl-f3',
    title: `F3 Atlanta community invite | ${BRAND}`,
    description: 'Join GetTrainMate with the F3 Atlanta community invite. TRAIN mode, Atlanta metro. An invite is not an existing partnership claim.',
    ogTitle: `F3 Atlanta community invite | ${BRAND}`,
    ogDescription: 'Join GetTrainMate with the F3 Atlanta community invite. TRAIN mode, Atlanta metro.',
    ogImagePath: '/images/og-image.jpg?v=2',
  },
  {
    canonicalPath: '/invite',
    title: `Invite a Training Partner | ${BRAND}`,
    description:
      'Share a TRAIN-first signup link for your city. Find gym, running, and race partners — not dating-first.',
    ogTitle: `Invite a Training Partner | ${BRAND}`,
    ogDescription:
      'Share a TRAIN-first signup link for your city. Find gym, running, and race partners — not dating-first.',
    ogImagePath: '/images/og-image.jpg?v=2',
  },
  {
    canonicalPath: '/faq',
    title: `FAQ | ${BRAND}`,
    description:
      'Answers about matching, credits, TRAIN/VIBE/DATE modes, safety, and how GetTrainMate works.',
    ogTitle: `FAQ | ${BRAND}`,
    ogDescription:
      'Answers about matching, credits, TRAIN/VIBE/DATE modes, safety, and how GetTrainMate works.',
    ogImagePath: '/images/og-image.jpg?v=2',
  },
  {
    canonicalPath: '/contact',
    title: `Contact | ${BRAND}`,
    description: 'Contact the GetTrainMate team for support, partnerships, or feedback.',
    ogTitle: `Contact | ${BRAND}`,
    ogDescription: 'Contact the GetTrainMate team for support, partnerships, or feedback.',
    ogImagePath: '/images/og-image.jpg?v=2',
  },
  {
    canonicalPath: '/platform',
    title: `Platform | ${BRAND}`,
    description: 'How GetTrainMate works — matching, credits, chat, events, and intent (Train/Vibe/Date).',
    ogTitle: `Platform | ${BRAND}`,
    ogDescription: 'How GetTrainMate works — matching, credits, chat, events, and intent (Train/Vibe/Date).',
    ogImagePath: '/images/og-image.jpg?v=2',
  },
  {
    canonicalPath: '/privacy',
    title: `Privacy Policy | ${BRAND}`,
    description: 'How GetTrainMate collects, uses, and protects your information.',
    ogTitle: `Privacy Policy | ${BRAND}`,
    ogDescription: 'How GetTrainMate collects, uses, and protects your information.',
    ogImagePath: '/images/og-image.jpg?v=2',
  },
  {
    canonicalPath: '/terms',
    title: `Terms of Service | ${BRAND}`,
    description: 'Terms of use for the GetTrainMate service.',
    ogTitle: `Terms of Service | ${BRAND}`,
    ogDescription: 'Terms of use for the GetTrainMate service.',
    ogImagePath: '/images/og-image.jpg?v=2',
  },
];

const WORLD_CUP_PAGES: PrerenderPage[] = [
  {
    canonicalPath: '/world-cup',
    title: `World Cup 2026 Fan Hub | ${BRAND}`,
    description:
      'Predict. Connect. Experience Together. Free World Cup 2026 predictions, live group standings, match schedule, and connect with fans near you on GetTrainMate.',
    ogTitle: 'World Cup 2026 Fan Hub — Predict. Connect. Experience Together.',
    ogDescription:
      'Make free predictions, see live groups, share your picks, and find fans nearby. No betting — just football fans connecting worldwide.',
    ogImagePath: '/images/event-banner.png',
    jsonLd: [buildWorldCupSportsEventLd('/world-cup')],
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
    jsonLd: [buildWorldCupSportsEventLd('/events/world-cup-2026')],
  },
];

function teamPages(): PrerenderPage[] {
  return WC_TEAMS.map((team) => {
    const canonicalPath = `/world-cup/team/${team.teamId}`;
    return {
      canonicalPath,
      title: `${team.name} — World Cup 2026 Fan Hub | ${BRAND}`,
      description:
        `Follow ${team.name} at FIFA World Cup 2026. Free predictions, group standings, upcoming matches, fan wall, and connect with ${team.name} supporters on GetTrainMate.`,
      ogTitle: `${team.name} World Cup 2026 — Predictions, Fans & Matches`,
      ogDescription:
        `Make free ${team.name} predictions, see standings and fixtures, and find fellow supporters worldwide.`,
      ogImagePath: '/images/event-banner.png',
    };
  });
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function canonicalHref(canonicalPath: string): string {
  if (canonicalPath === '/') return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${canonicalPath}`;
}

function injectRouteHtml(baseHtml: string, page: PrerenderPage): string {
  const canonical = canonicalHref(page.canonicalPath);
  const ogImage = page.ogImagePath.startsWith('http')
    ? page.ogImagePath
    : canonicalHref(page.ogImagePath);
  const webPageLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.ogTitle,
    description: page.ogDescription,
    url: canonical,
    isPartOf: { '@type': 'WebSite', url: SITE_ORIGIN, name: 'GetTrainMate' },
  };

  const html = baseHtml
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

  const jsonLdScripts = [webPageLd, ...(page.jsonLd ?? [])]
    .map((ld) => `<script type="application/ld+json">${JSON.stringify(ld)}</script>`)
    .join('\n    ');

  return html.replace('</head>', `    ${jsonLdScripts}\n  </head>`);
}

/** Static HTML shells with unique canonical/OG/JSON-LD for crawlers (SPA routes). */
export function prerenderSeoPlugin(): Plugin {
  const webRoot = dirname(fileURLToPath(import.meta.url));

  return {
    name: 'prerender-seo-html',
    closeBundle() {
      const outDir = join(webRoot, 'dist');
      const baseHtml = readFileSync(join(outDir, 'index.html'), 'utf8');
      const includeWorldCup = isWorldCupSeoEnabled();
      const pages = includeWorldCup
        ? [...MARKETING_PAGES, ...WORLD_CUP_PAGES, ...teamPages()]
        : [...MARKETING_PAGES];

      for (const page of pages) {
        const html = injectRouteHtml(baseHtml, page);
        const routeDir = join(outDir, ...page.canonicalPath.replace(/^\//, '').split('/'));
        mkdirSync(routeDir, { recursive: true });
        writeFileSync(join(routeDir, 'index.html'), html, 'utf8');
      }

      console.log(
        `[prerender-seo] wrote ${pages.length} static HTML shells`
        + (includeWorldCup ? ' (marketing + World Cup)' : ' (marketing only — WORLD_CUP_SEO=false)'),
      );
    },
  };
}
