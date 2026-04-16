import type { AvailabilitySlot } from '@/services/profileService';
import { landingTrainingLabelToSportTag } from '@/config/landingTrainingOptions';

/**
 * Session-only prefs from landing quick setup → signup / onboarding prefill.
 * Distance, “near you”, and availability are shown only after signup in Discover
 * when the member profile (and match feed) include real location / schedule data.
 */
export const LANDING_PREFS_KEY = 'gtm_landing_prefs';

export type LandingPrefs = {
  training: string;
  level: string;
  timePref: string;
  savedAt: string;
};

export function saveLandingPrefs(prefs: Omit<LandingPrefs, 'savedAt'>): void {
  try {
    const payload: LandingPrefs = {
      ...prefs,
      savedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(LANDING_PREFS_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function readLandingPrefs(): LandingPrefs | null {
  try {
    const raw = sessionStorage.getItem(LANDING_PREFS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as LandingPrefs;
    if (!p?.training || !p?.level) return null;
    return p;
  } catch {
    return null;
  }
}

/** Map landing "training type" dropdown to a sport tag for onboarding */
export function trainingToSportTag(training: string): string {
  return landingTrainingLabelToSportTag(training);
}

export function landingLevelToProfileLevel(level: string): string {
  const map: Record<string, string> = {
    Beginner: 'beginner',
    Intermediate: 'intermediate',
    Advanced: 'advanced',
  };
  return map[level] ?? 'intermediate';
}

/** Server requires ≥1 availability slot — derive from landing schedule preference */
export function timePrefToAvailabilitySlot(timePref: string): AvailabilitySlot {
  const map: Record<string, AvailabilitySlot> = {
    'Early (5–7am)': { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], timeStart: '05:00', timeEnd: '07:00' },
    'Morning (5–9am)': { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], timeStart: '05:00', timeEnd: '09:00' },
    'Mid-day': { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], timeStart: '12:00', timeEnd: '14:00' },
    Evening: { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], timeStart: '17:00', timeEnd: '21:00' },
  };
  return map[timePref] ?? map['Evening'];
}

/** Bio length must satisfy server 20–500 chars */
export function buildDefaultBio(tags: string[], level: string): string {
  const clean = tags.filter((t) => t && t !== 'Other').slice(0, 3);
  const tagStr = clean.length ? clean.join(', ') : 'fitness';
  const lvl = (level || 'intermediate').toLowerCase();
  return `Looking to meet active people for ${tagStr}. I'm ${lvl} level — consistent sessions, good energy, and real connection. Message me to plan a workout or hangout.`;
}
