/**
 * Bedrock Stable Image Core — GetTrainMate final creative direction.
 * Photography prompts must NEVER imply locomotives/railroads.
 * The brand word "TRAIN" (workout) confuses image models into drawing trains.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const STABLE_IMAGE_CORE_MODEL_ID =
  process.env.SOCIAL_IMAGE_BEDROCK_MODEL_ID || 'stability.sd3-5-large-v1:0';
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
  'cloned faces',
  'identical twins',
  'distorted faces',
  'plastic skin',
  'wax faces',
  'airbrushed skin',
  'porcelain skin',
  'oversmooth skin',
  'doll-like faces',
  'cartoon',
  'illustration',
  'anime',
  'digital painting',
  'concept art',
  'AI art',
  'Midjourney look',
  'Stable Diffusion aesthetic',
  'fake text',
  'gibberish text on clothing',
  'warped logos on shirts',
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
  'posing for camera',
  'fashion magazine pose',
  'excessive HDR',
  'fake cinematic glow',
  'neon rim light',
  'overprocessed color grade',
  'hyper-muscular AI bodies',
  'bodybuilder physique',
  'vascular arms',
  'steroid look',
  'three people',
  'group of three',
  'three adults crouching',
  'trio posing',
  'crowd behind heroes',
  'smartphone in hand',
  'looking at phone',
  'phone screen',
  'scrolling phone',
  'shirtless men',
  'bare chest bodybuilder',
  'two men only',
  'all-male cast',
  'two women only',
  'all-female cast',
  'sterile gym',
  'plain concrete wall backdrop',
  'studio backdrop',
  'grey seamless background',
  'crouching lineup pose',
  'squad squat pose',
  'obvious AI advertising composition',
  'CGI people',
  '3D render look',
  'octane render',
  'unreal engine',
  'exaggerated kissing',
  'sexual posing',
  'staged romantic embrace',
  'dramatic staring into eyes',
  'rock climbing',
  'indoor climbing wall',
  'bouldering',
  // Sep 17 regression: brand word TRAIN → literal trains/railroads
  'railroad tracks',
  'railway tracks',
  'train tracks',
  'locomotive',
  'freight train',
  'passenger train',
  'train cars',
  'subway train',
  'people running on train tracks',
  'people jogging on railroad ballast',
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

/**
 * Strip brand wording that makes Stable Image render locomotives/railroads.
 * Keep the sport scene; never say "TRAIN" as a brand mode token in photo prompts.
 */
export function sanitizePhotographyScene(raw = '') {
  return String(raw || '')
    .replace(/\bGetTrainMate\b/gi, 'fitness social app')
    .replace(/\bTRAIN\s*→\s*VIBE\s*→\s*DATE\b/gi, 'workout then social connection')
    .replace(/\bTRAIN TOGETHER\b/gi, 'work out together')
    .replace(/\btrain_to_vibe\b/gi, 'after workout social moment')
    .replace(/\bvibe_to_date\b/gi, 'subtle chemistry after activity')
    .replace(/\brailroad\b/gi, 'outdoor path')
    .replace(/\brailway\b/gi, 'outdoor path')
    .replace(/\btrain tracks?\b/gi, 'park path')
    .replace(/\blocomotive\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const BRAND_CORE =
  'Fitness social app creative: people meet through a shared workout or sport, then connect naturally. ' +
  'Always show a mixed pair: one young attractive woman and one young attractive man (mid-20s to early 30s) with normal athletic builds (not bodybuilders) who look like real humans in a real handheld camera photograph — ' +
  'natural skin texture with pores and slight imperfections, realistic sweat, individual non-matching clothing, candid unposed expressions. ' +
  'No phones in hands. No all-male groups. Subtle chemistry via eye contact, laughing, and conversation. ';

const CAMERA_LOCK =
  'Shot on a real DSLR or mirrorless camera with a 35mm or 50mm lens, natural depth of field, authentic documentary photography. ' +
  'Looks like a candid moment from a real sports photographer — not AI-generated, not CGI, not a 3D render, not stock-ad polish. ' +
  'Natural skin, visible pores, slight motion softness, believable daylight. ';

export function buildPhotographyPrompt(concept) {
  const mode = String(concept?.mode || 'TRAIN').toUpperCase();
  const sport = String(concept?.sport || concept?.semanticActivity || '').replace(/_/g, ' ').trim();
  const activity = sanitizePhotographyScene(
    concept?.photoPrompt ||
      concept?.visualConcept ||
      (mode === 'VIBE'
        ? 'a young attractive woman and a young attractive man hanging out after a shared workout, candid laughs'
        : mode === 'DATE'
          ? 'a young attractive woman and a young attractive man after a workout with subtle chemistry, walking and talking'
          : 'a young attractive woman and a young attractive man working out together with natural partnership and realistic sweat')
  );

  const sportLock = sport
    ? `The sport must clearly be ${sport} with unmistakable equipment and setting for ${sport}. `
    : '';

  const pairLock =
    'Hero subjects are exactly two people: one woman and one man. Never two men. Never three people. ';

  // Keep forbidden subjects out of the positive prompt (models latch onto them).
  // Railroad/locomotive bans live only in DEFAULT_NEGATIVE_PROMPT.
  const realismLock =
    CAMERA_LOCK +
    'People look at each other, not at the camera. ' +
    'Setting must be a real sports venue only: court, gym, trail, park path, track, or field. ';

  if (mode === 'VIBE') {
    return (
      'Authentic documentary lifestyle photograph that could pass as a real iPhone or DSLR photo. ' +
      BRAND_CORE +
      pairLock +
      sportLock +
      `Scene: ${activity}. ` +
      'Prefer sport-to-social transitions: cooling down after a run, walking from a court, reaching a trail destination, or leaving a class. ' +
      'Genuine laughter, eye contact, and candid friendship — they look at each other, not the camera. ' +
      realismLock +
      'Natural daylight or realistic evening social lighting. Leave clean negative space at the bottom for a short headline. No text, no logo, no watermark.'
    );
  }

  if (mode === 'DATE') {
    return (
      'Authentic documentary lifestyle photograph that could pass as a real iPhone or DSLR photo. ' +
      BRAND_CORE +
      pairLock +
      sportLock +
      `Scene: ${activity}. ` +
      'Chemistry is subtle and believable — they came to work out or play, and there might be something there. ' +
      'Prefer an after-workout walk, cooldown, coffee stop, or conversation with sports clothing or equipment still visible. ' +
      realismLock +
      'Leave clean negative space at the bottom for a short headline. No text, no logo, no watermark.'
    );
  }

  return (
    'Authentic documentary sports photograph that could pass as a real iPhone or DSLR photo. ' +
    BRAND_CORE +
    pairLock +
    sportLock +
    `Scene: ${activity}. ` +
    'Partnership is the story: spotting, pacing, high-fives, talk between sets, playful competition. ' +
    'Realistic sweat, natural skin texture, individual non-matching athletic wear. ' +
    realismLock +
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
