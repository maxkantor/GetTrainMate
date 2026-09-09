#!/usr/bin/env node
/**
 * Regenerate today's DATE creative with improved stock + contrast, dry-run first.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ensureGrowthDeps } from './lib/ensure-growth-deps.mjs';
import { findCatalogItemByContentId } from './lib/owned-social-catalog.mjs';
import { generateSocialImage } from './lib/social-image-generator.mjs';
import { determinePostActivity, buildImageConcept } from './lib/social-image-concept.mjs';
import { selectStockPhoto } from './lib/social-image-stock.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const deps = await ensureGrowthDeps();
  if (!deps.ok) {
    console.error(JSON.stringify({ ok: false, error: deps.error }));
    process.exit(2);
  }

  const catalogItem = findCatalogItemByContentId('date-es-citas-actividad');
  const outDir = path.join(__dirname, '../../docs/growth/owned-social/generated/test-date-quality');
  fs.mkdirSync(outDir, { recursive: true });

  const concept = buildImageConcept(catalogItem, {
    isoDate: '2026-09-09',
    overrides: {
      mode: 'DATE',
      language: 'es',
      imageHeadline: 'CONOCE SOLTEROS ACTIVOS CERCA DE TI.',
      cta: 'CONOCE A ALGUIEN'
    }
  });

  const photo = selectStockPhoto({
    mode: 'DATE',
    activity: concept.semanticActivity,
    contentId: catalogItem.contentId,
    isoDate: '2026-09-09-fix'
  });

  console.log(
    JSON.stringify(
      {
        contentId: catalogItem.contentId,
        semanticActivity: concept.semanticActivity,
        stockPhotoId: photo.id,
        scene: photo.scene,
        headline: concept.imageHeadline,
        cta: concept.cta
      },
      null,
      2
    )
  );

  const result = await generateSocialImage({
    catalogItem,
    isoDate: '20260909',
    isoHyphen: '2026-09-09',
    recentImageEntries: [{ stockPhotoId: 'date-couple-daytime-laughter' }],
    dryRun: true,
    outDir,
    conceptOverrides: {
      mode: 'DATE',
      language: 'es',
      imageHeadline: 'CONOCE SOLTEROS ACTIVOS CERCA DE TI.',
      cta: 'CONOCE A ALGUIEN'
    }
  });

  console.log(
    JSON.stringify(
      {
        ok: result.ok !== false,
        localPath: result.localPath,
        stockPhotoId: result.concept?.stockPhotoId,
        scene: result.concept?.visualConcept,
        semanticActivity: result.concept?.semanticActivity,
        fileSize: result.localPath && fs.existsSync(result.localPath) ? fs.statSync(result.localPath).size : 0
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
