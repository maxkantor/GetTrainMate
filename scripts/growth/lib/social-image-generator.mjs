/**
 * Social image generator — photography first (Bedrock Stable Image Core), procedural fallback only on failure.
 */
import crypto from 'node:crypto';
import { buildImageConcept } from './social-image-concept.mjs';
import { generateBedrockPhoto } from './social-image-bedrock.mjs';
import { composeSocialImageFromPhoto } from './social-image-photo-compose.mjs';
import { composeProceduralFallback } from './social-image-photo-compose.mjs';
import { logSocialImageEvent } from './social-image-logger.mjs';
import {
  buildSocialImageKey,
  saveLocalSocialImage,
  uploadSocialImageBuffer
} from './social-image-storage.mjs';

export const SOCIAL_IMAGE_PROVIDER = (process.env.SOCIAL_IMAGE_PROVIDER || 'bedrock').toLowerCase();

async function generatePhotoBuffer(concept, { sharpImpl } = {}) {
  if (SOCIAL_IMAGE_PROVIDER === 'procedural') {
    return { ok: false, reason: 'procedural_only_mode' };
  }
  return generateBedrockPhoto(concept, { seed: concept.backgroundSeed, sharpImpl, maxAttempts: 2 });
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
    headline: concept.imageHeadline
  });

  let provider = SOCIAL_IMAGE_PROVIDER;
  let fallback = false;
  let composed;

  const photo = await generatePhotoBuffer(concept, { sharpImpl });
  if (photo.ok) {
    composed = await composeSocialImageFromPhoto(photo.buffer, concept, { sharpImpl });
    provider = photo.modelId || 'stability.stable-image-core-v1:1';
    logSocialImageEvent('SocialImageGenerationSucceeded', {
      mode: concept.mode,
      contentId: concept.contentId,
      provider,
      fallback: false,
      photoBytes: photo.buffer.length,
      seed: photo.seed
    });
  } else {
    fallback = true;
    logSocialImageEvent('SocialImageGenerationFallbackUsed', {
      mode: concept.mode,
      contentId: concept.contentId,
      reason: photo.error || photo.reason,
      provider: SOCIAL_IMAGE_PROVIDER
    });
    composed = await composeProceduralFallback(concept, { sharpImpl });
    provider = 'procedural_fallback';
  }

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
      fallback,
      width: composed.width,
      height: composed.height,
      durationMs: Date.now() - started
    };
  }

  const uploaded = uploadSocialImageBuffer({ buffer: composed.buffer, key });
  if (!uploaded.ok) {
    const saved = saveLocalSocialImage({ buffer: composed.buffer, isoHyphen, uniqueId, outDir });
    logSocialImageEvent('SocialImageGenerationFailed', {
      mode: concept.mode,
      uploadError: uploaded.error,
      localPath: saved.localPath
    });
    return {
      ok: false,
      concept,
      localPath: saved.localPath,
      imageKey: key,
      provider,
      fallback,
      uploadError: uploaded.error,
      durationMs: Date.now() - started
    };
  }

  logSocialImageEvent('SocialImageUploaded', { key, provider, fallback });
  return {
    ok: true,
    concept,
    imageUrl: uploaded.url,
    imageKey: key,
    bucket: uploaded.bucket,
    provider,
    fallback,
    width: composed.width,
    height: composed.height,
    durationMs: Date.now() - started
  };
}
