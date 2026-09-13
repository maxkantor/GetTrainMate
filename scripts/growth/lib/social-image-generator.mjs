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
import { buildSocialImageKey, saveLocalSocialImage, uploadAndVerifySocialImageBuffer } from './social-image-storage.mjs';

// Bedrock is intentionally the default. Set SOCIAL_IMAGE_PROVIDER=stock only for an explicit stock-only run.
export const SOCIAL_IMAGE_PROVIDER = (process.env.SOCIAL_IMAGE_PROVIDER || 'bedrock').toLowerCase();

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

async function generatePhotoBuffer(concept, { isoDate, activity, recentEntries, sharpImpl } = {}) {
  if (SOCIAL_IMAGE_PROVIDER === 'procedural') {
    return { ok: false, error: 'procedural_disabled_for_social_quality', provider: 'procedural' };
  }

  // Explicit stock-only mode remains available for diagnostics, but production defaults to Bedrock.
  if (SOCIAL_IMAGE_PROVIDER === 'stock') {
    return tryStock(concept, { isoDate, activity, recentEntries, sharpImpl });
  }

  // Production path: Bedrock first. Only if Bedrock fails every quality-gated attempt do we try curated stock.
  const bedrock = await tryBedrock(concept, { sharpImpl });
  if (bedrock.ok) return bedrock;

  logSocialImageEvent('SocialImagePrimaryProviderFailed', {
    mode: concept.mode,
    contentId: concept.contentId,
    provider: 'bedrock',
    reason: bedrock.error,
    fallbackProvider: 'stock'
  });

  const stock = await tryStock(concept, { isoDate, activity, recentEntries, sharpImpl });
  if (stock.ok) {
    return { ...stock, primaryFailure: bedrock.error };
  }

  return {
    ok: false,
    error: `bedrock:${bedrock.error}; stock:${stock.error}`,
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
    : (photo.modelId || 'unsplash_stock');

  logSocialImageEvent('SocialImageGenerationSucceeded', {
    mode: concept.mode,
    contentId: concept.contentId,
    provider,
    fallback: photo.provider === 'stock' && SOCIAL_IMAGE_PROVIDER !== 'stock',
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
      fallback: photo.provider === 'stock' && SOCIAL_IMAGE_PROVIDER !== 'stock',
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
      fallback: photo.provider === 'stock' && SOCIAL_IMAGE_PROVIDER !== 'stock',
      uploadError: uploaded.error,
      durationMs: Date.now() - started
    };
  }

  logSocialImageEvent('SocialImageUploaded', {
    key,
    provider,
    fallback: photo.provider === 'stock' && SOCIAL_IMAGE_PROVIDER !== 'stock'
  });

  return {
    ok: true,
    concept,
    imageUrl: uploaded.url,
    imageKey: key,
    bucket: uploaded.bucket,
    provider,
    fallback: photo.provider === 'stock' && SOCIAL_IMAGE_PROVIDER !== 'stock',
    width: composed.width,
    height: composed.height,
    imageBuffer: composed.buffer,
    mediaCheck: uploaded.mediaCheck,
    durationMs: Date.now() - started
  };
}
