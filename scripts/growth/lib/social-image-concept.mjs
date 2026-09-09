/**
 * TRAIN / VIBE / DATE scene labels for stock photo selection and overlay copy.
 * Headlines / CTAs come from locale-aware conversion copy (social-copy-variants).
 *
 * All scenes represent genuine lifestyle activities:
 * - TRAIN: gym partners, running together, pickleball, tennis, cycling, functional fitness, outdoor workouts.
 * - VIBE: friends at rooftop bar, social coffee meetup, patio restaurant dining, hiking group, festivals, city exploring.
 *   STRICTLY EXCLUDED FOR VIBE: laptops, office meetings, coworking, business meetings, conference rooms, people working/studying.
 * - DATE: attractive adult couple having drinks, coffee date, romantic walk, restaurant date, casual outdoor date, playful/flirty chemistry.
 */
import {
  ctaTextsFor,
  headlineTextsFor,
  selectCopyPackage
} from './social-copy-variants.mjs';

export const SCENES_BY_ACTIVITY = {
  TRAIN: {
    pickleball: 'pickleball partners playing an active doubles game on a vibrant blue court, dynamic athletic action',
    tennis: 'tennis players moving dynamically on an outdoor court, holding rackets and balls, energetic athletic lifestyle',
    running: 'athletic running partners running together outdoors along a scenic route at golden hour, authentic training chemistry',
    cycling: 'road cyclists in athletic gear riding road bikes together along coastal highway, natural active partnership',
    functional: 'functional fitness workout partners training together in a bright boutique gym, high energy',
    strength: 'athlete deadlifting heavy barbell in modern gym with chalk and weights',
    partner: 'training partners in modern gym reviewing workout goals together on a clipboard, motivating partnership',
    workout: 'two workout partners training together in a modern gym, smiling and encouraging each other'
  },
  VIBE: {
    hiking: 'friends hiking an alpine mountain trail with backpacks, admiring scenic mountain views together',
    coffee: 'friends socializing at the counter of a trendy modern coffee shop with espresso cups, genuine smiles, no laptops',
    drinks: 'friends clinking craft cocktails together in a moody evening bar, warm vibrant social nightlife',
    dining: 'friends enjoying dinner and drinks at a stylish outdoor patio restaurant, laughing together in lively conversation',
    festival: 'friends laughing and dancing together outdoors at golden hour music festival, energetic social atmosphere',
    outdoors: 'group of friends standing on a scenic hilltop at sunset with arms around each other, outdoor adventure',
    city: 'friends laughing and chatting casually while walking together down a lively city street on the weekend',
    social: 'five friends sitting shoulder to shoulder on a ledge overlooking beautiful coastal scenery, warm authentic friendship'
  },
  DATE: {
    coffee: 'attractive adults on a coffee date at a modern cafe, warm conversation, no laptops',
    drinks: 'couple clinking craft cocktails together on a romantic evening date in an atmospheric bar',
    walk: 'couple holding hands walking together outdoors, candid smiles, natural romantic energy',
    dinner: 'attractive adult couple on a romantic dinner date with drinks, intimate conversation',
    lifestyle: 'candid attractive adult couple outdoors sharing a joyful moment, energetic outdoor chemistry, clearly a romantic pair',
    chemistry: 'happy attractive couple laughing closely together with genuine playful romantic connection',
    romantic: 'candid attractive adult couple smiling closely outdoors with warm intimate chemistry'
  }
};

export const MODE_PHOTO_SCENES = {
  TRAIN: Object.values(SCENES_BY_ACTIVITY.TRAIN),
  VIBE: Object.values(SCENES_BY_ACTIVITY.VIBE),
  DATE: Object.values(SCENES_BY_ACTIVITY.DATE)
};

/** @deprecated Prefer headlineTextsFor(mode, language) — English-only fallback retained for imports. */
export const MODE_HEADLINE_VARIANTS = {
  TRAIN: headlineTextsFor('TRAIN', 'en'),
  VIBE: headlineTextsFor('VIBE', 'en'),
  DATE: headlineTextsFor('DATE', 'en')
};

export const MODE_HEADLINE_DEFAULTS = {
  TRAIN: MODE_HEADLINE_VARIANTS.TRAIN[0],
  VIBE: MODE_HEADLINE_VARIANTS.VIBE[0],
  DATE: MODE_HEADLINE_VARIANTS.DATE[0]
};

export const MODE_CTA_DEFAULTS = {
  TRAIN: ctaTextsFor('TRAIN', 'en')[0],
  VIBE: ctaTextsFor('VIBE', 'en')[0],
  DATE: ctaTextsFor('DATE', 'en')[0]
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

/**
 * Determine the specific activity and intent of the post based on post body, headlines, and mode.
 * Multi-lingual keyword matching for en, es, ru.
 */
export function determinePostActivity({ mode = 'TRAIN', copyPackage, catalogItem, overrides, text = '' } = {}) {
  const m = String(mode || overrides?.mode || catalogItem?.mode || copyPackage?.mode || 'TRAIN').toUpperCase();
  const corpus = [
    text,
    overrides?.activity,
    catalogItem?.activity,
    copyPackage?.copyVariant,
    copyPackage?.headlineVariant,
    copyPackage?.headline,
    overrides?.imageHeadline,
    copyPackage?.post?.hook,
    copyPackage?.post?.benefit,
    copyPackage?.post?.differentiator,
    copyPackage?.post?.ctaLine,
    catalogItem?.facebook,
    catalogItem?.instagram
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (m === 'TRAIN') {
    if (/pickleball|пиклбол/i.test(corpus)) return 'pickleball';
    if (/tennis|tenis|теннис/i.test(corpus)) return 'tennis';
    if (/cycling|cyclist|bike|ciclismo|bici|велосипед/i.test(corpus)) return 'cycling';
    if (/running|runner|jogging|race|correr|бег|пробежк|старт/i.test(corpus)) return 'running';
    if (/hyrox|crossfit|functional|hiit|conditioning/i.test(corpus)) return 'functional';
    if (/weights|deadlift|barbell|strength|fuerza|силов|тяжел/i.test(corpus)) return 'strength';
    if (/accountability|shows up|alone|motivation|partner|socio|compañero|solo|партнёр|в одиночку/i.test(corpus)) {
      return 'partner';
    }
    return 'workout';
  }

  if (m === 'VIBE') {
    if (/hike|hiking|trail|mountain|senderismo|montaña|поход|горы/i.test(corpus)) return 'hiking';
    if (/coffee|cafe|café|espresso|кофе|кафе/i.test(corpus)) return 'coffee';
    if (/rooftop|cocktail|cocktails|drinks|bar|nightlife|copas|terracitas|бар|коктейл|вечер/i.test(corpus)) return 'drinks';
    if (/restaurant|dinner|dining|food|brunch|restaurante|comida|ресторан|еда|бранч/i.test(corpus)) return 'dining';
    if (/concert|festival|live music|music|concierto|música|концерт|музык|фестивал/i.test(corpus)) return 'festival';
    if (/nature|outdoors|park|beach|parque|playa|природ|парк|пляж/i.test(corpus)) return 'outdoors';
    if (/city|spots|plans|weekend|activities|explore|ciudad|lugares|planes|actividades|город|мест|план|выходн/i.test(corpus)) return 'city';
    return 'social';
  }

  if (m === 'DATE') {
    // Prefer active/lifestyle when "active singles" / solteros activos appears (even alongside swiping copy).
    if (/active|activo|activos|activas|fitness|energy|adventure|lifestyle|estilo de vida|energía|активн|энерги|solteros activos|active singles/i.test(corpus)) {
      return 'lifestyle';
    }
    if (/coffee|cafe|café|кофе|кафе/i.test(corpus)) return 'coffee';
    if (/drinks|cocktail|cocktails|bar|rooftop|copas|бар|коктейл/i.test(corpus)) return 'drinks';
    if (/walk|walking|stroll|caminar|paseo|прогулк/i.test(corpus)) return 'walk';
    if (/dinner|restaurant|cena|restaurante|ужин/i.test(corpus)) return 'dinner';
    if (/laugh|smile|playful|chemistry|swiping|química|deslizar|химия|свайп/i.test(corpus)) return 'chemistry';
    return 'romantic';
  }

  return 'workout';
}

export function sceneForActivity(mode, activity, seed = 0) {
  const m = String(mode || 'TRAIN').toUpperCase();
  const byAct = SCENES_BY_ACTIVITY[m];
  if (byAct && byAct[activity]) {
    return byAct[activity];
  }
  const allScenes = MODE_PHOTO_SCENES[m] || MODE_PHOTO_SCENES.TRAIN;
  return pickFrom(allScenes, seed);
}

export function isDuplicateConcept(concept, recentEntries = []) {
  const headline = normalizeConceptKey(concept.imageHeadline);
  const visual = normalizeConceptKey(concept.visualConcept || concept.photoPrompt);
  const cta = normalizeConceptKey(concept.cta);
  const seed = concept.backgroundSeed;
  for (const entry of recentEntries) {
    if (entry.stockPhotoId && concept.stockPhotoId && entry.stockPhotoId === concept.stockPhotoId) {
      return 'stockPhoto';
    }
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
 * Determines the semantic activity from the actual post so the visual concept matches.
 * Supports explicit overrides (preview / manual).
 * Image text language always matches catalog/campaign locale.
 */
export function buildImageConcept(catalogItem, { isoDate = '', recentEntries = [], overrides = {} } = {}) {
  const mode = String(overrides.mode || catalogItem?.mode || 'TRAIN').toUpperCase();
  const language = String(overrides.language || catalogItem?.language || 'en').toLowerCase().slice(0, 2);
  const seedBase = `${isoDate}:${catalogItem?.contentId || 'preview'}:${mode}:${language}:${recentEntries.length}`;
  const seed = hashSeed(seedBase);

  const copyPackage =
    overrides.copyPackage ||
    catalogItem?.copyPackage ||
    selectCopyPackage({
      mode,
      language,
      isoDate,
      contentId: catalogItem?.contentId || 'preview',
      recentEntries
    });

  const semanticActivity = determinePostActivity({
    mode,
    copyPackage,
    catalogItem,
    overrides
  });

  let attempt = 0;
  let concept = null;
  while (attempt < 12) {
    const attemptSeed = seed + attempt * 9973;
    const headlineVariants =
      catalogItem?.imageHeadlines || headlineTextsFor(mode, language) || [MODE_HEADLINE_DEFAULTS[mode]];
    const ctaVariants = catalogItem?.imageCtas || ctaTextsFor(mode, language) || [MODE_CTA_DEFAULTS[mode]];
    const headlineFromCopy = attempt === 0 ? copyPackage.headline : '';
    const ctaFromCopy = attempt === 0 ? copyPackage.cta : '';
    const matchedScene =
      overrides.photoPrompt ||
      overrides.visualConcept ||
      catalogItem?.visualConcept ||
      sceneForActivity(mode, semanticActivity, attemptSeed);

    concept = {
      mode,
      contentId: catalogItem?.contentId || 'preview',
      language,
      locale: language,
      semanticActivity,
      imageHeadline:
        overrides.imageHeadline ||
        catalogItem?.imageHeadline ||
        headlineFromCopy ||
        pickFrom(headlineVariants, attemptSeed + 3) ||
        'Find Your Match',
      imageSubheadline:
        overrides.imageSubheadline ||
        catalogItem?.imageSubheadline ||
        (attempt === 0 ? copyPackage.subheadline || '' : ''),
      cta:
        overrides.cta ||
        catalogItem?.imageCta ||
        ctaFromCopy ||
        pickFrom(ctaVariants, attemptSeed + 11) ||
        MODE_CTA_DEFAULTS[mode] ||
        'FIND YOUR MATCH',
      photoPrompt: matchedScene,
      visualConcept: matchedScene,
      destinationUrl: 'https://gettrainmate.com',
      backgroundSeed: attemptSeed,
      headlineVariant: attempt === 0 ? copyPackage.headlineVariant : '',
      ctaVariant: attempt === 0 ? copyPackage.ctaVariant : '',
      subheadlineVariant: attempt === 0 ? copyPackage.subheadlineVariant : '',
      copyVariant: attempt === 0 ? copyPackage.copyVariant : '',
      campaign: copyPackage.campaign || ''
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
