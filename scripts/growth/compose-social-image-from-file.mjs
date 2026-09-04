#!/usr/bin/env node
/**
 * Compose branded overlay onto an existing photo (preview / manual QA).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureGrowthDeps } from './lib/ensure-growth-deps.mjs';
import { buildImageConcept } from './lib/social-image-concept.mjs';
import { composeSocialImageFromPhoto } from './lib/social-image-photo-compose.mjs';
import { findCatalogItemByContentId } from './lib/owned-social-catalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOMORROW_TRAIN = {
  mode: 'TRAIN',
  imageHeadline: 'Find Your Workout Partner',
  cta: 'FIND A TRAINING PARTNER'
};

async function main() {
  const photoPath = process.argv[2];
  const outDir =
    process.argv[3] ||
    path.join(__dirname, '../../docs/growth/owned-social/generated/preview-2026-09-03-train-v2');
  if (!photoPath || !fs.existsSync(photoPath)) {
    console.error(JSON.stringify({ ok: false, error: 'usage: node compose-social-image-from-file.mjs <photo> [outDir]' }));
    process.exit(2);
  }
  await ensureGrowthDeps();
  const catalogItem = findCatalogItemByContentId('train-en-workout-partner');
  const concept = buildImageConcept(catalogItem, {
    isoDate: '20260903',
    recentEntries: [],
    overrides: TOMORROW_TRAIN
  });
  const photoBuffer = fs.readFileSync(photoPath);
  const composed = await composeSocialImageFromPhoto(photoBuffer, concept);
  fs.mkdirSync(outDir, { recursive: true });
  const localPath = path.join(outDir, 'train-en-workout-partner-20260903-preview.jpg');
  fs.writeFileSync(localPath, composed.buffer);
  console.log(JSON.stringify({ ok: true, localPath, concept }, null, 2));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
});
