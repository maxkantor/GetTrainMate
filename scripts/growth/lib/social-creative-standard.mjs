/**
 * PERMANENT GetTrainMate social creative standard.
 * Brand invariant: TRAIN → VIBE → DATE
 *
 * Canonical reference (2026-09-15 approved):
 * Pickleball partners walking after a match —
 * "THE MATCH ENDS. THE CONNECTION DOESN'T HAVE TO."
 *
 * Copy the LOGIC and QUALITY of that creative — not the same sport/people daily.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '../../..');

export const CREATIVE_STANDARD_VERSION = '2026-09-15-journey-v1';

export const APPROVED_BASELINE = {
  date: '2026-09-15',
  sport: 'pickleball',
  stage: 'train_to_vibe',
  headline: "THE MATCH ENDS.\nTHE CONNECTION DOESN'T HAVE TO.",
  support: 'Meet through what you already love doing.',
  cta: 'FIND YOUR PEOPLE →',
  people: 2,
  localPath: 'docs/growth/owned-social/approved/journey-pickleball-after-match.jpg',
  logic: [
    'obvious shared activity',
    'both people participated',
    'activity still visually identifiable',
    'natural interaction afterward',
    'visible chemistry without forced romance',
    'headline matches the activity',
    'photo works without text'
  ]
};

/** Broad diversity buckets — avoid repeating same bucket too tightly. */
export const SPORT_CATEGORIES = [
  'racquet_paddle',
  'hybrid_functional',
  'team_sport',
  'endurance_outdoor',
  'gym_fitness',
  'recreational_team',
  'adventure_wellness'
];

/**
 * Sport library: id, category, photo scene (activity+connection), headlines.
 * Headlines are generated AFTER sport selection.
 */
export const SPORT_LIBRARY = [
  {
    id: 'pickleball',
    category: 'racquet_paddle',
    scene: 'attractive athletic man and woman finishing a pickleball game, paddles visible, walking away from the court talking and laughing naturally — not posing at camera',
    headlines: [
      "THE MATCH ENDS.\nTHE CONNECTION DOESN'T HAVE TO.",
      'START WITH A MATCH.\nSEE WHERE IT GOES.',
      'SAME COURT.\nNEW CONNECTION.',
      'GOOD MATCH.\nBETTER CONNECTION.'
    ]
  },
  {
    id: 'tennis',
    category: 'racquet_paddle',
    scene: 'tennis partners walking from an outdoor court with rackets visible, talking and laughing naturally after playing',
    headlines: [
      "THE MATCH ENDS.\nTHE CONNECTION DOESN'T HAVE TO.",
      'SAME COURT.\nNEW CONNECTION.',
      'START WITH A MATCH.\nSEE WHERE IT GOES.'
    ]
  },
  {
    id: 'padel',
    category: 'racquet_paddle',
    scene: 'padel partners walking from the court with rackets, mixed doubles energy, talking naturally after the match',
    headlines: [
      'SAME COURT.\nNEW CONNECTION.',
      "THE MATCH ENDS.\nTHE CONNECTION DOESN'T HAVE TO.",
      'GOOD MATCH.\nBETTER CONNECTION.'
    ]
  },
  {
    id: 'hyrox',
    category: 'hybrid_functional',
    scene: 'two HYROX-style training partners recovering together after sled/functional work, athletic wear, talking and smiling — not collapsed alone',
    headlines: [
      "THE WORKOUT ENDS.\nTHE CONNECTION DOESN'T HAVE TO.",
      'FINISH TOGETHER.\nSEE WHAT STARTS.',
      'SAME STATIONS.\nNEW CONNECTION.',
      'TRAIN HARD.\nCONNECT NATURALLY.'
    ]
  },
  {
    id: 'functional',
    category: 'hybrid_functional',
    scene: 'functional-fitness partners walking out of a hybrid gym together after a circuit, laughing and making plans',
    headlines: [
      'FINISH TOGETHER.\nSEE WHAT STARTS.',
      "THE WORKOUT ENDS.\nTHE CONNECTION DOESN'T HAVE TO.",
      'TRAIN HARD.\nCONNECT NATURALLY.'
    ]
  },
  {
    id: 'soccer',
    category: 'team_sport',
    scene: 'co-ed recreational soccer players walking off the field together after a match, ball or cleats visible, talking naturally — 2–4 people not a giant team pose',
    headlines: [
      "THE FINAL WHISTLE\nDOESN'T HAVE TO BE THE END.",
      'SAME FIELD.\nNEW CONNECTION.',
      'PLAY TOGETHER.\nSEE WHERE IT GOES.'
    ]
  },
  {
    id: 'volleyball',
    category: 'team_sport',
    scene: 'beach volleyball partners walking from the court with ball or net context visible, talking and laughing after the match',
    headlines: [
      'GOOD MATCH.\nBETTER CONNECTION.',
      'SAME COURT.\nNEW CONNECTION.',
      "THE GAME ENDS.\nTHE VIBE DOESN'T HAVE TO."
    ]
  },
  {
    id: 'basketball',
    category: 'recreational_team',
    scene: 'recreational basketball players leaving an outdoor court after pickup, talking courtside — 2–4 people, connection-focused',
    headlines: [
      "THE GAME ENDS.\nTHE CONNECTION DOESN'T.",
      'SAME COURT.\nNEW CONNECTION.'
    ]
  },
  {
    id: 'softball',
    category: 'recreational_team',
    scene: 'co-ed recreational softball teammates leaving the field carrying gloves, talking and laughing after the game',
    headlines: [
      "THE FINAL WHISTLE\nDOESN'T HAVE TO BE THE END.",
      'PLAY TOGETHER.\nSEE WHERE IT GOES.'
    ]
  },
  {
    id: 'flag_football',
    category: 'recreational_team',
    scene: 'co-ed flag football players walking off the field after a recreational game, talking naturally in small group',
    headlines: [
      'PLAY TOGETHER.\nSEE WHERE IT GOES.',
      'SAME FIELD.\nNEW CONNECTION.'
    ]
  },
  {
    id: 'running',
    category: 'endurance_outdoor',
    scene: 'running partners cooling down together after a waterfront run at golden hour, walking side-by-side talking and smiling — athletic wear, activity clear',
    headlines: [
      'SAME PACE.\nMAYBE MORE.',
      'START WITH A RUN.\nSEE WHERE IT GOES.',
      'RUN TOGETHER.\nSTAY FOR THE CONNECTION.'
    ]
  },
  {
    id: 'cycling',
    category: 'endurance_outdoor',
    scene: 'cycling partners walking bikes together after a ride, helmets nearby, natural conversation — activity gear visible',
    headlines: [
      'SAME ROUTE.\nNEW CONNECTION.',
      'RIDE TOGETHER.\nSEE WHERE IT GOES.'
    ]
  },
  {
    id: 'triathlon',
    category: 'endurance_outdoor',
    scene: 'endurance training partners recovering together after a brick bike/run session, talking and smiling',
    headlines: [
      'FINISH TOGETHER.\nSEE WHAT STARTS.',
      'TRAIN HARD.\nCONNECT NATURALLY.'
    ]
  },
  {
    id: 'swimming',
    category: 'endurance_outdoor',
    scene: 'swim partners walking from the pool or beach after training, towels visible, talking naturally',
    headlines: [
      'START WITH AN ACTIVITY.\nSEE WHERE IT GOES.',
      'SAME WORKOUT.\nNEW CONNECTION.'
    ]
  },
  {
    id: 'gym',
    category: 'gym_fitness',
    scene: 'gym partners leaving the gym together after training, talking between the doors, natural chemistry — not isolated lifter posing',
    headlines: [
      'START WITH A WORKOUT.\nSEE WHERE IT GOES.',
      'SAME WORKOUT.\nNEW CONNECTION.',
      'ONE MORE REP.\nMAYBE ONE MORE COFFEE.'
    ]
  },
  {
    id: 'boxing_fitness',
    category: 'gym_fitness',
    scene: 'boxing-fitness classmates talking after a training session, gloves or wraps context, friendly energy — not fight violence',
    headlines: [
      "THE WORKOUT ENDS.\nTHE CONNECTION DOESN'T HAVE TO.",
      'TRAIN HARD.\nCONNECT NATURALLY.'
    ]
  },
  {
    id: 'hiking',
    category: 'adventure_wellness',
    scene: 'hiking partners at a scenic viewpoint after the trail, backpacks visible, talking and laughing together',
    headlines: [
      'TAKE THE TRAIL.\nSEE WHERE IT LEADS.',
      'SAME TRAIL.\nNEW CONNECTION.',
      "THE VIEW'S BETTER\nWITH THE RIGHT COMPANY."
    ]
  },
  {
    id: 'climbing',
    category: 'adventure_wellness',
    scene: 'climbing partners celebrating after a bouldering session, talking and smiling — gear visible, natural connection',
    headlines: [
      'START WITH A CLIMB.\nSEE WHERE IT GOES.',
      "FIND SOMEONE\nWHO'S UP FOR THE CLIMB."
    ]
  },
  {
    id: 'yoga',
    category: 'adventure_wellness',
    scene: 'people talking after an outdoor yoga or pilates class, mats rolled, leaving together naturally',
    headlines: [
      'START WITH AN ACTIVITY.\nSEE WHERE IT GOES.',
      'DO SOMETHING YOU LOVE.\nMEET SOMEONE WHO DOES TOO.'
    ]
  },
  {
    id: 'skiing',
    category: 'adventure_wellness',
    scene: 'ski partners walking together after a run carrying skis, natural après connection — not nightlife bar stock',
    headlines: [
      'SAME TRAIL.\nNEW CONNECTION.',
      'START WITH AN ACTIVITY.\nSEE WHERE IT GOES.'
    ]
  },
  {
    id: 'surfing',
    category: 'adventure_wellness',
    scene: 'surfers walking from the beach with boards after a session, talking and laughing',
    headlines: [
      'START WITH AN ACTIVITY.\nSEE WHERE IT GOES.',
      'DO SOMETHING YOU LOVE.\nMEET SOMEONE WHO DOES TOO.'
    ]
  },
  {
    id: 'golf',
    category: 'adventure_wellness',
    scene: 'recreational golfers walking together after a round, talking naturally toward the clubhouse',
    headlines: [
      'SAME COURSE.\nNEW CONNECTION.',
      'START WITH AN ACTIVITY.\nSEE WHERE IT GOES.'
    ]
  }
];

/** Story stages — TRAIN→VIBE should be most common. */
export const STORY_STAGES = {
  train: {
    id: 'train',
    weight: 2,
    scenePrefix: 'during the shared activity with visible interaction between partners — '
  },
  train_to_vibe: {
    id: 'train_to_vibe',
    weight: 5,
    scenePrefix: 'just finished the activity, transitioning into natural social connection — '
  },
  vibe: {
    id: 'vibe',
    weight: 2,
    scenePrefix: 'post-activity social moment with sport clothing/equipment still implying how they met — '
  },
  vibe_to_date: {
    id: 'vibe_to_date',
    weight: 1,
    scenePrefix: 'subtle chemistry between two adults who clearly met through the shared activity — '
  }
};

export const DEFAULT_CTA = 'FIND YOUR PEOPLE →';
export const DEFAULT_SUPPORT = 'Meet through what you already love doing.';

export const WEAK_HEADLINE_PATTERNS = [
  /same energy\.?\s*now say hi/i,
  /learn more/i,
  /click here/i,
  /discover more/i,
  /weekend is empty/i,
  /tired of scrolling/i,
  /meaningful connections/i
];

function hashSeed(input) {
  let h = 2166136261;
  for (let i = 0; i < String(input || '').length; i++) {
    h ^= String(input).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) >>> 0;
}

function pickWeighted(items, seed, weightFn) {
  const weights = items.map((it) => Math.max(1, weightFn(it)));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = seed % total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

export function recentSportsFromEntries(entries = [], limit = 5) {
  return (entries || [])
    .filter((e) => e && (e.status === 'published' || e.facebookPostId))
    .slice()
    .reverse()
    .slice(0, limit)
    .map((e) => String(e.sport || e.semanticActivity || '').toLowerCase().trim())
    .filter(Boolean);
}

export function recentHeadlinesFromEntries(entries = [], limit = 8) {
  return (entries || [])
    .filter((e) => e && e.status === 'published')
    .slice()
    .reverse()
    .slice(0, limit)
    .map((e) => String(e.imageHeadline || '').toLowerCase().replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * Select sport → stage → scene → headline (copy after sport).
 * Anti-repeat: avoid sports from last ~5 publishes and recent headlines.
 */
export function selectCreativePlan({
  mode = 'VIBE',
  isoDate = '',
  contentId = '',
  recentEntries = [],
  offset = 0
} = {}) {
  const m = String(mode || 'VIBE').toUpperCase();
  const seed = hashSeed(`${isoDate}:${contentId}:${m}:standard:${CREATIVE_STANDARD_VERSION}:${offset}`);
  const recentSports = new Set(recentSportsFromEntries(recentEntries, 5));
  const recentHeadlines = new Set(recentHeadlinesFromEntries(recentEntries, 8));

  let pool = SPORT_LIBRARY.filter((s) => !recentSports.has(s.id));
  if (!pool.length) pool = [...SPORT_LIBRARY];

  // Prefer category diversity vs last published category when available
  const lastSportId = [...recentSports][0];
  const lastCat = SPORT_LIBRARY.find((s) => s.id === lastSportId)?.category;
  if (lastCat) {
    const diversify = pool.filter((s) => s.category !== lastCat);
    if (diversify.length) pool = diversify;
  }

  const sport = pool[seed % pool.length];

  const stages = Object.values(STORY_STAGES).filter((st) => {
    if (m === 'DATE') return st.id === 'train_to_vibe' || st.id === 'vibe_to_date';
    if (m === 'VIBE') return st.id === 'train_to_vibe' || st.id === 'vibe';
    return st.id === 'train' || st.id === 'train_to_vibe';
  });
  // DATE mode bias toward vibe_to_date / train_to_vibe; TRAIN bias toward train / train_to_vibe
  const stage = pickWeighted(stages, seed + 17, (st) => {
    if (m === 'TRAIN' && st.id === 'train') return 6;
    if (m === 'TRAIN' && st.id === 'train_to_vibe') return 5;
    if (m === 'VIBE' && st.id === 'train_to_vibe') return 8;
    if (m === 'VIBE' && st.id === 'vibe') return 4;
    if (m === 'DATE' && st.id === 'vibe_to_date') return 6;
    if (m === 'DATE' && st.id === 'train_to_vibe') return 4;
    return st.weight;
  });

  let headlinePool = sport.headlines.filter(
    (h) => !recentHeadlines.has(String(h).toLowerCase().replace(/\s+/g, ' ').trim())
  );
  if (!headlinePool.length) headlinePool = sport.headlines;
  // Prefer approved baseline headline only when sport is pickleball and not recently used
  const headline = headlinePool[(seed + 31) % headlinePool.length];

  const people =
    m !== 'DATE' && (stage.id === 'vibe' || /soccer|volleyball|softball|flag|basketball/i.test(sport.id))
      ? 2 + ((seed >> 3) % 2) // 2–3
      : 2;

  // Keep the positive prompt purely descriptive. Safety/exclusion language belongs
  // in Bedrock's negative_prompt; mixing "no restaurant" into the scene caused
  // both provider moderation and our own semantic gate to reject valid photos.
  const photoPrompt = `${stage.scenePrefix}${sport.scene}. Show exactly ${people} attractive athletic adults as the main subjects. Make the ${sport.id.replace(/_/g, ' ')} setting and equipment unmistakable. They look at and talk to each other naturally. Premium realistic editorial sports lifestyle photograph from a real camera. Activity first, then connection.`;

  return {
    standardVersion: CREATIVE_STANDARD_VERSION,
    mode: m,
    sport: sport.id,
    category: sport.category,
    stage: stage.id,
    people,
    photoPrompt,
    visualConcept: photoPrompt,
    semanticActivity: sport.id,
    imageHeadline: headline,
    imageSubheadline: people >= 3 ? '' : DEFAULT_SUPPORT, // drop support when denser group / tighter layout
    cta: DEFAULT_CTA,
    baselineRef: APPROVED_BASELINE.localPath
  };
}

/**
 * Quality score 0–14 across 7 categories (0–2 each).
 * Require >= 12 and no category at 0.
 */
export function scoreCreativeQuality(input = {}) {
  const corpus = [
    input.sport,
    input.stage,
    input.scene,
    input.photoPrompt,
    input.visualConcept,
    input.imageHeadline,
    input.headline,
    input.stockPhotoId
  ]
    .filter(Boolean)
    .join(' | ');

  const scores = {
    sharedActivity: 0,
    humanConnection: 0,
    journeyStory: 0,
    headlineMatch: 0,
    mobileReadability: 0,
    imageRealism: 0,
    brandFit: 0
  };

  // Shared activity
  if (/pickleball|tennis|padel|hyrox|soccer|football|volleyball|basketball|softball|running|cycl|hike|gym|climb|surf|ski|swim|yoga|golf|workout|train|match|court|field|trail|paddle|racket/i.test(corpus)) {
    scores.sharedActivity = 2;
  } else if (/sport|fitness|athletic|activity/i.test(corpus)) {
    scores.sharedActivity = 1;
  }

  // Human connection
  if (/walk(?:ing)?|talk(?:ing)?|laugh(?:ing)?|together|partners?|eye contact|chemistry|smiling|conversation|leaving|cooling down/i.test(corpus)) {
    scores.humanConnection = 2;
  } else if (/friends?|social|group|hang/i.test(corpus)) {
    scores.humanConnection = 1;
  }

  // Journey story
  if (/after|finished|leaving|cooling|walking away|transition|post-|train.?to.?vibe|see where/i.test(corpus) || input.stage) {
    scores.journeyStory = /restaurant|cocktail|nightlife|dining|moody bar/i.test(corpus) ? 0 : 2;
  } else if (/train|vibe|date|connection/i.test(corpus)) {
    scores.journeyStory = 1;
  }

  // Headline / image match
  const hl = String(input.imageHeadline || input.headline || '');
  if (WEAK_HEADLINE_PATTERNS.some((re) => re.test(hl))) {
    scores.headlineMatch = 0;
  } else if (hl && /match|connection|together|pace|trail|whistle|workout|court|field|climb|ride|run|activity|workout/i.test(hl)) {
    scores.headlineMatch = 2;
  } else if (hl) {
    scores.headlineMatch = 1;
  }

  // Mobile readability — assume deterministic overlay passes unless flagged
  scores.mobileReadability = input.unreadableText ? 0 : input.tightLayout ? 1 : 2;

  // Realism — fail closed on known bad signals
  if (/malformed|extra finger|cloned|duplicate people|impossible limb|floating equipment/i.test(corpus)) {
    scores.imageRealism = 0;
  } else if (/glamour|oversexual|bedroom|kissing strangers/i.test(corpus)) {
    scores.imageRealism = 0;
  } else {
    scores.imageRealism = input.anatomyRisk ? 1 : 2;
  }

  // Brand fit — must not look like gym/bar/dating-only ad or railroad AI art
  if (/restaurant crowd|cocktail|nightlife|anonymous|generic gym stock|tinder|hookup|railroad|railway|train track|locomotive/i.test(corpus)) {
    scores.brandFit = 0;
  } else if (/activity|sport|workout|connection|partner|after|court|field|trail/i.test(corpus)) {
    scores.brandFit = 2;
  } else {
    scores.brandFit = 1;
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const zeroCats = Object.entries(scores).filter(([, v]) => v === 0).map(([k]) => k);
  const ok = total >= 12 && zeroCats.length === 0;

  return {
    ok,
    total,
    max: 14,
    scores,
    zeroCategories: zeroCats,
    reason: ok ? '' : zeroCats.length ? `score_zero:${zeroCats.join(',')}` : `score_below_12:${total}`
  };
}

/**
 * Hard reject + score gate for future publishes.
 */
export function assessCreativeStandard(input = {}) {
  const corpus = [
    input.stockPhotoId,
    input.scene,
    input.photoPrompt,
    input.visualConcept,
    input.imageHeadline,
    input.sport
  ]
    .filter(Boolean)
    .join(' | ');

  const hardReject = [
    /\brestaurant\b/i,
    /\bdining\b/i,
    /\bcocktail\b/i,
    /\bmoody bar\b/i,
    /\bnightlife\b/i,
    /\bhands? (holding|clinking|toasting)/i,
    /\bclinking wine\b/i,
    /\banonymous crowd\b/i,
    /\beveryone staring at (the )?camera\b/i,
    /\bisolated athlete\b/i,
    /\bbedroom\b/i,
    /\bkissing\b/i,
    // Sep 17: literal trains from brand-word confusion
    /\brailroad\b/i,
    /\brailway\b/i,
    /\btrain tracks?\b/i,
    /\blocomotive\b/i,
    /\bfreight train\b/i,
    /\bpassenger train\b/i
  ];
  for (const re of hardReject) {
    if (re.test(corpus)) {
      return { ok: false, reason: `hard_reject:${re}`, score: null };
    }
  }

  const score = scoreCreativeQuality(input);
  if (!score.ok) {
    return { ok: false, reason: score.reason, score };
  }
  return { ok: true, score };
}

export function loadApprovedBaselineMeta() {
  const metaPath = path.join(REPO_ROOT, 'docs/growth/owned-social/approved/baseline.json');
  if (!fs.existsSync(metaPath)) return { ...APPROVED_BASELINE };
  try {
    return { ...APPROVED_BASELINE, ...JSON.parse(fs.readFileSync(metaPath, 'utf8')) };
  } catch {
    return { ...APPROVED_BASELINE };
  }
}
