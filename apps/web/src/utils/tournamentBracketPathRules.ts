import { ADVANCEMENTS, ROUND_OF_32, type GroupSlot } from '@/config/worldCupKnockoutBracket';

/** Team id → group letter (A–L) — synced with WorldCupOfficialFixtures.cs */
const TEAM_GROUP: Record<string, string> = {
  mexico: 'A', 'south-africa': 'A', 'south-korea': 'A', czechia: 'A',
  canada: 'B', 'bosnia-herzegovina': 'B', qatar: 'B', switzerland: 'B',
  brazil: 'C', morocco: 'C', haiti: 'C', scotland: 'C',
  usa: 'D', paraguay: 'D', australia: 'D', turkiye: 'D',
  germany: 'E', curacao: 'E', 'ivory-coast': 'E', ecuador: 'E',
  netherlands: 'F', japan: 'F', sweden: 'F', tunisia: 'F',
  belgium: 'G', egypt: 'G', iran: 'G', 'new-zealand': 'G',
  spain: 'H', 'cape-verde': 'H', 'saudi-arabia': 'H', uruguay: 'H',
  france: 'I', senegal: 'I', norway: 'I', iraq: 'I',
  argentina: 'J', algeria: 'J', austria: 'J', jordan: 'J',
  portugal: 'K', colombia: 'K', 'dr-congo': 'K', uzbekistan: 'K',
  england: 'L', croatia: 'L', ghana: 'L', panama: 'L',
};

const QUARTER_FINAL_IDS = ['qf-m01', 'qf-m02', 'qf-m03', 'qf-m04'] as const;

const WINNER_ADVANCEMENT = ADVANCEMENTS
  .filter((a) => a.toMatchId !== 'third-place')
  .reduce<Record<string, string>>((acc, a) => {
    acc[a.fromMatchId] = a.toMatchId;
    return acc;
  }, {});

type KnockoutEntry = { r32MatchId: string; groupPlace: number };

const norm = (id: string) => id.trim().toLowerCase();

function slotMatches(slot: GroupSlot, letter: string, place: number) {
  return slot.group === letter && slot.place === place;
}

function getGroupLetter(teamId: string): string | null {
  return TEAM_GROUP[norm(teamId)] ?? null;
}

function getPossibleEntries(groupLetter: string): KnockoutEntry[] {
  const entries: KnockoutEntry[] = [];

  for (const r32 of ROUND_OF_32) {
    if (slotMatches(r32.teamA, groupLetter, 1) || slotMatches(r32.teamA, groupLetter, 2)) {
      entries.push({ r32MatchId: r32.matchId, groupPlace: r32.teamA.place });
    }
    if (slotMatches(r32.teamB, groupLetter, 1)
      || slotMatches(r32.teamB, groupLetter, 2)
      || slotMatches(r32.teamB, groupLetter, 3)) {
      entries.push({ r32MatchId: r32.matchId, groupPlace: r32.teamB.place });
    }
  }

  const seen = new Set<string>();
  return entries.filter((e) => {
    const key = `${e.r32MatchId}|${e.groupPlace}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tracePathMatchIds(entry: KnockoutEntry): Set<string> {
  const path = new Set<string>([entry.r32MatchId]);
  let current = entry.r32MatchId;

  while (WINNER_ADVANCEMENT[current]) {
    const next = WINNER_ADVANCEMENT[current];
    path.add(next);
    if (next.startsWith('qf-m')) break;
    current = next;
  }

  return path;
}

function traceQuarterFinal(entry: KnockoutEntry): string | null {
  let current = entry.r32MatchId;
  while (WINNER_ADVANCEMENT[current]) {
    const next = WINNER_ADVANCEMENT[current];
    if (next.startsWith('qf-m')) return next;
    current = next;
  }
  return null;
}

function pathsIntersectBeforeQuarterFinal(a: KnockoutEntry, b: KnockoutEntry): boolean {
  const pathA = tracePathMatchIds(a);
  for (const id of tracePathMatchIds(b)) {
    if (pathA.has(id)) return true;
  }
  return false;
}

/** Both teams could win their group and meet before the quarter-finals. */
export function hasGroupWinnerPathCollision(teamAId: string, teamBId: string): boolean {
  if (norm(teamAId) === norm(teamBId)) return true;

  const letterA = getGroupLetter(teamAId);
  const letterB = getGroupLetter(teamBId);
  if (!letterA || !letterB) return false;

  const winnersA = getPossibleEntries(letterA).filter((e) => e.groupPlace === 1);
  const winnersB = getPossibleEntries(letterB).filter((e) => e.groupPlace === 1);

  for (const entryA of winnersA) {
    for (const entryB of winnersB) {
      if (pathsIntersectBeforeQuarterFinal(entryA, entryB)) return true;
    }
  }

  return false;
}

export function hasEarlyBracketCollision(teamAId: string, teamBId: string): boolean {
  if (norm(teamAId) === norm(teamBId)) return true;

  const letterA = getGroupLetter(teamAId);
  const letterB = getGroupLetter(teamBId);
  if (!letterA || !letterB) return false;

  for (const entryA of getPossibleEntries(letterA)) {
    for (const entryB of getPossibleEntries(letterB)) {
      if (pathsIntersectBeforeQuarterFinal(entryA, entryB)) return true;
    }
  }

  return false;
}

function tryAssignDistinctQuarterFinals(
  teamIds: string[],
  index: number,
  chosen: KnockoutEntry[],
  usedQuarterFinals: Set<string>,
): boolean {
  if (index >= teamIds.length) return usedQuarterFinals.size === QUARTER_FINAL_IDS.length;

  const letter = getGroupLetter(teamIds[index]);
  if (!letter) return false;

  for (const entry of getPossibleEntries(letter)) {
    const qf = traceQuarterFinal(entry);
    if (!qf || usedQuarterFinals.has(qf)) continue;

    if (chosen.slice(0, index).some((prev) => pathsIntersectBeforeQuarterFinal(prev, entry))) {
      continue;
    }

    chosen[index] = entry;
    usedQuarterFinals.add(qf);
    if (tryAssignDistinctQuarterFinals(teamIds, index + 1, chosen, usedQuarterFinals)) return true;
    usedQuarterFinals.delete(qf);
  }

  return false;
}

export function canAllReachSemifinals(teamIds: string[]): boolean {
  if (teamIds.length !== 4) return false;

  for (let i = 0; i < teamIds.length; i += 1) {
    for (let j = i + 1; j < teamIds.length; j += 1) {
      if (hasGroupWinnerPathCollision(teamIds[i], teamIds[j])) return false;
    }
  }

  return tryAssignDistinctQuarterFinals(teamIds, 0, [], new Set());
}

export function wouldBreakSemifinalPaths(currentTeamIds: string[], candidateTeamId: string): boolean {
  const next = [...currentTeamIds, candidateTeamId];
  if (next.length < 2) return false;

  for (const id of currentTeamIds) {
    if (hasGroupWinnerPathCollision(id, candidateTeamId)) return true;
  }

  if (next.length < 4) return false;
  return !canAllReachSemifinals(next);
}

export function findCollisionPartner(
  teamIds: string[],
  candidateTeamId: string,
): string | null {
  for (const id of teamIds) {
    if (hasGroupWinnerPathCollision(id, candidateTeamId)) return id;
  }
  return null;
}
