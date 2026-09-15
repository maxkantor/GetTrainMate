/**
 * Pre-publish creative quality gate for GetTrainMate owned social.
 * Brand invariant: TRAIN → VIBE → DATE (activity first, then connection).
 * Rejects generic dining / cocktail-only / anonymous-crowd stock.
 */
export const HARD_REJECT_STOCK_IDS = new Set([
  'vibe-friends-patio-dining', // restaurant long-table — Sep 15 regression
  'vibe-cocktail-toast-night', // hands/cocktails only — rejected brand direction
  'vibe-wine-celebration-toast', // nightlife toast without TRAIN context
  'vibe-team-collab-5',
  'vibe-cafe-coffee-culture',
  'date-couple-cafe-social'
]);

/** Scene/activity text that must never ship. */
export const GENERIC_SOCIAL_REJECT_PATTERNS = [
  /\brestaurant\b/i,
  /\bdining\b/i,
  /\bbuffet\b/i,
  /\bbanquet\b/i,
  /\blong (wooden )?table\b/i,
  /\bmeal at outdoor patio\b/i,
  /\bsocial meal\b/i,
  /\bgroup of friends sitting.*table\b/i,
  /\bcrowded (bar|restaurant|dinner)\b/i,
  /\bhands? (holding|clinking|toasting).*(cocktail|wine|drink)/i,
  /\btoasting craft cocktails\b/i,
  /\bclinking wine glasses\b/i,
  /\bmoody bar at night\b/i
];

const ACTIVITY_SIGNAL =
  /\b(run|running|gym|train|workout|pickleball|paddle|padel|tennis|cycl|hike|hiking|sport|lift|fitness|partner|court|class|trail|athletic|match|game|soccer|football|volleyball|basketball|softball|hyrox|climb|surf|ski|swim|yoga|golf|boxing|after (a |the )?(run|workout|class|match|game|ride|hike))\b/i;

const CONNECTION_SIGNAL =
  /\b(friends?|talk(?:ing)?|laugh(?:ing)?|walk(?:ing)?|together|partners?|chemistry|plans?|smiling|conversation|hang(?:ing|out)?|social|celebrat\w*|meetup|couple|man and woman|connect\w*)\b/i;

/**
 * @param {{ mode?: string, stockPhotoId?: string, scene?: string, photoPrompt?: string, visualConcept?: string }} input
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function assessCreativeProductFit(input = {}) {
  const mode = String(input.mode || '').toUpperCase();
  const stockPhotoId = String(input.stockPhotoId || '').trim();
  const corpus = [
    stockPhotoId,
    input.scene,
    input.photoPrompt,
    input.visualConcept
  ]
    .filter(Boolean)
    .join(' | ');

  if (stockPhotoId && HARD_REJECT_STOCK_IDS.has(stockPhotoId)) {
    return { ok: false, reason: `hard_reject_stock:${stockPhotoId}` };
  }

  for (const re of GENERIC_SOCIAL_REJECT_PATTERNS) {
    if (re.test(corpus)) {
      if (mode === 'DATE' && /coffee|cafe|café/i.test(corpus) && !/restaurant|dining|meal|banquet|cocktail|wine toast/i.test(corpus)) {
        continue;
      }
      return { ok: false, reason: `generic_social_scene:${re}` };
    }
  }

  // Journey gate: every creative needs activity + human connection signal.
  if (corpus) {
    if (!ACTIVITY_SIGNAL.test(corpus)) {
      return { ok: false, reason: 'journey_missing_train_activity' };
    }
    if (!CONNECTION_SIGNAL.test(corpus)) {
      return { ok: false, reason: 'journey_missing_vibe_connection' };
    }
  }

  if (mode === 'TRAIN') {
    const trainOk =
      /run|gym|train|workout|pickleball|tennis|cycl|hike|sport|lift|fitness|partner|court|match/i.test(corpus);
    if (corpus && !trainOk) {
      return { ok: false, reason: 'train_missing_activity_signal' };
    }
  }

  if (mode === 'VIBE') {
    const vibeBad =
      /\brestaurant\b|\bdining\b|\bmeal at\b|\bbanquet\b|\blaptop\b|\bcoworking\b|\bconference room\b|\bcocktail\b|\bwine glasses\b|\bmoody bar\b/i.test(
        corpus
      );
    if (vibeBad) return { ok: false, reason: 'vibe_generic_dining_or_nightlife' };
  }

  if (mode === 'DATE') {
    const dateOk = /couple|man and woman|chemistry|romantic|date|walk|coffee|drink|workout|train|pickleball|after/i.test(corpus);
    if (corpus && !dateOk) {
      return { ok: false, reason: 'date_missing_pair_signal' };
    }
  }

  return { ok: true };
}

/**
 * Pick an evergreen prior publish to reuse when live generation fails the gate.
 * Prefers same mode, non-fallback, successful publishes with an imageKey/URL.
 */
export function selectEvergreenCreative(entries = [], { mode } = {}) {
  const m = String(mode || '').toUpperCase();
  const published = (entries || [])
    .filter((e) => e && e.status === 'published' && (e.imageUrl || e.imageKey))
    .filter((e) => e.imageFallback !== true)
    .filter((e) => !HARD_REJECT_STOCK_IDS.has(String(e.stockPhotoId || '')))
    .slice()
    .reverse();

  const sameMode = published.find((e) => String(e.mode || '').toUpperCase() === m);
  return sameMode || published[0] || null;
}
