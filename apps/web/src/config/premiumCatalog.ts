import { API_BASE_URL } from '@/config/api';

/** Mirrors server <see cref="GetTrainMate.Api.Constants.PremiumActionType" /> keys. */
export const PREMIUM_ACTION = {
  unlockChat: 'unlock_chat',
  aiIcebreaker: 'ai_icebreaker',
  aiCoachMessage: 'ai_coach_message',
  deeperMatchInsight: 'deeper_match_insight',
  profileBoost24h: 'profile_boost_24h',
  revealLikes: 'reveal_likes',
  aiWorkoutPlan: 'ai_workout_plan',
  aiProfileRewrite: 'ai_profile_rewrite',
} as const;

export type PremiumCatalog = {
  costs: Record<string, number>;
  labels: Record<string, string>;
};

const FALLBACK: PremiumCatalog = {
  costs: {
    [PREMIUM_ACTION.unlockChat]: 1,
    [PREMIUM_ACTION.aiIcebreaker]: 1,
    [PREMIUM_ACTION.aiCoachMessage]: 1,
    [PREMIUM_ACTION.deeperMatchInsight]: 2,
    [PREMIUM_ACTION.profileBoost24h]: 2,
    [PREMIUM_ACTION.revealLikes]: 3,
    [PREMIUM_ACTION.aiWorkoutPlan]: 3,
    [PREMIUM_ACTION.aiProfileRewrite]: 2,
  },
  labels: {
    [PREMIUM_ACTION.unlockChat]: 'Unlock chat',
    [PREMIUM_ACTION.aiIcebreaker]: 'AI Icebreaker',
    [PREMIUM_ACTION.aiCoachMessage]: 'Ask AI Coach',
    [PREMIUM_ACTION.deeperMatchInsight]: 'Why You Match',
    [PREMIUM_ACTION.profileBoost24h]: 'Profile Boost (24h)',
    [PREMIUM_ACTION.revealLikes]: 'Reveal Likes',
    [PREMIUM_ACTION.aiWorkoutPlan]: 'AI Workout Plan',
    [PREMIUM_ACTION.aiProfileRewrite]: 'Improve Profile with AI',
  },
};

let cached: PremiumCatalog | null = null;

/** Server-driven catalog with local fallback (no auth required). */
export async function loadPremiumCatalog(): Promise<PremiumCatalog> {
  if (cached) return cached;
  try {
    const res = await fetch(`${API_BASE_URL}/api/premium/catalog`);
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { costs?: Record<string, number>; labels?: Record<string, string> };
    cached = {
      costs: { ...FALLBACK.costs, ...(data.costs ?? {}) },
      labels: { ...FALLBACK.labels, ...(data.labels ?? {}) },
    };
    return cached;
  } catch {
    cached = FALLBACK;
    return cached;
  }
}

export function creditPhrase(n: number): string {
  return n === 1 ? '1 credit' : `${n} credits`;
}
