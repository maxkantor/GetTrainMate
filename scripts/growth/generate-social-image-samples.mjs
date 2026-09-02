#!/usr/bin/env node
/**
 * Generate sample branded social images for visual inspection (no Meta publish).
 *
 *   node scripts/growth/generate-social-image-samples.mjs
 *   node scripts/growth/generate-social-image-samples.mjs --mode TRAIN
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureGrowthDeps } from './lib/ensure-growth-deps.mjs';
import { CATALOG } from './lib/owned-social-catalog.mjs';
import { generateSocialImage } from './lib/social-image-generator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = { mode: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--mode') out.mode = String(argv[++i] || '').toUpperCase();
  }
  return out;
}

async function main() {
  const deps = await ensureGrowthDeps();
  if (!deps.ok) {
    console.error(JSON.stringify({ ok: false, error: deps.error }));
    process.exit(2);
  }
  const args = parseArgs(process.argv.slice(2));
  const modes = args.mode ? [args.mode] : ['TRAIN', 'VIBE', 'DATE'];
  const outDir = path.join(__dirname, '../../docs/growth/owned-social/generated/samples');
  const results = [];

  for (const mode of modes) {
    const item = CATALOG.find((c) => c.mode === mode && c.language === 'en') || CATALOG.find((c) => c.mode === mode);
    if (!item) continue;
    const image = await generateSocialImage({
      catalogItem: item,
      isoDate: 'sample',
      isoHyphen: 'samples',
      recentImageEntries: [],
      dryRun: true,
      outDir,
      uniqueSuffix: mode.toLowerCase()
    });
    results.push({
      mode,
      contentId: item.contentId,
      localPath: image.localPath,
      headline: image.concept?.imageHeadline,
      visualConcept: image.concept?.visualConcept,
      cta: image.concept?.cta
    });
  }

  console.log(JSON.stringify({ ok: true, outDir, results }, null, 2));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
});
