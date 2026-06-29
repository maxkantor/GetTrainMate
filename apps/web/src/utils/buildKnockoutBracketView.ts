import type { EventMatch, EventTeam } from '@/services/sportsEventLayerService';
import { BRACKET_GRID_SLOTS } from '@/config/worldCupBracketLayout';
import { isTbdTeamId } from '@/utils/eventMatchUtils';

export type BracketTeamSide = {
  teamId: string;
  name: string;
  flagEmoji?: string;
  isWinner: boolean;
  isLoser: boolean;
  isTbd: boolean;
};

export type BracketMatchView = {
  matchId: string;
  col: number;
  row: number;
  rowSpan: number;
  teamA: BracketTeamSide;
  teamB: BracketTeamSide;
  scoreA?: number;
  scoreB?: number;
  status: EventMatch['status'];
  isLive: boolean;
  isCompleted: boolean;
  stage: string;
  matchDate?: string;
  matchTime?: string;
};

function norm(id: string) {
  return id.trim().toLowerCase();
}

function getWinnerId(match: EventMatch): string | null {
  if (match.status !== 'Completed' || match.scoreA == null || match.scoreB == null) return null;
  if (match.scoreA > match.scoreB) return match.teamAId;
  if (match.scoreB > match.scoreA) return match.teamBId;
  return null;
}

function buildSide(
  teamId: string,
  name: string,
  flagEmoji: string | undefined,
  winnerId: string | null,
): BracketTeamSide {
  const tbd = isTbdTeamId(teamId);
  const isWinner = winnerId != null && norm(winnerId) === norm(teamId);
  const isLoser = winnerId != null && !tbd && norm(winnerId) !== norm(teamId);
  return {
    teamId,
    name: tbd ? 'TBD' : name,
    flagEmoji: tbd ? undefined : flagEmoji,
    isWinner,
    isLoser,
    isTbd: tbd,
  };
}

function enrichMatch(
  slot: typeof BRACKET_GRID_SLOTS[number],
  match: EventMatch | undefined,
  teamById: Map<string, EventTeam>,
): BracketMatchView {
  const winnerId = match ? getWinnerId(match) : null;
  const teamAId = match?.teamAId ?? `tbd-${slot.matchId}-a`;
  const teamBId = match?.teamBId ?? `tbd-${slot.matchId}-b`;
  const teamA = teamById.get(norm(teamAId));
  const teamB = teamById.get(norm(teamBId));

  const kickoffPassed = match?.status === 'Scheduled'
    && match.matchDate?.trim()
    && match.matchTime?.trim()
    && Date.parse(`${match.matchDate}T${match.matchTime.length === 5 ? `${match.matchTime}:00` : match.matchTime}Z`) <= Date.now();

  return {
    matchId: slot.matchId,
    col: slot.col,
    row: slot.row,
    rowSpan: slot.rowSpan ?? 1,
    teamA: buildSide(teamAId, match?.teamAName ?? teamA?.name ?? 'TBD', match?.teamAFlag ?? teamA?.flagEmoji, winnerId),
    teamB: buildSide(teamBId, match?.teamBName ?? teamB?.name ?? 'TBD', match?.teamBFlag ?? teamB?.flagEmoji, winnerId),
    scoreA: match?.scoreA ?? undefined,
    scoreB: match?.scoreB ?? undefined,
    status: match?.status ?? 'Scheduled',
    isLive: match?.status === 'Live' || Boolean(kickoffPassed && match?.status === 'Scheduled'),
    isCompleted: match?.status === 'Completed',
    stage: match?.stage ?? '',
    matchDate: match?.matchDate,
    matchTime: match?.matchTime,
  };
}

/** Knockout bracket cells for the visual tree — derived from hub matches (updates after each result). */
export function buildKnockoutBracketView(
  matches: EventMatch[],
  teams: EventTeam[],
): BracketMatchView[] {
  const knockoutById = new Map<string, EventMatch>();
  for (const m of matches) {
    if (m.groupId?.trim()) continue;
    if (m.matchId?.trim()) knockoutById.set(norm(m.matchId), m);
  }

  const teamById = new Map(teams.map((t) => [norm(t.teamId), t]));

  return BRACKET_GRID_SLOTS.map((slot) =>
    enrichMatch(slot, knockoutById.get(norm(slot.matchId)), teamById));
}

export function countKnownKnockoutTeams(view: BracketMatchView[]): number {
  const ids = new Set<string>();
  for (const cell of view) {
    for (const side of [cell.teamA, cell.teamB]) {
      if (!side.isTbd) ids.add(norm(side.teamId));
    }
  }
  return ids.size;
}
