/**
 * Bedrock Stable Image Core — GetTrainMate final creative direction.
 * TRAIN. CATCH A VIBE. MAYBE DATE.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const STABLE_IMAGE_CORE_MODEL_ID =
  process.env.SOCIAL_IMAGE_BEDROCK_MODEL_ID || 'stability.stable-image-core-v1:1';
export const BEDROCK_IMAGE_REGION = process.env.SOCIAL_IMAGE_BEDROCK_REGION || 'us-west-2';

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
  'wax faces',
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
  'uncanny valley',
  'lonely isolated person',
  'generic running silhouette',
  'three people running toward camera',
  'matching blue shirts',
  'perfectly synchronized movement',
  'identical smiles',
  'everybody looking at camera',
  'excessive HDR',
  'fake cinematic glow',
  'hyper-muscular AI bodies',
  'sterile gym',
  'obvious AI advertising composition',
  'exaggerated kissing',
  'sexual posing',
  'staged romantic embrace',
  'dramatic staring into eyes',
  'laptops',
  'computer screens',
  'office desks',
  'office meetings',
  'coworking space',
  'business meetings',
  'conference rooms',
  'people working on laptops',
  'people studying with textbooks',
  'corporate networking',
  'business suits'
].join(', ');

const BRAND_CORE =
  'GetTrainMate creative north star: TRAIN TOGETHER. SEE WHERE IT GOES. ' +
  'People meet through an activity first — train, play, run, hike, compete — then connect naturally. ' +
  'Attractive athletic adults who look natural and believable. ' +
  'Subtle chemistry via eye contact, laughing, conversation, and high-fives. ' +
  'Premium editorial sports/lifestyle photography with natural skin texture, realistic sweat, individual clothing, candid expressions. ';

export function buildPhotographyPrompt(concept) {
  const mode = String(concept?.mode || 'TRAIN').toUpperCase();
  const activity =
    concept?.photoPrompt ||
    concept?.visualConcept ||
    (mode === 'VIBE'
      ? 'attractive athletic adults hanging out after a shared workout, coffee or drinks, candid laughs'
      : mode === 'DATE'
        ? 'attractive athletic man and woman after training with subtle chemistry, coffee or walk, not cheesy romance'
        : 'attractive athletic man and woman training together with natural partnership and realistic sweat');

  if (mode === 'VIBE') {
    return (
      'Premium photorealistic editorial lifestyle photography. ' +
      BRAND_CORE +
      `Scene: ${activity}. ` +
      'Show 2–4 clearly identifiable attractive athletic adults as large hero subjects. ' +
      'Prefer sport-to-social transitions: cooling down after a run, walking from a court, reaching a trail destination, or leaving a class. ' +
      'Genuine laughter, eye contact, and candid friendship. ' +
      'Natural daylight or realistic evening social lighting. Leave clean negative space at the bottom for a short headline. No text, no logo, no watermark.'
    );
  }

  if (mode === 'DATE') {
    return (
      'Premium photorealistic editorial lifestyle photography. ' +
      BRAND_CORE +
      `Scene: ${activity}. ` +
      'Show one attractive adult man and one attractive adult woman as large hero subjects. ' +
      'Chemistry is subtle and believable — they came to work out or play, and there might be something there. ' +
      'Prefer an after-training walk, cooldown, coffee stop, or conversation with sports clothing or equipment still visible. ' +
      'Leave clean negative space at the bottom for a short headline. No text, no logo, no watermark.'
    );
  }

  return (
    'Premium photorealistic editorial sports photography. ' +
    BRAND_CORE +
    `Scene: ${activity}. ` +
    'Show exactly two or a small mixed group of attractive athletic adults training or playing together as large hero subjects. ' +
    'Rotate sports: pickleball, tennis, lifting, running, volleyball, hiking, cycling, functional fitness. ' +
    'Partnership is the story: spotting, pacing, high-fives, talk between sets, playful competition. ' +
    'Realistic sweat, natural skin, individual non-matching athletic wear. ' +
    'Leave clean negative space at the bottom for a short headline. No text, no logo, no watermark.'
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
      return { ok: false, error: (r.stderr || r.stdout || 'bedrock invoke failed').slice(0, 500), modelId };
    }
    const parsed = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    if (parsed.error) return { ok: false, error: String(parsed.error), modelId };
    const finishReason = parsed.finish_reasons?.[0];
    if (finishReason && finishReason !== 'SUCCESS') {
      return { ok: false, error: `stable_image_${finishReason.toLowerCase()}`, modelId };
    }
    const b64 = parsed.images?.[0];
    if (!b64) return { ok: false, error: 'stable_image_no_images', modelId };
    return {
      ok: true,
      buffer: Buffer.from(b64, 'base64'),
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

export async function assessPhotoQuality(buffer, sharpImpl) {
  const sharp = sharpImpl || (await import('sharp')).default;
  if (!buffer || buffer.length < 40000) {
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
  const avgMean =
    channels.reduce((sum, c) => sum + (c.mean || 0), 0) / Math.max(channels.length, 1);
  if (avgStdev < 18) return { ok: false, reason: 'flat_or_empty_background', avgStdev, avgMean };
  if (avgMean > 185) return { ok: false, reason: 'overexposed_washed_out', avgStdev, avgMean };
  if (avgMean < 28) return { ok: false, reason: 'underexposed', avgStdev, avgMean };
  return { ok: true, bytes: buffer.length, avgStdev, avgMean, meta };
}

export async function generateBedrockPhoto(concept, { seed, sharpImpl, maxAttempts = 2 } = {}) {
  const baseSeed = seed ?? concept.backgroundSeed ?? 42;
  let lastError = 'unknown';
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const attemptSeed = baseSeed + attempt * 7919;
    const prompt = buildPhotographyPrompt(concept);
    const invoked = invokeStableImageCore({
      prompt,
      seed: attemptSeed % 4294967295,
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
