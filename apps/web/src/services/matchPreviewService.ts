import { API_BASE_URL } from '@/config/api';
import { landingTrainingLabelToSportTag } from '@/config/landingTrainingOptions';

export type LandingMatchPreviewUser = {
  name: string;
  age?: number | null;
  trainingSummary: string;
  goalLine: string;
  photoUrl?: string | null;
  levelLabel?: string | null;
  timePrefLabel?: string | null;
  distanceLabel?: string | null;
};

export type LandingMatchPreviewResult = {
  kind: 'real' | 'demo';
  matchCount: number;
  users: LandingMatchPreviewUser[];
  exampleLabel?: string | null;
};

/**
 * Anonymous landing preview: real DynamoDB-backed matches or labeled demo — no distance/location.
 */
export async function fetchLandingMatchPreview(params: {
  trainingLabel: string;
  level: string;
  timePref: string;
}): Promise<LandingMatchPreviewResult | null> {
  const sportTag = landingTrainingLabelToSportTag(params.trainingLabel.trim());

  const res = await fetch(`${API_BASE_URL}/api/public/match-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sportTag,
      level: params.level.trim(),
      timePref: params.timePref.trim(),
    }),
  });

  if (!res.ok) return null;

  return (await res.json()) as LandingMatchPreviewResult;
}
