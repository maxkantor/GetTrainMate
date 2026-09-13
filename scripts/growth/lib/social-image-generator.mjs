/**
 * GetTrainMate social image generator.
 * Quality rule: publish only a real lifestyle photo that matches the semantic activity.
 * A missing photo is a failed creative, not permission to publish a generic fallback card.
 */
import crypto from 'node:crypto';
import { buildImageConcept } from './social-image-concept.mjs';
import { generateStockPhoto } from './social-image-stock.mjs';
import { composeSocialImageFromPhoto } from './social-image-photo-compose.mjs';
import { logSocialImageEvent } from './social-image-logger.mjs';
import { buildSocialImageKey, saveLocalSocialImage, uploadAndVerifySocialImageBuffer } from './social-image-storage.mjs';

export const SOCIAL_IMAGE_PROVIDER = (process.env.SOCIAL_IMAGE_PROVIDER || 'stock').toLowerCase();

async function generatePhotoBuffer(concept, { isoDate, activity, recentEntries, sharpImpl } = {}) {
  if (SOCIAL_IMAGE_PROVIDER === 'bedrock') {
    const { generateBedrockPhoto } = await import('./social-image-bedrock.mjs');
    return generateBedrockPhoto(concept, { seed: concept.backgroundSeed, sharpImpl, maxAttempts: 3 });
  }
  if (SOCIAL_IMAGE_PROVIDER === 'procedural') {
    return { ok: false, reason: 'procedural_disabled_for_social_quality' };
  }
  return generateStockPhoto(concept, { isoDate, activity, recentEntries, sharpImpl, maxAttempts: 8 });
}

export async function generateSocialImage({ catalogItem, isoDate, isoHyphen, recentImageEntries = [], dryRun = false, outDir = null, sharpImpl = null, conceptOverrides = null } = {}) {
  const started = Date.now();
  const concept = buildImageConcept(catalogItem, { isoDate, recentEntries: recentImageEntries, overrides: conceptOverrides || {} });

  logSocialImageEvent('SocialImageGenerationStarted', { mode: concept.mode, contentId: concept.contentId, provider: SOCIAL_IMAGE_PROVIDER, headline: concept.imageHeadline, semanticActivity: concept.semanticActivity });

  const photo = await generatePhotoBuffer(concept, { isoDate, activity: concept.semanticActivity || catalogItem?.activity, recentEntries: recentImageEntries, sharpImpl });
  if (!photo.ok || !photo.buffer?.length) {
    const reason = photo.error || photo.reason || 'photo_generation_failed';
    logSocialImageEvent('SocialImageRejected', { mode: concept.mode, contentId: concept.contentId, reason, semanticActivity: concept.semanticActivity });
    return { ok: false, concept, provider: SOCIAL_IMAGE_PROVIDER, fallback: false, error: `photo_required:${reason}`, durationMs: Date.now() - started };
  }

  if (photo.stockPhotoId) {
    concept.stockPhotoId = photo.stockPhotoId;
    concept.visualConcept = photo.scene || concept.visualConcept;
  }

  const composed = await composeSocialImageFromPhoto(photo.buffer, concept, { sharpImpl });
  const provider = photo.modelId || 'unsplash_stock';
  logSocialImageEvent('SocialImageGenerationSucceeded', { mode: concept.mode, contentId: concept.contentId, provider, fallback: false, photoBytes: photo.buffer.length, seed: photo.seed, stockPhotoId: photo.stockPhotoId || null, semanticActivity: concept.semanticActivity });

  const uniqueId = `${concept.contentId}-${isoDate || 'sample'}-${crypto.randomBytes(3).toString('hex')}`;
  const key = buildSocialImageKey({ isoHyphen, uniqueId });

  if (dryRun) {
    const saved = saveLocalSocialImage({ buffer: composed.buffer, isoHyphen, uniqueId, outDir });
    return { ok: true, concept, imageUrl: null, localPath: saved.localPath, imageKey: key, provider, fallback: false, width: composed.width, height: composed.height, imageBuffer: composed.buffer, durationMs: Date.now() - started };
  }

  const uploaded = await uploadAndVerifySocialImageBuffer({ buffer: composed.buffer, key });
  if (!uploaded.ok) {
    const saved = saveLocalSocialImage({ buffer: composed.buffer, isoHyphen, uniqueId, outDir });
    logSocialImageEvent('SocialImageGenerationFailed', { mode: concept.mode, uploadError: uploaded.error, localPath: saved.localPath });
    return { ok: false, concept, localPath: saved.localPath, imageKey: key, provider, fallback: false, uploadError: uploaded.error, durationMs: Date.now() - started };
  }

  logSocialImageEvent('SocialImageUploaded', { key, provider, fallback: false });
  return { ok: true, concept, imageUrl: uploaded.url, imageKey: key, bucket: uploaded.bucket, provider, fallback: false, width: composed.width, height: composed.height, imageBuffer: composed.buffer, mediaCheck: uploaded.mediaCheck, durationMs: Date.now() - started };
}
