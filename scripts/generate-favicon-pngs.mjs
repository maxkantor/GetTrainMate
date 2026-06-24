#!/usr/bin/env node
/**
 * Rasterize public/favicon.svg to PNG sizes for browsers / PWA / iOS.
 * Run: node scripts/generate-favicon-pngs.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SVG_PATH = join(ROOT, 'apps/web/public/brand/gtm-icon-favicon.svg');
const OUT_DIR = join(ROOT, 'apps/web/public');
const svg = readFileSync(SVG_PATH, 'utf8');

const SIZES = [
  { name: 'favicon-16.png', width: 16 },
  { name: 'favicon-32.png', width: 32 },
  { name: 'favicon-48.png', width: 48 },
  { name: 'apple-touch-icon.png', width: 180 },
];

for (const { name, width } of SIZES) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: 'transparent',
  });
  const png = resvg.render().asPng();
  writeFileSync(join(OUT_DIR, name), png);
  console.log(`Wrote ${name} (${width}px)`);
}
