import { describe, expect, it } from 'vitest';
import { arePredictionsOpen, categorizeMatches, compareMatchesChronological, parseKickoffUtc } from './eventMatchUtils';
import type { EventMatch } from '@/services/sportsEventLayerService';

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
      matchFixture({ matchId: 'gs-late', groupId: 'group-l', matchDate: '2026-06-27', matchTime: '21:00' }),
      matchFixture({ matchId: 'gs-soon', groupId: 'group-b', matchDate: '2026-06-12', matchTime: '19:00' }),
    ];
    const { upcoming } = categorizeMatches(matches);
    expect(upcoming.map((m) => m.matchId)).toEqual(['gs-soon', 'gs-late', 'r16-1', 'final']);
  });
});
