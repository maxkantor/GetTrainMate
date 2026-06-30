import { describe, expect, it } from 'vitest';
import { buildKnockoutBracketView } from '@/utils/buildKnockoutBracketView';
import type { EventMatch, EventTeam } from '@/services/sportsEventLayerService';

const team = (id: string, name: string): EventTeam => ({
  eventId: 'world-cup-2026',
  teamId: id,
  name,
  country: name,
  flagEmoji: '🏳️',
  groupId: 'group-e',
  sortOrder: 1,
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDifference: 0,
  points: 0,
});

const knockout = (partial: Partial<EventMatch> & Pick<EventMatch, 'matchId' | 'teamAId' | 'teamBId'>): EventMatch => ({
  eventId: 'world-cup-2026',
  matchId: partial.matchId,
  teamAId: partial.teamAId,
  teamBId: partial.teamBId,
  teamAName: partial.teamAName ?? partial.teamAId,
  teamBName: partial.teamBName ?? partial.teamBId,
  status: partial.status ?? 'Scheduled',
  stage: partial.stage ?? 'Round of 16',
  scoreA: partial.scoreA,
  scoreB: partial.scoreB,
  winnerTeamId: partial.winnerTeamId,
  groupId: undefined,
  matchDate: partial.matchDate ?? '',
  venue: partial.venue ?? '',
});

describe('buildKnockoutBracketView', () => {
  it('marks winner and loser after a completed match', () => {
    const matches = [
      knockout({
        matchId: 'r16-m01',
        teamAId: 'germany',
        teamBId: 'france',
        teamAName: 'Germany',
        teamBName: 'France',
        status: 'Completed',
        scoreA: 2,
        scoreB: 1,
      }),
    ];
    const teams = [team('germany', 'Germany'), team('france', 'France')];
    const view = buildKnockoutBracketView(matches, teams);
    const r16 = view.find((c) => c.matchId === 'r16-m01');

    expect(r16?.teamA.isWinner).toBe(true);
    expect(r16?.teamB.isLoser).toBe(true);
    expect(r16?.scoreA).toBe(2);
  });

  it('marks penalty winner when full-time is tied', () => {
    const matches = [
      knockout({
        matchId: 'r32-m03',
        teamAId: 'germany',
        teamBId: 'paraguay',
        teamAName: 'Germany',
        teamBName: 'Paraguay',
        status: 'Completed',
        scoreA: 1,
        scoreB: 1,
        winnerTeamId: 'paraguay',
      }),
    ];
    const teams = [team('germany', 'Germany'), team('paraguay', 'Paraguay')];
    const view = buildKnockoutBracketView(matches, teams);
    const cell = view.find((c) => c.matchId === 'r32-m03');

    expect(cell?.teamB.isWinner).toBe(true);
    expect(cell?.teamA.isLoser).toBe(true);
    expect(cell?.decidedOnPenalties).toBe(true);
  });

  it('renders all bracket slots including final', () => {
    const view = buildKnockoutBracketView([], []);
    expect(view.some((c) => c.matchId === 'final')).toBe(true);
    expect(view.some((c) => c.matchId === 'r32-m03')).toBe(true);
    expect(view.length).toBeGreaterThanOrEqual(30);
  });
});
