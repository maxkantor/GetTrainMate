#!/usr/bin/env node
/**
 * Regenerate apps/web/public/sitemap.xml.
 * World Cup URLs are included only when WORLD_CUP_SEO is enabled (default true).
 * Run: node scripts/generate-sitemap.mjs
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isWorldCupSeoEnabled } from './worldCupSeo.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'apps/web/public/sitemap.xml');
const ORIGIN = 'https://gettrainmate.com';
const TODAY = new Date().toISOString().slice(0, 10);

const WC_TEAMS = [
  'mexico', 'south-africa', 'south-korea', 'czechia', 'canada', 'bosnia-herzegovina', 'qatar', 'switzerland',
  'brazil', 'morocco', 'haiti', 'scotland', 'usa', 'paraguay', 'australia', 'turkiye',
  'germany', 'curacao', 'ivory-coast', 'ecuador', 'netherlands', 'japan', 'sweden', 'tunisia',
  'belgium', 'egypt', 'iran', 'new-zealand', 'spain', 'cape-verde', 'saudi-arabia', 'uruguay',
  'france', 'senegal', 'norway', 'iraq', 'argentina', 'algeria', 'austria', 'jordan',
  'portugal', 'colombia', 'dr-congo', 'uzbekistan', 'england', 'croatia', 'ghana', 'panama',
];

/** Core marketing URLs — always published. */
const STATIC = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/pricing', changefreq: 'monthly', priority: '0.9' },
  { loc: '/about', changefreq: 'monthly', priority: '0.8' },
  { loc: '/atlanta-training-partners', changefreq: 'weekly', priority: '0.9' },
  { loc: '/partners/atlanta', changefreq: 'weekly', priority: '0.85' },
  { loc: '/partners/us/atlanta', changefreq: 'weekly', priority: '0.85' },
  { loc: '/partners/atlanta/atl-track-club', changefreq: 'weekly', priority: '0.8' },
  { loc: '/partners/us/atlanta/atl-track-club', changefreq: 'weekly', priority: '0.8' },
  { loc: '/partners/atlanta/atl-f3', changefreq: 'weekly', priority: '0.8' },
  { loc: '/partners/us/atlanta/atl-f3', changefreq: 'weekly', priority: '0.8' },
  { loc: '/invite', changefreq: 'weekly', priority: '0.85' },
  { loc: '/faq', changefreq: 'monthly', priority: '0.8' },
  { loc: '/contact', changefreq: 'monthly', priority: '0.8' },
  { loc: '/gear', changefreq: 'monthly', priority: '0.7' },
  { loc: '/platform', changefreq: 'monthly', priority: '0.7' },
  { loc: '/login', changefreq: 'monthly', priority: '0.6' },
  { loc: '/signup', changefreq: 'monthly', priority: '0.7' },
  { loc: '/privacy', changefreq: 'yearly', priority: '0.5' },
  { loc: '/terms', changefreq: 'yearly', priority: '0.5' },
];

const WORLD_CUP_STATIC = [
  { loc: '/world-cup', changefreq: 'daily', priority: '0.95' },
  { loc: '/events/world-cup-2026', changefreq: 'daily', priority: '0.9' },
];

const includeWorldCup = isWorldCupSeoEnabled();
const teamUrls = includeWorldCup
  ? WC_TEAMS.map((id) => ({
      loc: `/world-cup/team/${id}`,
      changefreq: 'weekly',
      priority: '0.85',
    }))
  : [];

const urls = [
  ...STATIC,
  ...(includeWorldCup ? WORLD_CUP_STATIC : []),
  ...teamUrls,
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${ORIGIN}${u.loc}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

writeFileSync(OUT, xml, 'utf8');
console.log(
  `Wrote ${urls.length} URLs → ${OUT}`
  + (includeWorldCup ? ' (includes World Cup)' : ' (World Cup omitted — WORLD_CUP_SEO=false)'),
);
