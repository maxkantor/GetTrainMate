import type { EventMatch } from '@/services/sportsEventLayerService';

export function parseKickoffUtc(matchDate?: string, matchTime?: string): number | null {
  if (!matchDate?.trim() || !matchTime?.trim()) return null;
  const time = matchTime.trim();
  const iso = `${matchDate.trim()}T${time.length === 5 ? `${time}:00` : time}Z`;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

export function arePredictionsOpen(match: EventMatch): boolean {
  if (match.predictionsOpen === false) return false;
  if (match.status === 'Completed' || match.status === 'Live') return false;
  const kickoff = parseKickoffUtc(match.matchDate, match.matchTime);
  if (kickoff != null && kickoff <= Date.now()) return false;
  return true;
}

export function formatMatchMeta(match: EventMatch): string {
  const parts = [
    match.matchDate?.trim(),
    match.matchTime?.trim(),
    match.venue?.trim(),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '';
}

export function formatLastUpdated(iso?: string | null): string | null {
  if (!iso?.trim()) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(ms));
}
