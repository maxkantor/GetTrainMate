#!/usr/bin/env node
/**
 * Dry-run preview for a future Eastern calendar day (no Meta publish).
 *
 *   node scripts/growth/preview-tomorrow-social.mjs
 *   node scripts/growth/preview-tomorrow-social.mjs --date 2026-09-18
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureGrowthDeps } from './lib/ensure-growth-deps.mjs';
import {
  modeForWeekday,
  resolveOwnedSocialCreative,
  selectCatalogItem
} from './lib/owned-social-catalog.mjs';
import {
  readPublishedLog,
  recentlyUsedContentIds,
  recentPublishedLanguages
} from './lib/owned-social-log.mjs';
import { loadRecentImageHistory } from './lib/social-image-history.mjs';
import { generateSocialImage } from './lib/social-image-generator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  let date = '2026-09-18';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--date') date = argv[++i] || date;
  }
  return { date };
}

function weekdayFromIso(isoHyphen) {
  // Match Eastern calendar weekday for a fixed YYYY-MM-DD (noon UTC avoids DST edge).
  const d = new Date(`${isoHyphen}T16:00:00Z`);
  return d.getUTCDay();
}

async function main() {
  const deps = await ensureGrowthDeps();
  if (!deps.ok) {
    console.error(JSON.stringify({ ok: false, error: deps.error }));
    process.exit(2);
  }

  const { date: isoHyphen } = parseArgs(process.argv.slice(2));
  const isoDate = isoHyphen.replace(/-/g, '');
  const weekday = weekdayFromIso(isoHyphen);
  const log = readPublishedLog();
  const recentImageEntries = loadRecentImageHistory({ days: 30 });

  let item = selectCatalogItem({
    weekday,
    recentlyUsedIds: recentlyUsedContentIds(log),
    recentLanguages: recentPublishedLanguages(log),
    isoDate: isoHyphen
  });
  item = resolveOwnedSocialCreative(item, {
    isoDate: isoHyphen,
    recentEntries: recentImageEntries
  });

  const outDir = path.join(
    __dirname,
    `../../docs/growth/owned-social/generated/preview-${isoHyphen}`
  );

  const result = await generateSocialImage({
    catalogItem: item,
    isoDate,
    isoHyphen,
    recentImageEntries,
    dryRun: true,
    outDir
  });

  console.log(
    JSON.stringify(
      {
        ok: result.ok !== false,
        error: result.error || null,
        isoDate: isoHyphen,
        weekday,
        expectedMode: modeForWeekday(weekday),
        contentId: item.contentId,
        language: item.language,
        localPath: result.localPath,
        provider: result.provider,
        fallback: result.fallback,
        stockPhotoId: result.stockPhotoId || null,
        mode: result.concept?.mode,
        sport: result.concept?.sport,
        stage: result.concept?.stage,
        headline: result.concept?.imageHeadline,
        cta: result.concept?.cta,
        scene: result.scene || result.concept?.visualConcept || result.concept?.photoPrompt || null,
        durationMs: result.durationMs
      },
      null,
      2
    )
  );

  if (result.ok === false) process.exit(1);
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
});
