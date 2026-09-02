/**
 * TRAIN / VIBE / DATE photography scene prompts for Nova Canvas.
 * Rotated for variety; people are always the hero.
 */
export const MODE_PHOTO_SCENES = {
  TRAIN: [
    'training together in a luxurious modern gym, smiling at each other between exercises with subtle flirtatious energy, premium sportswear, cinematic gym lighting',
    'attractive athletic running partners on an urban trail at golden hour, natural chemistry, fitted running apparel',
    'doing functional fitness together in a boutique gym, playful competitive energy, realistic post-workout glow',
    'mixed-gender pickleball partners on a premium court, laughing between points, stylish athletic outfits',
    'spotting each other during a bench press in a high-end gym, confident eye contact, authentic connection',
    'doing HIIT together in a modern fitness studio, energetic atmosphere, dynamic action composition',
    'stretching together after an intense workout, relaxed chemistry, premium gym environment',
    'outdoor conditioning together in a city park, athletic wear, candid interaction'
  ],
  VIBE: [
    'at a stylish rooftop bar at sunset, fit and attractive, casual premium athleisure, laughing together',
    'sporty adults at a beach boardwalk, confident and photogenic, natural social chemistry',
    'at an outdoor concert, attractive fit couple enjoying music, evening city energy',
    'coffee together after a workout, warm smiles, modern cafe, athletic casual style',
    'walking through a vibrant international city, stylish fit adults, candid connection',
    'at an outdoor festival, attractive athletic group, energetic social atmosphere'
  ],
  DATE: [
    'having coffee together in a chic cafe, stronger romantic chemistry, fit attractive adults, post-workout glow',
    'walking together after a workout through a city street, holding smoothies, warm connection',
    'rooftop date at dusk, athletic stylish couple, cinematic city backdrop',
    'beach sunset walk, attractive fit adults, natural romantic tension, tasteful and premium',
    'playful pickleball date on a premium court, flirty competitive energy',
    'post-workout smoothie date, laughing together, modern healthy lifestyle aesthetic'
  ]
};

export const MODE_HEADLINE_DEFAULTS = {
  TRAIN: 'Find Your Workout Partner',
  VIBE: 'Meet Someone New',
  DATE: 'Meet Through Real Chemistry'
};

export const MODE_CTA_DEFAULTS = {
  TRAIN: 'START MATCHING',
  VIBE: 'START MATCHING',
  DATE: 'START MATCHING'
};

function hashSeed(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pickFrom(list, seed) {
  if (!list?.length) return '';
  return list[seed % list.length];
}

export function normalizeConceptKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function isDuplicateConcept(concept, recentEntries = []) {
  const headline = normalizeConceptKey(concept.imageHeadline);
  const visual = normalizeConceptKey(concept.visualConcept || concept.photoPrompt);
  const cta = normalizeConceptKey(concept.cta);
  const seed = concept.backgroundSeed;
  for (const entry of recentEntries) {
    if (normalizeConceptKey(entry.imageHeadline) === headline) return 'headline';
    if (normalizeConceptKey(entry.visualConcept || entry.photoPrompt) === visual) return 'visualConcept';
    if (entry.imageSeed != null && seed != null && entry.imageSeed === seed) return 'seed';
    if (normalizeConceptKey(entry.cta) === cta && normalizeConceptKey(entry.visualConcept) === visual) {
      return 'cta_visual';
    }
  }
  return null;
}

/**
 * Build image concept with photography-first metadata.
 * Supports explicit overrides (preview / manual).
 */
export function buildImageConcept(catalogItem, { isoDate = '', recentEntries = [], overrides = {} } = {}) {
  const mode = String(overrides.mode || catalogItem?.mode || 'TRAIN').toUpperCase();
  const seedBase = `${isoDate}:${catalogItem?.contentId || 'preview'}:${mode}:${recentEntries.length}`;
  const seed = hashSeed(seedBase);
  const scenes = MODE_PHOTO_SCENES[mode] || MODE_PHOTO_SCENES.TRAIN;

  let attempt = 0;
  let concept = null;
  while (attempt < 12) {
    const attemptSeed = seed + attempt * 9973;
    concept = {
      mode,
      contentId: catalogItem?.contentId || 'preview',
      language: catalogItem?.language || 'en',
      imageHeadline:
        overrides.imageHeadline ||
        catalogItem?.imageHeadline ||
        MODE_HEADLINE_DEFAULTS[mode] ||
        'Find Your Match',
      cta: overrides.cta || catalogItem?.imageCta || MODE_CTA_DEFAULTS[mode] || 'START MATCHING',
      photoPrompt:
        overrides.photoPrompt ||
        overrides.visualConcept ||
        catalogItem?.visualConcept ||
        pickFrom(scenes, attemptSeed + 17),
      visualConcept:
        overrides.visualConcept ||
        catalogItem?.visualConcept ||
        pickFrom(scenes, attemptSeed + 17),
      destinationUrl: 'https://gettrainmate.com',
      backgroundSeed: attemptSeed
    };
    const dup = isDuplicateConcept(concept, recentEntries);
    if (!dup || overrides.imageHeadline || overrides.photoPrompt) break;
    attempt += 1;
  }
  return concept;
}

export function wrapHeadlineLines(text, { maxCharsPerLine = 22, maxLines = 2 } = {}) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
}

/** @deprecated use buildImageConcept */
export function deriveHeadlineCandidates() {
  return [];
}
