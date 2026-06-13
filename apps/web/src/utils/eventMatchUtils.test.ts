import { describe, expect, it } from 'vitest';
import {
  arePredictionsOpen,
  categorizeMatches,
  compareMatchesChronological,
  computeStandingsFromMatches,
  formatKickoffFriendly,
  formatKickoffCompact,
  formatKickoffCard,
  isMatchUpcoming,
  parseKickoffUtc,
} from './eventMatchUtils';
import type { EventMatch, EventTeam } from '@/services/sportsEventLayerService';

function matchFixture(overrides: Partial<EventMatch> & Pick<EventMatch, 'matchId'>): EventMatch {
  return {
    eventId: 'world-cup-2026',
    teamAId: 'team-a',
    teamBId: 'team-b',
    matchDate: '',
    venue: '',
    status: 'Scheduled',
    ...overrides,
  };
}

describe('eventMatchUtils', () => {
  it('arePredictionsOpen is false for completed matches', () => {
    const match = matchFixture({ matchId: 'm1', status: 'Completed' });
    expect(arePredictionsOpen(match)).toBe(false);
  });

  it('arePredictionsOpen is false when manually locked', () => {
    const match = matchFixture({ matchId: 'm2', predictionsOpen: false });
    expect(arePredictionsOpen(match)).toBe(false);
  });

  it('isMatchUpcoming is false after kickoff even if status is still Scheduled', () => {
    const past = new Date(Date.now() - 3600000);
    const match = matchFixture({
      matchId: 'm-past',
      matchDate: past.toISOString().slice(0, 10),
      matchTime: past.toISOString().slice(11, 16),
    });
    expect(isMatchUpcoming(match)).toBe(false);
  });

  it('arePredictionsOpen is false after kickoff', () => {
    const past = new Date(Date.now() - 3600000);
    const match = matchFixture({
      matchId: 'm3',
      matchDate: past.toISOString().slice(0, 10),
      matchTime: past.toISOString().slice(11, 16),
    });
    expect(arePredictionsOpen(match)).toBe(false);
  });

  it('parseKickoffUtc returns null without time', () => {
    expect(parseKickoffUtc('2026-06-11', '')).toBeNull();
  });

  it('formatKickoffFriendly includes weekday, month, day, and time', () => {
    const label = formatKickoffFriendly('2030-06-12', '19:00');
    expect(label).toBeTruthy();
    expect(label).toMatch(/at \d/);
    expect(label).toMatch(/June|Jun/);
    expect(label).toMatch(/12/);
    expect(label).toMatch(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/i);
  });

  it('formatKickoffCompact is one line with local timezone hint', () => {
    const label = formatKickoffCompact('2030-06-12', '19:00');
    expect(label).toBeTruthy();
    expect(label).not.toMatch(/\n/);
    expect(label).toMatch(/·/);
    expect(label).toMatch(/\d/);
  });

  it('formatKickoffCard splits date and time labels', () => {
    const card = formatKickoffCard('2030-06-12', '19:00');
    expect(card).toBeTruthy();
    expect(card!.dateLabel.length).toBeGreaterThan(0);
    expect(card!.timeLabel).toMatch(/\d/);
    expect(card!.fullLabel).toContain(card!.dateLabel);
  });

  it('compareMatchesChronological puts dated fixtures before undated knockout TBD slots', () => {
    const group = matchFixture({
      matchId: 'gs-a',
      groupId: 'group-a',
      matchDate: '2026-06-18',
      matchTime: '16:00',
    });
    const final = matchFixture({
      matchId: 'final',
      stage: 'Final',
      teamAId: 'tbd-final-a',
      teamBId: 'tbd-final-b',
    });
    expect(compareMatchesChronological(group, final)).toBeLessThan(0);
  });

  it('categorizeMatches upcoming lists soonest kickoffs first and Final last among TBD', () => {
    const matches = [
      matchFixture({ matchId: 'final', stage: 'Final', teamAId: 'tbd-a', teamBId: 'tbd-b' }),
      matchFixture({ matchId: 'r16-1', stage: 'Round of 16', teamAId: 'tbd-a', teamBId: 'tbd-b' }),
      matchFixture({ matchId: 'gs-late', groupId: 'group-l', matchDate: '2030-06-27', matchTime: '21:00' }),
      matchFixture({ matchId: 'gs-soon', groupId: 'group-b', matchDate: '2030-06-12', matchTime: '19:00' }),
    ];
    const { upcoming } = categorizeMatches(matches);
    expect(upcoming.map((m) => m.matchId)).toEqual(['gs-soon', 'gs-late', 'r16-1', 'final']);
  });

  it('computeStandingsFromMatches reflects completed group fixtures', () => {
    const teams: EventTeam[] = [
      {
        eventId: 'world-cup-2026', teamId: 'canada', name: 'Canada', country: 'Canada',
        flagEmoji: '🇨🇦', groupId: 'group-b', sortOrder: 0, played: 0, wins: 0, draws: 0, losses: 0,
        goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
      },
      {
        eventId: 'world-cup-2026', teamId: 'bosnia-herzegovina', name: 'Bosnia', country: 'Bosnia',
        flagEmoji: '🇧🇦', groupId: 'group-b', sortOrder: 1, played: 0, wins: 0, draws: 0, losses: 0,
        goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
      },
    ];
    const matches: EventMatch[] = [
      matchFixture({
        matchId: 'gs-canada-vs-bosnia-herzegovina',
        teamAId: 'canada',
        teamBId: 'bosnia-herzegovina',
        groupId: 'group-b',
        status: 'Completed',
        scoreA: 1,
        scoreB: 1,
      }),
    ];
    const standings = computeStandingsFromMatches(teams, matches);
    const canada = standings.find((t) => t.teamId === 'canada');
    const bosnia = standings.find((t) => t.teamId === 'bosnia-herzegovina');
    expect(canada?.played).toBe(1);
    expect(canada?.draws).toBe(1);
    expect(canada?.points).toBe(1);
    expect(canada?.goalsFor).toBe(1);
    expect(bosnia?.played).toBe(1);
    expect(bosnia?.points).toBe(1);
  });
});
