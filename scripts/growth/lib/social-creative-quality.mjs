/**
 * Pre-publish creative quality gate for GetTrainMate owned social.
 * Rejects generic dining / anonymous-crowd stock that fails the product story.
 */
export const HARD_REJECT_STOCK_IDS = new Set([
  'vibe-friends-patio-dining', // restaurant long-table stock — Sep 15 regression
  'vibe-team-collab-5',
  'vibe-cafe-coffee-culture',
  'date-couple-cafe-social'
]);

/** Scene/activity text that must never ship as a VIBE (or fallback) creative. */
export const GENERIC_SOCIAL_REJECT_PATTERNS = [
  /\brestaurant\b/i,
  /\bdining\b/i,
  /\bbuffet\b/i,
  /\bbanquet\b/i,
  /\blong (wooden )?table\b/i,
  /\bmeal at outdoor patio\b/i,
  /\bsocial meal\b/i,
  /\bgroup of friends sitting.*table\b/i,
  /\bcrowded (bar|restaurant|dinner)\b/i
];

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
      // DATE coffee after train is OK; pure restaurant crowd is not.
      if (mode === 'DATE' && /coffee|cafe|café/i.test(corpus) && !/restaurant|dining|meal|banquet/i.test(corpus)) {
        continue;
      }
      return { ok: false, reason: `generic_social_scene:${re}` };
    }
  }

  if (mode === 'TRAIN') {
    const trainOk =
      /run|gym|train|workout|pickleball|tennis|cycl|hike|sport|lift|fitness|partner/i.test(corpus);
    if (corpus && !trainOk) {
      return { ok: false, reason: 'train_missing_activity_signal' };
    }
  }

  if (mode === 'VIBE') {
    const vibeOk =
      /friend|group|social|rooftop|hike|trail|festival|pickleball|run|workout|city|walk|toast|nightlife|plan|event|outdoor|beach|concert/i.test(
        corpus
      );
    // Do not treat "no office vibe" as an office scene.
    const vibeBad =
      /\brestaurant\b|\bdining\b|\bmeal at\b|\bbanquet\b|\blaptop\b|\bcoworking\b|\bconference room\b/i.test(
        corpus
      );
    if (vibeBad) return { ok: false, reason: 'vibe_generic_dining_or_office' };
    if (corpus && !vibeOk) return { ok: false, reason: 'vibe_missing_plans_signal' };
  }

  if (mode === 'DATE') {
    const dateOk = /couple|man and woman|chemistry|romantic|date|walk|coffee|drink|workout|train/i.test(corpus);
    if (corpus && !dateOk) return { ok: false, reason: 'date_missing_pair_signal' };
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
