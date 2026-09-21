/**
 * GetTrainMate social image generator.
 *
 * Daily production rule (Sep 18 owner direction):
 * - Bedrock generates a NEW photorealistic photograph every day
 * - Never republish preexisting creatives (approved samples are reference only)
 * - Never fall back to Unsplash stock rotation as the daily hero
 * - Fail closed if generation cannot pass the photoreal quality gate
 *
 * Diagnostics: SOCIAL_IMAGE_PROVIDER=stock|procedural
 */
import crypto from 'node:crypto';
import { buildImageConcept } from './social-image-concept.mjs';
import { composeSocialImageFromPhoto } from './social-image-photo-compose.mjs';
import { logSocialImageEvent } from './social-image-logger.mjs';
import { buildSocialImageKey, saveLocalSocialImage, uploadAndVerifySocialImageBuffer } from './social-image-storage.mjs';
import { assessCreativeProductFit } from './social-creative-quality.mjs';
import { assessCreativeStandard } from './social-creative-standard.mjs';

// Daily creatives must be newly generated. Stock/evergreen recycle is not allowed in production.
export const SOCIAL_IMAGE_PROVIDER = (process.env.SOCIAL_IMAGE_PROVIDER || 'bedrock').toLowerCase();

function evaluateCreativeGate(concept, photo = {}) {
  const actualScene = photo.scene || concept.visualConcept || concept.photoPrompt;
  const payload = {
    mode: concept.mode,
    sport: concept.sport,
    stage: concept.stage,
    stockPhotoId: photo.stockPhotoId || concept.stockPhotoId,
    scene: actualScene,
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
    maxAttempts: 6
  });
  if (result?.ok) {
    return { ...result, provider: 'bedrock' };
  }
  return { ok: false, error: result?.error || 'bedrock_generation_failed', provider: 'bedrock' };
}

async function generatePhotoBuffer(concept, { sharpImpl } = {}) {
  if (SOCIAL_IMAGE_PROVIDER === 'procedural') {
    return { ok: false, error: 'procedural_disabled_for_social_quality', provider: 'procedural' };
  }

  // Diagnostic-only stock path (not daily production).
  if (SOCIAL_IMAGE_PROVIDER === 'stock') {
    const { generateStockPhoto } = await import('./social-image-stock.mjs');
    const stock = await generateStockPhoto(concept, {
      isoDate: concept.contentId,
      activity: concept.semanticActivity,
      sharpImpl,
      maxAttempts: 8
    });
    if (stock?.ok) {
      const fit = evaluateCreativeGate(concept, stock);
      if (fit.ok) return { ...stock, provider: 'stock' };
      return { ok: false, error: fit.reason, provider: 'stock' };
    }
    return { ok: false, error: stock?.error || 'stock_generation_failed', provider: 'stock' };
  }

  // Production default: new Bedrock photograph every day.
  const bedrock = await tryBedrock(concept, { sharpImpl });
  if (bedrock.ok) {
    const fit = evaluateCreativeGate(concept, {
      scene: concept.visualConcept || concept.photoPrompt
    });
    if (fit.ok) return bedrock;
    logSocialImageEvent('SocialImageRejected', {
      mode: concept.mode,
      contentId: concept.contentId,
      reason: fit.reason,
      provider: 'bedrock',
      score: fit.score || null
    });
    return { ok: false, error: fit.reason, provider: 'bedrock' };
  }

  // Fail closed — do not recycle yesterday's image.
  return {
    ok: false,
    error: bedrock.error || 'bedrock_generation_failed',
    provider: 'bedrock'
  };
}

export async function generateSocialImage({
  catalogItem,
  isoDate,
  isoHyphen,
  recentImageEntries = [],
  dryRun = false,
  outDir = null,
  sharpImpl = null,
  conceptOverrides = null
} = {}) {
  const started = Date.now();
  const concept = buildImageConcept(catalogItem, {
    isoDate,
    recentEntries: recentImageEntries,
    overrides: conceptOverrides || {}
  });

  logSocialImageEvent('SocialImageGenerationStarted', {
    mode: concept.mode,
    contentId: concept.contentId,
    provider: SOCIAL_IMAGE_PROVIDER,
    headline: concept.imageHeadline,
    semanticActivity: concept.semanticActivity,
    sport: concept.sport
  });

  const photo = await generatePhotoBuffer(concept, {
    isoDate,
    activity: concept.semanticActivity || catalogItem?.activity,
    recentEntries: recentImageEntries,
    sharpImpl
  });

  if (!photo?.ok || !photo.buffer?.length) {
    const reason = photo?.error || 'photo_required';
    logSocialImageEvent('SocialImageGenerationFailed', {
      mode: concept.mode,
      contentId: concept.contentId,
      reason,
      provider: photo?.provider || SOCIAL_IMAGE_PROVIDER
    });
    return {
      ok: false,
      concept,
      provider: photo?.provider || SOCIAL_IMAGE_PROVIDER,
      fallback: false,
      error: `photo_required:${reason}`,
      durationMs: Date.now() - started
    };
  }

  if (photo.prompt) {
    concept.visualConcept = concept.visualConcept || concept.photoPrompt;
  }

  const composed = await composeSocialImageFromPhoto(photo.buffer, concept, { sharpImpl });
  const uniqueId = `${concept.contentId}-${isoDate}-${crypto.randomBytes(3).toString('hex')}`;
  const key = buildSocialImageKey({ isoHyphen, uniqueId });
  const saved = await saveLocalSocialImage({
    buffer: composed.buffer,
    outDir,
    fileName: `${uniqueId}.jpg`
  });

  const provider = photo.modelId || photo.provider || 'bedrock';

  if (dryRun) {
    logSocialImageEvent('SocialImageGenerationSucceeded', {
      mode: concept.mode,
      contentId: concept.contentId,
      provider,
      fallback: false,
      evergreen: false,
      photoBytes: photo.buffer.length,
      seed: photo.seed || null,
      stockPhotoId: null,
      semanticActivity: concept.semanticActivity,
      primaryFailure: null
    });
    return {
      ok: true,
      concept,
      imageUrl: null,
      localPath: saved.localPath,
      imageKey: key,
      provider,
      fallback: false,
      width: composed.width,
      height: composed.height,
      imageBuffer: composed.buffer,
      durationMs: Date.now() - started
    };
  }

  const uploaded = await uploadAndVerifySocialImageBuffer({ buffer: composed.buffer, key });
  if (!uploaded.ok) {
    return {
      ok: false,
      concept,
      localPath: saved.localPath,
      imageKey: key,
      provider,
      fallback: false,
      uploadError: uploaded.error,
      durationMs: Date.now() - started
    };
  }

  logSocialImageEvent('SocialImageUploaded', { key, provider, fallback: false });
  logSocialImageEvent('SocialImageGenerationSucceeded', {
    mode: concept.mode,
    contentId: concept.contentId,
    provider,
    fallback: false,
    evergreen: false,
    photoBytes: photo.buffer.length,
    seed: photo.seed || null,
    stockPhotoId: null,
    semanticActivity: concept.semanticActivity,
    primaryFailure: null
  });

  return {
    ok: true,
    concept,
    imageUrl: uploaded.url,
    imageKey: key,
    bucket: uploaded.bucket,
    provider,
    fallback: false,
    width: composed.width,
    height: composed.height,
    imageBuffer: composed.buffer,
    mediaCheck: uploaded.mediaCheck,
    durationMs: Date.now() - started
  };
}
