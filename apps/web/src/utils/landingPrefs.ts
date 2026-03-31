/** Session-only prefs from landing quick setup → signup / onboarding prefill */
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
  const m: Record<string, string> = {
    HYROX: 'Hyrox',
    'Strength & conditioning': 'Gym',
    'Running / cardio': 'Running',
    'CrossFit / functional': 'CrossFit',
  };
  return m[training] ?? 'Gym';
}

export function landingLevelToProfileLevel(level: string): string {
  const map: Record<string, string> = {
    Beginner: 'beginner',
    Intermediate: 'intermediate',
    Advanced: 'advanced',
  };
  return map[level] ?? 'intermediate';
}
