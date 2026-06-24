#!/usr/bin/env node
/**
 * Rasterize brand favicon SVG to PNG + ICO for browsers / PWA / iOS.
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

const pngBySize = new Map();

for (const { name, width } of SIZES) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: 'transparent',
  });
  const png = resvg.render().asPng();
  writeFileSync(join(OUT_DIR, name), png);
  pngBySize.set(width, png);
  console.log(`Wrote ${name} (${width}px)`);
}

/** Modern ICO with embedded PNG payloads (16 + 32) */
function writeIco(outPath, entries) {
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  let imageOffset = 6 + count * 16;
  const parts = [header];

  for (const { width, height, png } of entries) {
    const dir = Buffer.alloc(16);
    dir.writeUInt8(width >= 256 ? 0 : width, 0);
    dir.writeUInt8(height >= 256 ? 0 : height, 1);
    dir.writeUInt8(0, 2);
    dir.writeUInt8(0, 3);
    dir.writeUInt16LE(1, 4);
    dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(png.length, 8);
    dir.writeUInt32LE(imageOffset, 12);
    parts.push(dir, png);
    imageOffset += png.length;
  }

  writeFileSync(outPath, Buffer.concat(parts));
  console.log(`Wrote favicon.ico (${entries.map((e) => e.width).join(' + ')}px)`);
}

writeIco(join(OUT_DIR, 'favicon.ico'), [
  { width: 16, height: 16, png: pngBySize.get(16) },
  { width: 32, height: 32, png: pngBySize.get(32) },
]);
