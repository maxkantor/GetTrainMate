#!/usr/bin/env node
/** One-time: optimize curated HIW Bedrock photos into apps/web/public/images/hiw/ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { ensureGrowthDeps } from './lib/ensure-growth-deps.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const require = createRequire(path.join(__dirname, 'package.json'));

async function main() {
  const deps = await ensureGrowthDeps();
  if (!deps.ok) {
    console.error(JSON.stringify({ ok: false, error: deps.error }));
    process.exit(2);
  }
  const sharp = require('sharp');

  const SRC = path.join(ROOT, 'docs/growth/owned-social/generated/hiw-bedrock-candidates-2026-09-14');
  const OUT = path.join(ROOT, 'apps/web/public/images/hiw');
  fs.mkdirSync(OUT, { recursive: true });

  const discoverSrc = path.join(SRC, 'discover-discover-run.jpg');
  const matchSrc = path.join(SRC, 'match-match-v2-trail-c.jpg');

  await sharp(discoverSrc)
    .resize(900, 1200, { fit: 'cover', position: 'top' })
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(path.join(OUT, 'discover.jpg'));

  await sharp(matchSrc)
    .resize(900, 1200, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(path.join(OUT, 'match-pair.jpg'));

  const meta = await sharp(matchSrc).metadata();
  const w = meta.width || 1080;
  const h = meta.height || 1350;
  // Man is on the LEFT in trail-c — square face crop for MATCH/CHAT peer avatar
  const side = Math.round(Math.min(w, h) * 0.52);
  const left = Math.max(0, Math.round(w * 0.04));
  const top = Math.max(0, Math.round(h * 0.06));
  await sharp(matchSrc)
    .extract({
      left,
      top,
      width: Math.min(side, w - left),
      height: Math.min(side, h - top)
    })
    .resize(600, 600, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(path.join(OUT, 'match-peer.jpg'));

  await sharp(discoverSrc)
    .resize(600, 600, { fit: 'cover', position: 'top' })
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(path.join(OUT, 'discover-avatar.jpg'));

  console.log(
    JSON.stringify(
      {
        ok: true,
        out: OUT,
        files: fs.readdirSync(OUT).map((f) => ({
          f,
          bytes: fs.statSync(path.join(OUT, f)).size
        }))
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
});
