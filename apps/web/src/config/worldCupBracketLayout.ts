/** Visual grid placement for the FIFA 2026 knockout tree (left → center → right). */

export type BracketGridSlot = {
  matchId: string;
  col: number;
  row: number;
  rowSpan?: number;
};

/** Nine columns: R32-L, R16-L, QF-L, SF-L, center, SF-R, QF-R, R16-R, R32-R */
export const BRACKET_GRID_COLUMNS = 9;
export const BRACKET_GRID_ROWS = 10;

export const BRACKET_GRID_SLOTS: BracketGridSlot[] = [
  // Left — top quarter (qf-m01)
  { matchId: 'r32-m03', col: 0, row: 1 },
  { matchId: 'r32-m06', col: 0, row: 2 },
  { matchId: 'r16-m01', col: 1, row: 1, rowSpan: 2 },
  { matchId: 'r32-m01', col: 0, row: 3 },
  { matchId: 'r32-m04', col: 0, row: 4 },
  { matchId: 'r16-m02', col: 1, row: 3, rowSpan: 2 },
  { matchId: 'qf-m01', col: 2, row: 1, rowSpan: 4 },

  // Left — bottom quarter (qf-m02)
  { matchId: 'r32-m12', col: 0, row: 5 },
  { matchId: 'r32-m11', col: 0, row: 6 },
  { matchId: 'r16-m05', col: 1, row: 5, rowSpan: 2 },
  { matchId: 'r32-m10', col: 0, row: 7 },
  { matchId: 'r32-m09', col: 0, row: 8 },
  { matchId: 'r16-m06', col: 1, row: 7, rowSpan: 2 },
  { matchId: 'qf-m02', col: 2, row: 5, rowSpan: 4 },

  { matchId: 'sf-m01', col: 3, row: 1, rowSpan: 8 },

  // Center
  { matchId: 'final', col: 4, row: 3, rowSpan: 4 },
  { matchId: 'third-place', col: 4, row: 9, rowSpan: 2 },

  // Right — top quarter (qf-m04)
  { matchId: 'sf-m02', col: 5, row: 1, rowSpan: 8 },
  { matchId: 'qf-m04', col: 6, row: 1, rowSpan: 4 },
  { matchId: 'r16-m03', col: 7, row: 1, rowSpan: 2 },
  { matchId: 'r32-m02', col: 8, row: 1 },
  { matchId: 'r32-m05', col: 8, row: 2 },
  { matchId: 'r16-m04', col: 7, row: 3, rowSpan: 2 },
  { matchId: 'r32-m07', col: 8, row: 3 },
  { matchId: 'r32-m08', col: 8, row: 4 },

  // Right — bottom quarter (qf-m03)
  { matchId: 'qf-m03', col: 6, row: 5, rowSpan: 4 },
  { matchId: 'r16-m07', col: 7, row: 5, rowSpan: 2 },
  { matchId: 'r32-m14', col: 8, row: 5 },
  { matchId: 'r32-m15', col: 8, row: 6 },
  { matchId: 'r16-m08', col: 7, row: 7, rowSpan: 2 },
  { matchId: 'r32-m13', col: 8, row: 7 },
  { matchId: 'r32-m16', col: 8, row: 8 },
];

export const BRACKET_COLUMN_LABELS: { col: number; labelKey: string }[] = [
  { col: 0, labelKey: 'event_hub.bracket_col_r32' },
  { col: 1, labelKey: 'event_hub.bracket_col_r16' },
  { col: 2, labelKey: 'event_hub.bracket_col_qf' },
  { col: 3, labelKey: 'event_hub.bracket_col_sf' },
  { col: 4, labelKey: 'event_hub.bracket_col_final' },
  { col: 5, labelKey: 'event_hub.bracket_col_sf' },
  { col: 6, labelKey: 'event_hub.bracket_col_qf' },
  { col: 7, labelKey: 'event_hub.bracket_col_r16' },
  { col: 8, labelKey: 'event_hub.bracket_col_r32' },
];
