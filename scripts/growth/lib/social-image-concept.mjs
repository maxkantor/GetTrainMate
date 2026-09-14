/**
 * TRAIN / VIBE / DATE scene labels for stock photo selection and overlay copy.
 * Journey: TRAIN (activity) → VIBE (hang out after) → DATE (optional chemistry).
 * Attractive athletic adults, natural and believable — not AI fitness ads.
 */
import {
  ctaTextsFor,
  headlineTextsFor,
  selectCopyPackage
} from './social-copy-variants.mjs';

export const SCENES_BY_ACTIVITY = {
  TRAIN: {
    pickleball: 'attractive athletic adult man and woman playing mixed pickleball doubles, competitive playful energy, realistic sweat, candid court photography',
    tennis: 'attractive athletic adults as tennis partners mid-rally on outdoor court, natural movement, subtle chemistry without romantic posing',
    running: 'attractive athletic man and woman running together outdoors, realistic sweat, natural skin texture, candid editorial sports photography',
    cycling: 'athletic man and woman cycling together on a scenic route, individual non-matching gear, natural partnership',
    functional: 'mixed functional-fitness partners training together in a real gym, helping with equipment, natural talk between sets',
    strength: 'attractive athletic man and woman lifting together, spotting and laughing between sets, realistic sweat and natural physiques',
    volleyball: 'mixed beach volleyball group of attractive athletic adults, sunset light, playful competition, candid movement',
    hiking: 'attractive athletic man and woman hiking a trail together, laughing mid-conversation, natural outdoor chemistry',
    partner: 'training partners in a modern gym talking between sets with natural eye contact and subtle chemistry',
    workout: 'attractive athletic man and woman finishing a workout together, sweaty, walking and talking naturally'
  },
  VIBE: {
    coffee_after_run: 'attractive athletic man and woman post-run at a café patio, still in workout clothes with realistic sweat, laughing over coffee',
    drinks_after_pickleball: 'pickleball partners walking from court toward an outdoor bar patio, rackets in hand, playful hangout energy',
    rooftop_after_workout: 'athletic adults after a fitness class hanging out on a casual rooftop, drinks, candid social energy, no office vibe',
    brewery_after_hike: 'hikers arriving at a patio brewery after a trail, dusty trail clothes, laughing over drinks',
    sports_bar_after_soccer: 'mixed recreational soccer players at a sports bar after the game, casual social energy',
    cafe_after_cycle: 'cyclists stopping at a café after a ride, helmets nearby, natural conversation',
    city_walk_after_class: 'man and woman walking through the city after a workout class, athletic casual clothes, subtle chemistry',
    social: 'attractive athletic friends hanging out after training, outdoor patio, candid laughs, no laptops',
    // legacy activity keys still used by catalog/tests
    coffee: 'attractive athletic adults grabbing coffee after training, candid patio hangout, no laptops',
    drinks: 'friends toasting drinks after a shared sport, outdoor bar, warm social nightlife',
    dining: 'friends enjoying patio dinner after a workout, lively conversation',
    hiking: 'friends hiking together then transitioning toward a social hangout energy',
    festival: 'athletic friends at an outdoor evening social gathering after training',
    outdoors: 'friends outdoors after an active day, candid social energy',
    city: 'athletic friends walking a city street after a workout, casual hangout'
  },
  DATE: {
    coffee_after_train: 'attractive athletic man and woman grabbing coffee after training, subtle flirt without cheesy posing, natural chemistry',
    drinks_after_game: 'tennis or pickleball partners having drinks after a match, outdoor bar, playful chemistry',
    walk_after_workout: 'man and woman walking off together after training, talking closely, subtle spark, not kissing or staged embrace',
    dinner_after_hike: 'athletic pair at a casual dinner after hiking, natural conversation, tasteful and modern',
    spot_maybe_date: 'attractive adults spotting each other in the gym with playful eye contact and teasing energy, not sexual posing',
    lifestyle: 'attractive athletic man and woman after a shared workout transitioning into a social moment, subtle chemistry',
    chemistry: 'happy athletic pair laughing together post-workout with genuine playful chemistry, not dramatic romance',
    // legacy keys
    coffee: 'attractive athletic adults on a coffee stop after training, warm conversation, no laptops',
    drinks: 'athletic pair clinking drinks after a shared sport, playful chemistry without cheesy romance',
    walk: 'man and woman walking together after training, candid smiles, natural chemistry',
    dinner: 'athletic pair at a casual dinner after activity, intimate conversation without staged posing',
    romantic: 'athletic pair with subtle chemistry after a shared workout, tasteful and modern'
  }
};

export const MODE_PHOTO_SCENES = {
  TRAIN: Object.values(SCENES_BY_ACTIVITY.TRAIN),
  VIBE: Object.values(SCENES_BY_ACTIVITY.VIBE),
  DATE: Object.values(SCENES_BY_ACTIVITY.DATE)
};

export const MODE_ACTIVITY_ROTATION = {
  TRAIN: ['pickleball', 'strength', 'running', 'tennis', 'volleyball', 'hiking', 'cycling', 'functional', 'workout'],
  VIBE: ['coffee_after_run', 'drinks_after_pickleball', 'rooftop_after_workout', 'brewery_after_hike', 'cafe_after_cycle', 'city_walk_after_class', 'sports_bar_after_soccer', 'social'],
  DATE: ['coffee_after_train', 'drinks_after_game', 'walk_after_workout', 'spot_maybe_date', 'dinner_after_hike', 'lifestyle', 'chemistry']
};

const GENERIC_ROTATABLE_ACTIVITIES = new Set([
  'events','event','social','friendship','dating','date','workout','gym','accountability','community','plans','activities','people'
]);

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

export function rotatedActivityForMode(mode, { isoDate = '', contentId = '', language = 'en', offset = 0 } = {}) {
  const m = String(mode || 'TRAIN').toUpperCase();
  const pool = MODE_ACTIVITY_ROTATION[m] || MODE_ACTIVITY_ROTATION.TRAIN;
  const rotationSeed = hashSeed(`${String(isoDate).slice(0, 10)}:${contentId}:${m}:${language}:activity:${offset}`);
  return pickFrom(pool, rotationSeed);
}

function shouldUseDailyActivityRotation({ catalogItem, overrides } = {}) {
  if (overrides?.activity || overrides?.photoPrompt || overrides?.visualConcept) return false;
  const declared = normalizeConceptKey(catalogItem?.activity);
  return !declared || GENERIC_ROTATABLE_ACTIVITIES.has(declared);
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
    if (/accountability|shows up|alone|motivation|partner|socio|compañero|solo|партнёр|в одиночку/i.test(corpus)) return 'partner';
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
    if (/active|activo|activos|activas|fitness|energy|adventure|lifestyle|estilo de vida|energía|активн|энерги|solteros activos|active singles/i.test(corpus)) return 'lifestyle';
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
  if (byAct && byAct[activity]) return byAct[activity];
  const allScenes = MODE_PHOTO_SCENES[m] || MODE_PHOTO_SCENES.TRAIN;
  return pickFrom(allScenes, seed);
}

export function isDuplicateConcept(concept, recentEntries = []) {
  const headline = normalizeConceptKey(concept.imageHeadline);
  const visual = normalizeConceptKey(concept.visualConcept || concept.photoPrompt);
  const activity = normalizeConceptKey(concept.semanticActivity);
  const cta = normalizeConceptKey(concept.cta);
  const seed = concept.backgroundSeed;
  for (const entry of recentEntries) {
    if (entry.stockPhotoId && concept.stockPhotoId && entry.stockPhotoId === concept.stockPhotoId) {
      return 'stockPhoto';
    }
    if (normalizeConceptKey(entry.imageHeadline) === headline) return 'headline';
    if (activity && normalizeConceptKey(entry.semanticActivity) === activity) return 'activity';
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
 * Broad mode-first campaigns rotate the underlying real-world activity by date while
 * preserving the approved copy, overlay and layout. Explicit/specific activities still win.
 */
export function buildImageConcept(catalogItem, { isoDate = '', recentEntries = [], overrides = {} } = {}) {
  const mode = String(overrides.mode || catalogItem?.mode || 'TRAIN').toUpperCase();
  const language = String(overrides.language || catalogItem?.language || 'en').toLowerCase().slice(0, 2);
  const seedBase = `${isoDate}:${catalogItem?.contentId || 'preview'}:${mode}:${language}:${recentEntries.length}`;
  const seed = hashSeed(seedBase);

  const copyPackage = overrides.copyPackage || catalogItem?.copyPackage || selectCopyPackage({ mode, language, isoDate, contentId: catalogItem?.contentId || 'preview', recentEntries });

  const detectedActivity = determinePostActivity({ mode, copyPackage, catalogItem, overrides });
  const useRotation = shouldUseDailyActivityRotation({ catalogItem, overrides });
  const semanticActivity = useRotation
    ? rotatedActivityForMode(mode, { isoDate, contentId: catalogItem?.contentId || 'preview', language })
    : detectedActivity;

  let attempt = 0;
  let concept = null;
  while (attempt < 12) {
    const attemptSeed = seed + attempt * 9973;
    const headlineVariants = catalogItem?.imageHeadlines || headlineTextsFor(mode, language) || [MODE_HEADLINE_DEFAULTS[mode]];
    const ctaVariants = catalogItem?.imageCtas || ctaTextsFor(mode, language) || [MODE_CTA_DEFAULTS[mode]];
    const headlineFromCopy = attempt === 0 ? copyPackage.headline : '';
    const ctaFromCopy = attempt === 0 ? copyPackage.cta : '';
    const attemptActivity = useRotation && attempt > 0
      ? rotatedActivityForMode(mode, { isoDate, contentId: catalogItem?.contentId || 'preview', language, offset: attempt })
      : semanticActivity;
    const matchedScene = overrides.photoPrompt || overrides.visualConcept || catalogItem?.visualConcept || sceneForActivity(mode, attemptActivity, attemptSeed);

    concept = {
      mode,
      contentId: catalogItem?.contentId || 'preview',
      language,
      locale: language,
      semanticActivity: attemptActivity,
      activityRotationEnabled: useRotation,
      imageHeadline: overrides.imageHeadline || catalogItem?.imageHeadline || headlineFromCopy || pickFrom(headlineVariants, attemptSeed + 3) || 'Find Your Match',
      imageSubheadline: overrides.imageSubheadline || catalogItem?.imageSubheadline || (attempt === 0 ? copyPackage.subheadline || '' : ''),
      cta: overrides.cta || catalogItem?.imageCta || ctaFromCopy || pickFrom(ctaVariants, attemptSeed + 11) || MODE_CTA_DEFAULTS[mode] || 'FIND YOUR MATCH',
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
    if (next.length > maxCharsPerLine && current) { lines.push(current); current = word; } else { current = next; }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
}

/** @deprecated use buildImageConcept */
export function deriveHeadlineCandidates() { return []; }
