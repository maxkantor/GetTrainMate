/**
 * Bedrock Stable Image Core (ACTIVE) — text-to-image in us-west-2.
 * Fallback order: bedrock → procedural gradient (last resort only).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const STABLE_IMAGE_CORE_MODEL_ID =
  process.env.SOCIAL_IMAGE_BEDROCK_MODEL_ID || 'stability.stable-image-core-v1:1';

export const BEDROCK_IMAGE_REGION =
  process.env.SOCIAL_IMAGE_BEDROCK_REGION || 'us-west-2';

export const DEFAULT_NEGATIVE_PROMPT = [
  'minors',
  'teenagers',
  'children',
  'nudity',
  'explicit sexual activity',
  'distorted anatomy',
  'malformed hands',
  'extra fingers',
  'extra arms',
  'duplicated people',
  'distorted faces',
  'plastic skin',
  'cartoon',
  'illustration',
  'anime',
  'fake text',
  'watermark',
  'random logo',
  'stock photo handshake pose',
  'empty gradient background',
  'text card design',
  'corporate clipart',
  'blurry faces',
  'deformed limbs',
  'uncanny valley'
].join(', ');

export function buildPhotographyPrompt(concept) {
  const activity =
    concept.photoPrompt ||
    concept.visualConcept ||
    'training together in a premium modern gym with natural chemistry';
  return (
    'Premium photorealistic commercial lifestyle photography of an athletic adult woman and an athletic adult man ' +
    `${activity}. ` +
    'Both are clearly adults approximately 25–45 years old with natural athletic physiques and stylish modern premium fitness clothing. ' +
    'Natural chemistry between them, confident expressions, playful authentic interaction, realistic skin texture, realistic anatomy, ' +
    'professional sports photography, cinematic lighting, dynamic composition, shallow depth of field, sophisticated modern environment, ' +
    'aspirational fitness lifestyle campaign, high-end social app advertising photography. ' +
    'People occupy most of the frame as the hero subjects. Leave natural negative space at the bottom for a short advertising headline overlay. ' +
    'No text, no logo, no watermark.'
  );
}

function writeTempJson(obj) {
  const file = path.join(
    os.tmpdir(),
    `gtm-stable-${Date.now()}-${Math.random().toString(16).slice(2)}.json`
  );
  fs.writeFileSync(file, JSON.stringify(obj));
  return file;
}

/**
 * Invoke Stable Image Core via AWS CLI (matches growth script conventions).
 */
export function invokeStableImageCore({
  prompt,
  negativePrompt = DEFAULT_NEGATIVE_PROMPT,
  aspectRatio = '4:5',
  seed = 0,
  outputFormat = 'jpeg',
  region = BEDROCK_IMAGE_REGION,
  modelId = STABLE_IMAGE_CORE_MODEL_ID
} = {}) {
  const body = {
    prompt,
    negative_prompt: negativePrompt,
    aspect_ratio: aspectRatio,
    seed,
    output_format: outputFormat
  };

  const reqFile = writeTempJson(body);
  const outFile = path.join(os.tmpdir(), `gtm-stable-out-${Date.now()}.json`);
  try {
    const r = spawnSync(
      'aws',
      [
        'bedrock-runtime',
        'invoke-model',
        '--model-id',
        modelId,
        '--content-type',
        'application/json',
        '--accept',
        'application/json',
        '--body',
        `fileb://${reqFile}`,
        '--cli-binary-format',
        'raw-in-base64-out',
        outFile,
        '--region',
        region
      ],
      { encoding: 'utf8', stdio: 'pipe', maxBuffer: 20 * 1024 * 1024 }
    );
    if (r.status !== 0) {
      return {
        ok: false,
        error: (r.stderr || r.stdout || 'bedrock invoke failed').slice(0, 500),
        modelId
      };
    }
    const parsed = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    if (parsed.error) {
      return { ok: false, error: String(parsed.error), modelId };
    }
    const finishReason = parsed.finish_reasons?.[0];
    if (finishReason && finishReason !== 'SUCCESS') {
      return { ok: false, error: `stable_image_${finishReason.toLowerCase()}`, modelId };
    }
    const b64 = parsed.images?.[0];
    if (!b64) {
      return { ok: false, error: 'stable_image_no_images', modelId };
    }
    const buffer = Buffer.from(b64, 'base64');
    return {
      ok: true,
      buffer,
      modelId,
      seed: parsed.seeds?.[0] ?? seed,
      aspectRatio
    };
  } finally {
    for (const f of [reqFile, outFile]) {
      try {
        fs.unlinkSync(f);
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Basic quality gate — rejects flat/empty or tiny outputs before overlay.
 */
export async function assessPhotoQuality(buffer, sharpImpl) {
  const sharp = sharpImpl || (await import('sharp')).default;
  if (!buffer || buffer.length < 40_000) {
    return { ok: false, reason: 'file_too_small', bytes: buffer?.length || 0 };
  }
  const img = sharp(buffer);
  const meta = await img.metadata();
  if (!meta.width || !meta.height || meta.width < 512 || meta.height < 512) {
    return { ok: false, reason: 'resolution_too_low', meta };
  }
  const stats = await img.stats();
  const channels = stats.channels || [];
  const avgStdev =
    channels.reduce((sum, c) => sum + (c.stdev || 0), 0) / Math.max(channels.length, 1);
  // Flat gradients / empty cards have very low channel variance
  if (avgStdev < 18) {
    return { ok: false, reason: 'flat_or_empty_background', avgStdev };
  }
  return { ok: true, bytes: buffer.length, avgStdev, meta };
}

export async function generateBedrockPhoto(concept, { seed, sharpImpl, maxAttempts = 2 } = {}) {
  const baseSeed = seed ?? concept.backgroundSeed ?? 42;
  let lastError = 'unknown';
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const attemptSeed = baseSeed + attempt * 7919;
    const prompt = buildPhotographyPrompt(concept);
    const invoked = invokeStableImageCore({
      prompt,
      seed: attemptSeed % 4_294_967_295,
      aspectRatio: '4:5',
      outputFormat: 'jpeg'
    });
    if (!invoked.ok) {
      lastError = invoked.error;
      continue;
    }
    const quality = await assessPhotoQuality(invoked.buffer, sharpImpl);
    if (!quality.ok) {
      lastError = quality.reason;
      continue;
    }
    return {
      ok: true,
      buffer: invoked.buffer,
      modelId: invoked.modelId,
      seed: attemptSeed,
      prompt,
      quality
    };
  }
  return { ok: false, error: lastError };
}
