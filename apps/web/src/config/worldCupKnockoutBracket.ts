/** FIFA 2026 knockout bracket — keep in sync with WorldCupKnockoutBracket.cs */

export type GroupSlot = { place: 1 | 2 | 3; group: string };

export type BracketMatch = {
  matchId: string;
  teamA: GroupSlot;
  teamB: GroupSlot;
};

export type Advancement = {
  fromMatchId: string;
  toMatchId: string;
};

export const ROUND_OF_32: BracketMatch[] = [
  { matchId: 'r32-m01', teamA: { place: 2, group: 'A' }, teamB: { place: 2, group: 'B' } },
  { matchId: 'r32-m02', teamA: { place: 1, group: 'C' }, teamB: { place: 2, group: 'F' } },
  { matchId: 'r32-m03', teamA: { place: 1, group: 'E' }, teamB: { place: 3, group: 'D' } },
  { matchId: 'r32-m04', teamA: { place: 1, group: 'F' }, teamB: { place: 2, group: 'C' } },
  { matchId: 'r32-m05', teamA: { place: 2, group: 'E' }, teamB: { place: 2, group: 'I' } },
  { matchId: 'r32-m06', teamA: { place: 1, group: 'I' }, teamB: { place: 3, group: 'F' } },
  { matchId: 'r32-m07', teamA: { place: 1, group: 'A' }, teamB: { place: 3, group: 'E' } },
  { matchId: 'r32-m08', teamA: { place: 1, group: 'L' }, teamB: { place: 3, group: 'K' } },
  { matchId: 'r32-m09', teamA: { place: 1, group: 'G' }, teamB: { place: 3, group: 'I' } },
  { matchId: 'r32-m10', teamA: { place: 1, group: 'D' }, teamB: { place: 3, group: 'B' } },
  { matchId: 'r32-m11', teamA: { place: 1, group: 'H' }, teamB: { place: 2, group: 'J' } },
  { matchId: 'r32-m12', teamA: { place: 2, group: 'K' }, teamB: { place: 2, group: 'L' } },
  { matchId: 'r32-m13', teamA: { place: 1, group: 'B' }, teamB: { place: 3, group: 'J' } },
  { matchId: 'r32-m14', teamA: { place: 1, group: 'J' }, teamB: { place: 2, group: 'H' } },
  { matchId: 'r32-m15', teamA: { place: 2, group: 'D' }, teamB: { place: 2, group: 'G' } },
  { matchId: 'r32-m16', teamA: { place: 1, group: 'K' }, teamB: { place: 3, group: 'L' } },
];

export const ADVANCEMENTS: Advancement[] = [
  { fromMatchId: 'r32-m01', toMatchId: 'r16-m02' },
  { fromMatchId: 'r32-m04', toMatchId: 'r16-m02' },
  { fromMatchId: 'r32-m03', toMatchId: 'r16-m01' },
  { fromMatchId: 'r32-m06', toMatchId: 'r16-m01' },
  { fromMatchId: 'r32-m02', toMatchId: 'r16-m03' },
  { fromMatchId: 'r32-m05', toMatchId: 'r16-m03' },
  { fromMatchId: 'r32-m07', toMatchId: 'r16-m04' },
  { fromMatchId: 'r32-m08', toMatchId: 'r16-m04' },
  { fromMatchId: 'r32-m12', toMatchId: 'r16-m05' },
  { fromMatchId: 'r32-m11', toMatchId: 'r16-m05' },
  { fromMatchId: 'r32-m10', toMatchId: 'r16-m06' },
  { fromMatchId: 'r32-m09', toMatchId: 'r16-m06' },
  { fromMatchId: 'r32-m14', toMatchId: 'r16-m07' },
  { fromMatchId: 'r32-m15', toMatchId: 'r16-m07' },
  { fromMatchId: 'r32-m13', toMatchId: 'r16-m08' },
  { fromMatchId: 'r32-m16', toMatchId: 'r16-m08' },
  { fromMatchId: 'r16-m01', toMatchId: 'qf-m01' },
  { fromMatchId: 'r16-m02', toMatchId: 'qf-m01' },
  { fromMatchId: 'r16-m05', toMatchId: 'qf-m02' },
  { fromMatchId: 'r16-m06', toMatchId: 'qf-m02' },
  { fromMatchId: 'r16-m07', toMatchId: 'qf-m03' },
  { fromMatchId: 'r16-m08', toMatchId: 'qf-m03' },
  { fromMatchId: 'r16-m03', toMatchId: 'qf-m04' },
  { fromMatchId: 'r16-m04', toMatchId: 'qf-m04' },
  { fromMatchId: 'qf-m01', toMatchId: 'sf-m01' },
  { fromMatchId: 'qf-m02', toMatchId: 'sf-m01' },
  { fromMatchId: 'qf-m04', toMatchId: 'sf-m02' },
  { fromMatchId: 'qf-m03', toMatchId: 'sf-m02' },
  { fromMatchId: 'sf-m01', toMatchId: 'final' },
  { fromMatchId: 'sf-m02', toMatchId: 'final' },
];
