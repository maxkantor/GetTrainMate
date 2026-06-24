#!/usr/bin/env node
/**
 * Emit static brand SVG assets from shared Interlock Rings geometry.
 * Keep ring numbers in sync with apps/web/src/components/brand/gtmMarkArt.ts
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BRAND_DIR = join(ROOT, 'apps/web/public/brand');
const PUBLIC_DIR = join(ROOT, 'apps/web/public');

const STANDARD_RINGS = [
  { cx: 18.8, cy: 23.55, outerR: 11.25, innerR: 6.35 },
  { cx: 29.2, cy: 24.45, outerR: 11.25, innerR: 6.35 },
];

const FAVICON_RINGS = [
  { cx: 16.55, cy: 23.35, outerR: 13.15, innerR: 7.05 },
  { cx: 31.45, cy: 24.65, outerR: 13.15, innerR: 7.05 },
];

function ringPath({ cx, cy, outerR, innerR }) {
  return [
    `M ${cx + outerR} ${cy}`,
    `A ${outerR} ${outerR} 0 1 1 ${cx - outerR} ${cy}`,
    `A ${outerR} ${outerR} 0 1 1 ${cx + outerR} ${cy}`,
    `Z`,
    `M ${cx + innerR} ${cy}`,
    `A ${innerR} ${innerR} 0 1 0 ${cx - innerR} ${cy}`,
    `A ${innerR} ${innerR} 0 1 0 ${cx + innerR} ${cy}`,
    `Z`,
  ].join(' ');
}

function ringsMarkup(rings, fill) {
  return rings
    .map(
      (r) =>
        `<path fill-rule="evenodd" clip-rule="evenodd" d="${ringPath(r)}" fill="${fill}"/>`,
    )
    .join('\n  ');
}

const GRADIENT_DEF = `<defs>
    <linearGradient id="g" x1="11" y1="12" x2="37" y2="40" gradientUnits="userSpaceOnUse">
      <stop stop-color="#7C5CFF"/>
      <stop offset="0.72" stop-color="#C084FC"/>
      <stop offset="1" stop-color="#FFB347" stop-opacity="0.65"/>
    </linearGradient>
  </defs>`;

const DARK_GRADIENT_DEF = `<defs>
    <linearGradient id="g" x1="11" y1="12" x2="37" y2="40" gradientUnits="userSpaceOnUse">
      <stop stop-color="#9B7FFF"/>
      <stop offset="0.72" stop-color="#D8B4FE"/>
      <stop offset="1" stop-color="#FFCC80" stop-opacity="0.85"/>
    </linearGradient>
  </defs>`;

function svg({ rings, bg, rx = 11, bgColor = '#0B1020', gradient = GRADIENT_DEF, fill = 'url(#g)' }) {
  const bgRect = bg
    ? `<rect x="1" y="1" width="46" height="46" rx="${rx}" fill="${bgColor}"/>`
    : '';
  const defs = fill === 'url(#g)' ? gradient : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" role="img" aria-label="GetTrainMate">
  ${defs}
  ${bgRect}
  ${ringsMarkup(rings, fill)}
</svg>
`;
}

const files = [
  { path: join(BRAND_DIR, 'gtm-icon-navbar.svg'), content: svg({ rings: STANDARD_RINGS, bg: false }) },
  { path: join(BRAND_DIR, 'gtm-icon-transparent.svg'), content: svg({ rings: STANDARD_RINGS, bg: false }) },
  {
    path: join(BRAND_DIR, 'gtm-icon-main.svg'),
    content: svg({ rings: STANDARD_RINGS, bg: true, rx: 12 }),
  },
  {
    path: join(BRAND_DIR, 'gtm-icon-favicon.svg'),
    content: svg({ rings: FAVICON_RINGS, bg: true }),
  },
  {
    path: join(BRAND_DIR, 'gtm-icon-app.svg'),
    content: svg({ rings: STANDARD_RINGS, bg: true, rx: 12 }),
  },
  {
    path: join(BRAND_DIR, 'gtm-icon-monochrome.svg'),
    content: svg({ rings: STANDARD_RINGS, bg: false, gradient: '', fill: '#FFFFFF' }),
  },
  {
    path: join(BRAND_DIR, 'gtm-icon-dark.svg'),
    content: svg({
      rings: STANDARD_RINGS,
      bg: true,
      bgColor: '#070B1A',
      gradient: DARK_GRADIENT_DEF,
    }),
  },
  { path: join(PUBLIC_DIR, 'favicon.svg'), content: svg({ rings: FAVICON_RINGS, bg: true }) },
];

for (const { path, content } of files) {
  writeFileSync(path, `${content}\n`, 'utf8');
  console.log(`Wrote ${path.replace(ROOT + '/', '')}`);
}
