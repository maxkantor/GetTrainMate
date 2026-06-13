/**
 * Authoritative World Cup 2026 catalog IDs — display data always comes from the API.
 * Kept in sync with apps/api/Data/WorldCupOfficialFixtures.cs
 */
export const WORLD_CUP_OFFICIAL_GROUP_IDS = [
  'group-a', 'group-b', 'group-c', 'group-d', 'group-e', 'group-f',
  'group-g', 'group-h', 'group-i', 'group-j', 'group-k', 'group-l',
] as const;

export const WORLD_CUP_OFFICIAL_TEAM_IDS = [
  // Group A
  'mexico', 'south-africa', 'south-korea', 'czechia',
  // Group B
  'canada', 'bosnia-herzegovina', 'qatar', 'switzerland',
  // Group C
  'brazil', 'morocco', 'haiti', 'scotland',
  // Group D
  'usa', 'paraguay', 'australia', 'turkiye',
  // Group E
  'germany', 'curacao', 'ivory-coast', 'ecuador',
  // Group F
  'netherlands', 'japan', 'sweden', 'tunisia',
  // Group G
  'belgium', 'egypt', 'iran', 'new-zealand',
  // Group H
  'spain', 'cape-verde', 'saudi-arabia', 'uruguay',
  // Group I
  'france', 'senegal', 'norway', 'iraq',
  // Group J
  'argentina', 'algeria', 'austria', 'jordan',
  // Group K
  'portugal', 'colombia', 'dr-congo', 'uzbekistan',
  // Group L
  'england', 'croatia', 'ghana', 'panama',
] as const;

export const WORLD_CUP_OFFICIAL_MATCH_IDS = [
  'opening-mexico-vs-south-africa',
  'opening-south-korea-vs-czechia',
] as const;

/** In-play and full-time scores — keep in sync with WorldCupOfficialFixtures.ScoreOverrides */
export const WORLD_CUP_SCORE_OVERRIDES = [
  { teamAId: 'canada', teamBId: 'bosnia-herzegovina', scoreA: 1, scoreB: 1, status: 'Completed' as const },
  { teamAId: 'usa', teamBId: 'paraguay', scoreA: 2, scoreB: 0, status: 'Live' as const },
] as const;

export type OfficialScoreOverride = (typeof WORLD_CUP_SCORE_OVERRIDES)[number];

/** @deprecated Use WORLD_CUP_SCORE_OVERRIDES */
export const WORLD_CUP_COMPLETED_GROUP_RESULTS = WORLD_CUP_SCORE_OVERRIDES.filter((r) => r.status === 'Completed');
