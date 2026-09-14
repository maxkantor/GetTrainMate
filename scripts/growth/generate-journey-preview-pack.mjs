#!/usr/bin/env node
/**
 * Local preview pack for the 10 approved journey creatives.
 * Stock-only, dry-run — never publishes to Meta.
 *
 *   SOCIAL_IMAGE_PROVIDER=stock node scripts/growth/generate-journey-preview-pack.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureGrowthDeps } from './lib/ensure-growth-deps.mjs';
import { findCatalogItemByContentId, resolveOwnedSocialCreative } from './lib/owned-social-catalog.mjs';
import { generateSocialImage } from './lib/social-image-generator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONCEPTS = [
  { id: '01-pickleball', contentId: 'train-en-workout-partner', isoDate: '2026-09-15', headline: 'GOOD GAME. DRINKS AFTER?', activity: 'pickleball' },
  { id: '02-gym', contentId: 'train-en-workout-partner', isoDate: '2026-09-16', headline: 'NEED A WORKOUT PARTNER?', activity: 'strength' },
  { id: '03-run-coffee', contentId: 'train-en-workout-partner', isoDate: '2026-09-17', headline: 'RUN TOGETHER. COFFEE AFTER?', activity: 'running' },
  { id: '04-volleyball', contentId: 'vibe-en-new-in-town', isoDate: '2026-09-18', headline: 'FIND YOUR GAME. FIND YOUR PEOPLE.', activity: 'volleyball' },
  { id: '05-hike', contentId: 'train-en-workout-partner', isoDate: '2026-09-19', headline: 'START WITH A HIKE. SEE WHAT HAPPENS.', activity: 'hiking' },
  { id: '06-tennis', contentId: 'date-en-active-singles', isoDate: '2026-09-20', headline: 'GOOD MATCH. YOUR MOVE.', activity: 'tennis' },
  { id: '07-rooftop', contentId: 'vibe-en-new-in-town', isoDate: '2026-09-21', headline: 'WORK OUT. HANG OUT. MAYBE MORE.', activity: 'rooftop_after_workout' },
  { id: '08-spot', contentId: 'date-en-active-singles', isoDate: '2026-09-22', headline: 'NEED A SPOT? MAYBE A DATE?', activity: 'strength' },
  { id: '09-soccer', contentId: 'vibe-en-new-in-town', isoDate: '2026-09-23', headline: 'GOOD WORKOUT. YOUR MOVE.', activity: 'sports_bar_after_soccer' },
  { id: '10-cycling', contentId: 'vibe-en-new-in-town', isoDate: '2026-09-24', headline: 'SAME ENERGY. NOW SAY HI.', activity: 'cafe_after_cycle' }
];

async function main() {
  process.env.SOCIAL_IMAGE_PROVIDER = 'stock';
  const deps = await ensureGrowthDeps();
  if (!deps.ok) {
    console.error(JSON.stringify({ ok: false, error: deps.error }));
    process.exit(2);
  }

  const outDir = path.join(__dirname, '../../docs/growth/owned-social/generated/preview-journey-2026-09-14');
  fs.mkdirSync(outDir, { recursive: true });
  const results = [];

  for (const concept of CONCEPTS) {
    const base = findCatalogItemByContentId(concept.contentId);
    const creative = resolveOwnedSocialCreative(base, { isoDate: concept.isoDate });
    const result = await generateSocialImage({
      catalogItem: creative,
      isoDate: concept.isoDate.replace(/-/g, ''),
      isoHyphen: concept.isoDate,
      recentImageEntries: [],
      dryRun: true,
      outDir,
      conceptOverrides: {
        imageHeadline: concept.headline,
        semanticActivity: concept.activity,
        activity: concept.activity
      }
    });
    const target = path.join(outDir, `${concept.id}.jpg`);
    if (result.localPath && fs.existsSync(result.localPath)) {
      fs.copyFileSync(result.localPath, target);
    }
    results.push({
      id: concept.id,
      ok: result.ok !== false && fs.existsSync(target),
      headline: concept.headline,
      provider: result.provider,
      stockPhotoId: result.concept?.stockPhotoId || result.stockPhotoId,
      path: target
    });
  }

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ ok: results.every((r) => r.ok), outDir, results }, null, 2));
  if (!results.every((r) => r.ok)) process.exit(1);
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
});
