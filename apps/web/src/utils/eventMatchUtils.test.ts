import { describe, expect, it } from 'vitest';
import { arePredictionsOpen, parseKickoffUtc } from './eventMatchUtils';
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
});
