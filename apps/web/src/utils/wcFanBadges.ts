export type WcFanBadgeKind = 'fan' | 'expert' | 'elite';

export function resolveWcFanBadge(
  predictionsCount: number,
  leaderboardRank?: number | null,
): WcFanBadgeKind | null {
  if (leaderboardRank != null && leaderboardRank >= 1 && leaderboardRank <= 3) return 'elite';
  if (predictionsCount >= 10) return 'expert';
  if (predictionsCount >= 1) return 'fan';
  return null;
}
