import { describe, expect, it } from 'vitest';
import { arePredictionsOpen, categorizeMatches, compareMatchesChronological, parseKickoffUtc } from './eventMatchUtils';
import type { EventMatch } from '@/services/sportsEventLayerService';

describe('eventMatchUtils', () => {
  it('arePredictionsOpen is false for completed matches', () => {
    const match = { status: 'Completed' } as EventMatch;
    expect(arePredictionsOpen(match)).toBe(false);
  });

  it('arePredictionsOpen is false when manually locked', () => {
    const match = { status: 'Scheduled', predictionsOpen: false } as EventMatch;
    expect(arePredictionsOpen(match)).toBe(false);
  });

  it('arePredictionsOpen is false after kickoff', () => {
    const past = new Date(Date.now() - 3600000);
    const match = {
      status: 'Scheduled',
      matchDate: past.toISOString().slice(0, 10),
      matchTime: past.toISOString().slice(11, 16),
    } as EventMatch;
    expect(arePredictionsOpen(match)).toBe(false);
  });

  it('parseKickoffUtc returns null without time', () => {
    expect(parseKickoffUtc('2026-06-11', '')).toBeNull();
  });

  it('compareMatchesChronological puts dated fixtures before undated knockout TBD slots', () => {
    const group = {
      matchId: 'gs-a',
      status: 'Scheduled',
      groupId: 'group-a',
      matchDate: '2026-06-18',
      matchTime: '16:00',
    } as EventMatch;
    const final = {
      matchId: 'final',
      status: 'Scheduled',
      stage: 'Final',
      teamAId: 'tbd-final-a',
      teamBId: 'tbd-final-b',
    } as EventMatch;
    expect(compareMatchesChronological(group, final)).toBeLessThan(0);
  });

  it('categorizeMatches upcoming lists soonest kickoffs first and Final last among TBD', () => {
    const matches = [
      { matchId: 'final', status: 'Scheduled', stage: 'Final', teamAId: 'tbd-a', teamBId: 'tbd-b' },
      { matchId: 'r16-1', status: 'Scheduled', stage: 'Round of 16', teamAId: 'tbd-a', teamBId: 'tbd-b' },
      { matchId: 'gs-late', status: 'Scheduled', groupId: 'group-l', matchDate: '2026-06-27', matchTime: '21:00' },
      { matchId: 'gs-soon', status: 'Scheduled', groupId: 'group-b', matchDate: '2026-06-12', matchTime: '19:00' },
    ] as EventMatch[];
    const { upcoming } = categorizeMatches(matches);
    expect(upcoming.map((m) => m.matchId)).toEqual(['gs-soon', 'gs-late', 'r16-1', 'final']);
  });
});
