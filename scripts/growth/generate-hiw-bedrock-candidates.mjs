#!/usr/bin/env node
/**
 * ONE-TIME How It Works Bedrock curation (NOT the daily FB/IG automation).
 *
 * Generates RAW 4:5 photos for homepage product mockups — no brand overlay,
 * no publish, no owned-social log. MEET / Saturday Run is intentionally omitted
 * (keep /images/hero-train-together.png).
 *
 *   node scripts/growth/generate-hiw-bedrock-candidates.mjs
 *   node scripts/growth/generate-hiw-bedrock-candidates.mjs --only=discover-run
 *
 * Outputs:
 *   docs/growth/owned-social/generated/hiw-bedrock-candidates-YYYY-MM-DD/
 *
 * After you pick winners, copy/optimize into apps/web/public/images/hiw/ as
 * stable static assets. Do NOT call Bedrock from the homepage.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureGrowthDeps } from './lib/ensure-growth-deps.mjs';
import {
  DEFAULT_NEGATIVE_PROMPT,
  invokeStableImageCore,
  assessPhotoQuality
} from './lib/social-image-bedrock.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

/** Locked cast — gender difference must be unmistakable for Stable Image Core. */
const CAST = {
  woman:
    'ONE adult FEMALE athlete only on the left side of frame: woman approximately 28, ' +
    'feminine face, warm smile, clearly visible, dark brown hair in a high ponytail, ' +
    'light olive skin, fit runner physique, heather-grey running tank, black running shorts',
  man:
    'ONE adult MALE athlete only on the right side of frame: man approximately 30, ' +
    'masculine face with short dark curly hair, light beard/stubble, broader shoulders, ' +
    'clearly male presentation, navy blue athletic t-shirt, dark running shorts, ' +
    'friendly expression, clearly visible face'
};

/**
 * HIW needs solo Discover — strip daily-automation anti-solo rules and add HIW-specific bans.
 */
const HIW_NEGATIVE = [
  DEFAULT_NEGATIVE_PROMPT.replace(', lonely isolated person', ''),
  'second person',
  'two people',
  'group of people',
  'crowd',
  'personal trainer instructing',
  'clipboard',
  'physical therapy',
  'massage',
  'patient on floor',
  'spotting from above',
  'matching team uniforms',
  'logo',
  'watermark',
  'text',
  'UI overlay',
  'phone screen UI',
  'app interface'
].join(', ');

const HIW_NEGATIVE_PAIR = [
  DEFAULT_NEGATIVE_PROMPT,
  'two women',
  'two females',
  'lesbian couple',
  'identical twins',
  'same gender pair',
  'both female',
  'two men',
  'both male',
  'androgynous pair',
  'lookalike sisters',
  'three people',
  'four people',
  'crowd',
  'personal trainer instructing',
  'clipboard',
  'physical therapy',
  'kissing',
  'sexual posing',
  'matching identical outfits',
  'logo',
  'watermark',
  'text',
  'UI overlay'
].join(', ');

const MIXED_PAIR_LOCK =
  'CRITICAL CAST: exactly one woman and exactly one man. ' +
  'Heterogeneous mixed-gender pair. Faces must look like different people of different sexes. ' +
  'Never generate two women. Never generate two men. Never generate twins or lookalikes. ';

/**
 * Draft pack — pick 1 Discover + 1 Match after visual QA.
 * Seeds are fixed so re-runs are reproducible until you bump them.
 */
export const HIW_BEDROCK_DRAFTS = [
  {
    id: 'discover-run',
    stage: 'DISCOVER',
    aspectRatio: '4:5',
    seed: 28012801,
    negativePrompt: HIW_NEGATIVE,
    prompt:
      'Premium photorealistic editorial lifestyle photography for a dating-and-fitness app profile card. ' +
      `Exactly ONE person only: ${CAST.woman.replace('on the left side of frame: ', '')}. ` +
      'She is outdoors after an easy morning run in a leafy city park at golden hour. ' +
      'Portrait-friendly composition: she occupies 55–70% of the frame, face large and sharp, eyes toward camera with a soft genuine smile. ' +
      'Context reads as “someone I want to train with,” not a coach demo — no instructing pose, no floor exercise over another person. ' +
      'Shallow depth of field, natural sweat sheen, premium consumer photography, clean soft bokeh background. ' +
      'No text, no logo, no watermark, no second person.'
  },
  {
    id: 'discover-gym',
    stage: 'DISCOVER',
    aspectRatio: '4:5',
    seed: 28012802,
    negativePrompt: HIW_NEGATIVE,
    prompt:
      'Premium photorealistic editorial fitness photography for a member profile card. ' +
      `Exactly ONE person only: ${CAST.woman.replace('on the left side of frame: ', '')}. ` +
      'Modern bright gym, she stands near cable machines between sets, towel over one shoulder, relaxed confident smile at camera. ' +
      'Face clearly visible and large in frame; subject fills most of the vertical card. ' +
      'Peer athlete vibe — not personal trainer, not physiotherapy, not demonstrating on a client. ' +
      'Natural skin texture, realistic lighting, shallow depth of field. ' +
      'No text, no logo, no watermark, no second person.'
  },
  {
    id: 'discover-pickleball',
    stage: 'DISCOVER',
    aspectRatio: '4:5',
    seed: 28012803,
    negativePrompt: HIW_NEGATIVE,
    prompt:
      'Premium photorealistic sports lifestyle portrait for an app profile. ' +
      `Exactly ONE person only: ${CAST.woman.replace('on the left side of frame: ', '')}. ` +
      'Outdoor pickleball / tennis court, she holds a paddle casually at her side, approachable smile, face sharp and prominent. ' +
      'Portrait crop suitable for a swipe card; athletic lifestyle, sunny daylight. ' +
      'Not a coaching clinic, not a group lesson. ' +
      'No text, no logo, no watermark, no second person.'
  },
  {
    id: 'match-v2-park',
    stage: 'MATCH',
    aspectRatio: '4:5',
    seed: 94110001,
    negativePrompt: HIW_NEGATIVE_PAIR,
    prompt:
      'Premium photorealistic editorial lifestyle photography. ' +
      MIXED_PAIR_LOCK +
      `Left: ${CAST.woman}. Right: ${CAST.man}. ` +
      'They stand on a leafy city park path after agreeing to train together, laughing and talking with friendly eye contact. ' +
      'Both faces large and sharp; equal visual weight; soft golden-hour light; athletic athleisure. ' +
      'Leave a little clean space between their heads for a small UI score overlay. ' +
      'No kissing, no embrace, no text, no logo, no third person.'
  },
  {
    id: 'match-v2-run',
    stage: 'MATCH',
    aspectRatio: '4:5',
    seed: 94110002,
    negativePrompt: HIW_NEGATIVE_PAIR,
    prompt:
      'Premium photorealistic sports photography of mixed-gender running partners. ' +
      MIXED_PAIR_LOCK +
      `Woman on left: ${CAST.woman}. Man on right: ${CAST.man}. ` +
      'Easy side-by-side jog on a scenic park path at golden hour, glancing at each other with genuine smiles. ' +
      'Different clothing colors (grey tank vs navy tee). Both faces clearly male/female and visible. ' +
      'Composition works behind a 94 percent match UI overlay. ' +
      'No text, no logo, no third person, no two women.'
  },
  {
    id: 'match-v2-highfive',
    stage: 'MATCH',
    aspectRatio: '4:5',
    seed: 94110003,
    negativePrompt: HIW_NEGATIVE_PAIR,
    prompt:
      'Premium photorealistic fitness lifestyle photography. ' +
      MIXED_PAIR_LOCK +
      `Woman: ${CAST.woman}. Man: ${CAST.man}. ` +
      'Outdoor park after a workout, they share a casual high-five or fist bump, laughing, faces clear and close enough for circular avatar crops. ' +
      'Peer athletes, not coach and client. Natural daylight. ' +
      'No kissing, no romance cliché pose, no text, no logo, no two women, no third person.'
  },
  {
    id: 'match-v2-trail',
    stage: 'MATCH',
    aspectRatio: '4:5',
    seed: 94110004,
    negativePrompt: HIW_NEGATIVE_PAIR,
    prompt:
      'Premium photorealistic outdoor training photography. ' +
      MIXED_PAIR_LOCK +
      'A heterosexual mixed pair of adult workout partners: one woman with a ponytail in a grey tank, ' +
      'and one man with short curly hair and stubble in a navy tee, standing on a trail catching their breath. ' +
      'Clear masculine and feminine facial features, both looking toward camera with approachable smiles. ' +
      'Equal framing for a match-screen background. ' +
      'No two women, no twins, no text, no logo.'
  },
  {
    id: 'match-v2-trail-b',
    stage: 'MATCH',
    aspectRatio: '4:5',
    seed: 94110014,
    negativePrompt: HIW_NEGATIVE_PAIR,
    prompt:
      'Premium photorealistic close portrait of exactly two adult workout partners outdoors. ' +
      MIXED_PAIR_LOCK +
      'Foreground: athletic woman ~28 with brown ponytail, grey tank, warm approachable smile. ' +
      'Slightly behind/right: athletic man ~30 with short brown hair, light stubble, navy or grey athletic tank, friendly expression. ' +
      'Park foliage bokeh background. Both faces large and sharp for circular avatar crops. Soft natural daylight. ' +
      'Exactly one woman and one man. No third person. No text. No logo.'
  },
  {
    id: 'match-v2-trail-c',
    stage: 'MATCH',
    aspectRatio: '4:5',
    seed: 94110024,
    negativePrompt: HIW_NEGATIVE_PAIR,
    prompt:
      'Photorealistic editorial photo, vertical 4:5, of a man and a woman who just matched as running partners. ' +
      'Woman left: feminine face, ponytail, heather grey tank. Man right: masculine face, short hair, beard stubble, navy tee. ' +
      'Standing close on a park trail, smiling gently at camera, faces filling the upper half of frame. ' +
      'Must be one adult male and one adult female — different sexes clearly visible. Soft golden hour. No text, no logo, no twins, no two women.'
  }
];

function parseOnly() {
  const arg = process.argv.find((a) => a.startsWith('--only='));
  if (!arg) return null;
  return new Set(
    arg
      .slice('--only='.length)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

async function generateOne(draft, sharpImpl) {
  const invoked = invokeStableImageCore({
    prompt: draft.prompt,
    negativePrompt: draft.negativePrompt,
    aspectRatio: draft.aspectRatio,
    seed: draft.seed,
    outputFormat: 'jpeg'
  });
  if (!invoked.ok) {
    return { ...draft, ok: false, error: invoked.error };
  }
  const quality = await assessPhotoQuality(invoked.buffer, sharpImpl);
  if (!quality.ok) {
    return { ...draft, ok: false, error: quality.reason, quality };
  }
  return {
    ...draft,
    ok: true,
    buffer: invoked.buffer,
    modelId: invoked.modelId,
    quality
  };
}

async function main() {
  const deps = await ensureGrowthDeps();
  if (!deps.ok) {
    console.error(JSON.stringify({ ok: false, error: deps.error }));
    process.exit(2);
  }

  const only = parseOnly();
  const drafts = only
    ? HIW_BEDROCK_DRAFTS.filter((d) => only.has(d.id))
    : HIW_BEDROCK_DRAFTS;

  if (!drafts.length) {
    console.error(JSON.stringify({ ok: false, error: 'no drafts matched --only' }));
    process.exit(2);
  }

  const day = new Date().toISOString().slice(0, 10);
  const outDir = path.join(
    ROOT,
    'docs/growth/owned-social/generated',
    `hiw-bedrock-candidates-${day}`
  );
  fs.mkdirSync(outDir, { recursive: true });

  const sharpImpl = (await import('sharp')).default;
  const results = [];

  for (const draft of drafts) {
    process.stderr.write(`Generating ${draft.id} (${draft.stage})…\n`);
    const result = await generateOne(draft, sharpImpl);
    if (!result.ok) {
      results.push({
        id: draft.id,
        stage: draft.stage,
        ok: false,
        error: result.error,
        seed: draft.seed
      });
      continue;
    }
    const filename = `${draft.stage.toLowerCase()}-${draft.id}.jpg`;
    const outPath = path.join(outDir, filename);
    fs.writeFileSync(outPath, result.buffer);
    results.push({
      id: draft.id,
      stage: draft.stage,
      ok: true,
      path: outPath,
      seed: draft.seed,
      modelId: result.modelId,
      bytes: result.buffer.length
    });
  }

  const manifest = {
    purpose: 'How It Works one-time Bedrock curation (raw photos, no overlays)',
    meet: 'KEEP existing /images/hero-train-together.png — not generated here',
    cast: CAST,
    generatedAtUtc: new Date().toISOString(),
    outDir,
    results
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
});
