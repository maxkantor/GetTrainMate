#!/usr/bin/env node
/**
 * Generate a single social image preview (no publish).
 *
 *   node scripts/growth/generate-social-image-preview.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureGrowthDeps } from './lib/ensure-growth-deps.mjs';
import { findCatalogItemByContentId } from './lib/owned-social-catalog.mjs';
import { generateSocialImage } from './lib/social-image-generator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOMORROW_TRAIN = {
  mode: 'TRAIN',
  imageHeadline: 'Find Your Workout Partner',
  cta: 'START MATCHING',
  photoPrompt:
    'Beautiful sexy fit athletic adult woman and handsome muscular athletic adult man training together in a luxurious modern gym. Both approximately 30–40 years old. Woman wearing stylish premium sports bra and leggings; man wearing fitted premium athletic clothing. Both have realistic fit physiques. Natural playful chemistry, smiling at each other between exercises, subtle flirtatious energy, authentic post-workout sweat, dramatic cinematic gym lighting, premium commercial fitness photography, photorealistic, sophisticated and aspirational.'
};

async function main() {
  const deps = await ensureGrowthDeps();
  if (!deps.ok) {
    console.error(JSON.stringify({ ok: false, error: deps.error }));
    process.exit(2);
  }

  const catalogItem = findCatalogItemByContentId('train-en-workout-partner');
  const outDir = path.join(__dirname, '../../docs/growth/owned-social/generated/preview-2026-09-03-train-v2');

  const result = await generateSocialImage({
    catalogItem,
    isoDate: '20260903',
    isoHyphen: '2026-09-03',
    recentImageEntries: [],
    dryRun: true,
    outDir,
    conceptOverrides: TOMORROW_TRAIN
  });

  console.log(
    JSON.stringify(
      {
        ok: result.ok !== false,
        localPath: result.localPath,
        provider: result.provider,
        fallback: result.fallback,
        mode: result.concept?.mode,
        headline: result.concept?.imageHeadline,
        cta: result.concept?.cta,
        durationMs: result.durationMs
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
