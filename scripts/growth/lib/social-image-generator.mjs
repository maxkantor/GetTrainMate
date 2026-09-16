/**
 * GetTrainMate social image generator.
 * Quality rule: publish only a real lifestyle photo that matches the semantic activity.
 * Bedrock Stable Image Core is the PRIMARY provider. Curated stock is a guarded fallback only.
 * A missing or rejected image is a failed creative, never permission to publish a generic card.
 */
import crypto from 'node:crypto';
import { buildImageConcept } from './social-image-concept.mjs';
import { generateStockPhoto } from './social-image-stock.mjs';
import { composeSocialImageFromPhoto } from './social-image-photo-compose.mjs';
import { logSocialImageEvent } from './social-image-logger.mjs';
import { buildSocialImageKey, saveLocalSocialImage, uploadAndVerifySocialImageBuffer, publicUrlForKey } from './social-image-storage.mjs';
import { assessCreativeProductFit, selectEvergreenCreative } from './social-creative-quality.mjs';
import { assessCreativeStandard } from './social-creative-standard.mjs';

// Bedrock is intentionally the default. Set SOCIAL_IMAGE_PROVIDER=stock only for an explicit stock-only run.
export const SOCIAL_IMAGE_PROVIDER = (process.env.SOCIAL_IMAGE_PROVIDER || 'bedrock').toLowerCase();

function evaluateCreativeGate(concept, photo = {}) {
  const actualScene = photo.scene || concept.visualConcept || concept.photoPrompt;
  const payload = {
    mode: concept.mode,
    sport: concept.sport,
    stage: concept.stage,
    stockPhotoId: photo.stockPhotoId || concept.stockPhotoId,
    scene: actualScene,
    // Once a provider returns a concrete photo scene, assess that scene rather
    // than contaminating the gate with prompt exclusion text.
    photoPrompt: photo.scene ? '' : concept.photoPrompt,
    visualConcept: photo.scene ? '' : concept.visualConcept,
    imageHeadline: concept.imageHeadline
  };
  const product = assessCreativeProductFit(payload);
  if (!product.ok) return product;
  return assessCreativeStandard(payload);
}

async function tryBedrock(concept, { sharpImpl } = {}) {
  const { generateBedrockPhoto } = await import('./social-image-bedrock.mjs');
  const result = await generateBedrockPhoto(concept, {
    seed: concept.backgroundSeed,
    sharpImpl,
    maxAttempts: 5
  });
  if (result?.ok) {
    return { ...result, provider: 'bedrock' };
  }
  return { ok: false, error: result?.error || 'bedrock_generation_failed', provider: 'bedrock' };
}

async function tryStock(concept, { isoDate, activity, recentEntries, sharpImpl } = {}) {
  const result = await generateStockPhoto(concept, {
    isoDate,
    activity,
    recentEntries,
    sharpImpl,
    maxAttempts: 12
  });
  if (result?.ok) {
    return { ...result, provider: 'stock' };
  }
  return { ok: false, error: result?.error || result?.reason || 'stock_generation_failed', provider: 'stock' };
}

async function fetchEvergreenBuffer(entry, { fetchImpl = globalThis.fetch } = {}) {
  const url =
    entry?.imageUrl ||
    (entry?.imageKey ? publicUrlForKey(entry.imageKey) : '');
  if (!url) return { ok: false, error: 'evergreen_missing_url' };
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return { ok: false, error: `evergreen_fetch_${res.status}` };
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length) return { ok: false, error: 'evergreen_empty' };
    return {
      ok: true,
      buffer,
      provider: 'evergreen',
      modelId: entry.imageProvider || 'evergreen_prior_publish',
      stockPhotoId: entry.stockPhotoId || '',
      scene: entry.visualConcept || entry.photoPrompt || 'evergreen prior creative',
      seed: 0,
      evergreenFrom: entry.imageKey || entry.imageUrl
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'evergreen_fetch_failed' };
  }
}

async function generatePhotoBuffer(concept, { isoDate, activity, recentEntries, sharpImpl } = {}) {
  if (SOCIAL_IMAGE_PROVIDER === 'procedural') {
    return { ok: false, error: 'procedural_disabled_for_social_quality', provider: 'procedural' };
  }

  // Explicit stock-only mode remains available for diagnostics, but production defaults to Bedrock.
  if (SOCIAL_IMAGE_PROVIDER === 'stock') {
    const stockOnly = await tryStock(concept, { isoDate, activity, recentEntries, sharpImpl });
    if (stockOnly.ok) {
      const fit = evaluateCreativeGate(concept, stockOnly);
      if (!fit.ok) return { ok: false, error: fit.reason, provider: 'stock' };
    }
    return stockOnly;
  }

  // Production path: Bedrock first. Only if Bedrock fails every quality-gated attempt do we try curated stock.
  const bedrock = await tryBedrock(concept, { sharpImpl });
  if (bedrock.ok) {
    const fit = evaluateCreativeGate(concept, { scene: concept.visualConcept || concept.photoPrompt });
    if (fit.ok) return bedrock;
    logSocialImageEvent('SocialImageRejected', {
      mode: concept.mode,
      contentId: concept.contentId,
      reason: fit.reason,
      provider: 'bedrock',
      score: fit.score || null
    });
  }

  logSocialImageEvent('SocialImagePrimaryProviderFailed', {
    mode: concept.mode,
    contentId: concept.contentId,
    provider: 'bedrock',
    reason: bedrock.error || 'bedrock_product_fit_reject',
    fallbackProvider: 'stock'
  });

  const stock = await tryStock(concept, { isoDate, activity, recentEntries, sharpImpl });
  if (stock.ok) {
    const fit = evaluateCreativeGate(concept, stock);
    if (fit.ok) {
      return { ...stock, primaryFailure: bedrock.error };
    }
    logSocialImageEvent('SocialImageRejected', {
      mode: concept.mode,
      contentId: concept.contentId,
      reason: fit.reason,
      provider: 'stock',
      stockPhotoId: stock.stockPhotoId,
      score: fit.score || null
    });
  }

  const evergreenEntry = selectEvergreenCreative(recentEntries, { mode: concept.mode });
  if (evergreenEntry) {
    const evergreen = await fetchEvergreenBuffer(evergreenEntry);
    if (evergreen.ok) {
      logSocialImageEvent('SocialImageEvergreenUsed', {
        mode: concept.mode,
        contentId: concept.contentId,
        evergreenFrom: evergreen.evergreenFrom,
        bedrockError: bedrock.error || null,
        stockError: stock.error || null
      });
      return {
        ...evergreen,
        primaryFailure: bedrock.error || stock.error || 'generation_failed_quality_gate'
      };
    }
  }

  return {
    ok: false,
    error: `bedrock:${bedrock.error || 'n/a'}; stock:${stock.error || 'n/a'}; evergreen:unavailable`,
    provider: 'bedrock+stock'
  };
}

export async function generateSocialImage({ catalogItem, isoDate, isoHyphen, recentImageEntries = [], dryRun = false, outDir = null, sharpImpl = null, conceptOverrides = null } = {}) {
  const started = Date.now();
  const concept = buildImageConcept(catalogItem, { isoDate, recentEntries: recentImageEntries, overrides: conceptOverrides || {} });

  logSocialImageEvent('SocialImageGenerationStarted', {
    mode: concept.mode,
    contentId: concept.contentId,
    provider: SOCIAL_IMAGE_PROVIDER,
    headline: concept.imageHeadline,
    semanticActivity: concept.semanticActivity
  });

  const photo = await generatePhotoBuffer(concept, {
    isoDate,
    activity: concept.semanticActivity || catalogItem?.activity,
    recentEntries: recentImageEntries,
    sharpImpl
  });

  if (!photo.ok || !photo.buffer?.length) {
    const reason = photo.error || photo.reason || 'photo_generation_failed';
    logSocialImageEvent('SocialImageRejected', {
      mode: concept.mode,
      contentId: concept.contentId,
      reason,
      semanticActivity: concept.semanticActivity
    });
    return {
      ok: false,
      concept,
      provider: photo.provider || SOCIAL_IMAGE_PROVIDER,
      fallback: false,
      error: `photo_required:${reason}`,
      durationMs: Date.now() - started
    };
  }

  if (photo.stockPhotoId) {
    concept.stockPhotoId = photo.stockPhotoId;
    concept.visualConcept = photo.scene || concept.visualConcept;
  } else if (photo.prompt) {
    // Keep the semantic concept, while recording that the actual photo came from Bedrock.
    concept.visualConcept = concept.visualConcept || concept.photoPrompt || `${concept.mode} human connection`;
  }

  const composed = await composeSocialImageFromPhoto(photo.buffer, concept, { sharpImpl });
  const provider = photo.provider === 'bedrock'
    ? (photo.modelId || 'bedrock_stable_image_core')
    : photo.provider === 'evergreen'
      ? (photo.modelId || 'evergreen_prior_publish')
    : (photo.modelId || 'unsplash_stock');

  logSocialImageEvent('SocialImageGenerationSucceeded', {
    mode: concept.mode,
    contentId: concept.contentId,
    provider,
    fallback: photo.provider === 'stock' && SOCIAL_IMAGE_PROVIDER !== 'stock',
    evergreen: photo.provider === 'evergreen',
    photoBytes: photo.buffer.length,
    seed: photo.seed,
    stockPhotoId: photo.stockPhotoId || null,
    semanticActivity: concept.semanticActivity,
    primaryFailure: photo.primaryFailure || null
  });

  const uniqueId = `${concept.contentId}-${isoDate || 'sample'}-${crypto.randomBytes(3).toString('hex')}`;
  const key = buildSocialImageKey({ isoHyphen, uniqueId });

  if (dryRun) {
    const saved = saveLocalSocialImage({ buffer: composed.buffer, isoHyphen, uniqueId, outDir });
    return {
      ok: true,
      concept,
      imageUrl: null,
      localPath: saved.localPath,
      imageKey: key,
      provider,
      fallback: (photo.provider === 'stock' || photo.provider === 'evergreen') && SOCIAL_IMAGE_PROVIDER !== 'stock',
      width: composed.width,
      height: composed.height,
      imageBuffer: composed.buffer,
      durationMs: Date.now() - started
    };
  }

  const uploaded = await uploadAndVerifySocialImageBuffer({ buffer: composed.buffer, key });
  if (!uploaded.ok) {
    const saved = saveLocalSocialImage({ buffer: composed.buffer, isoHyphen, uniqueId, outDir });
    logSocialImageEvent('SocialImageGenerationFailed', { mode: concept.mode, uploadError: uploaded.error, localPath: saved.localPath });
    return {
      ok: false,
      concept,
      localPath: saved.localPath,
      imageKey: key,
      provider,
      fallback: (photo.provider === 'stock' || photo.provider === 'evergreen') && SOCIAL_IMAGE_PROVIDER !== 'stock',
      uploadError: uploaded.error,
      durationMs: Date.now() - started
    };
  }

  logSocialImageEvent('SocialImageUploaded', {
    key,
    provider,
    fallback: (photo.provider === 'stock' || photo.provider === 'evergreen') && SOCIAL_IMAGE_PROVIDER !== 'stock'
  });

  return {
    ok: true,
    concept,
    imageUrl: uploaded.url,
    imageKey: key,
    bucket: uploaded.bucket,
    provider,
    fallback: (photo.provider === 'stock' || photo.provider === 'evergreen') && SOCIAL_IMAGE_PROVIDER !== 'stock',
    width: composed.width,
    height: composed.height,
    imageBuffer: composed.buffer,
    mediaCheck: uploaded.mediaCheck,
    durationMs: Date.now() - started
  };
}
