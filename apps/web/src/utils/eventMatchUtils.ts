import type { EventMatch } from '@/services/sportsEventLayerService';

export function parseKickoffUtc(matchDate?: string, matchTime?: string): number | null {
  if (!matchDate?.trim() || !matchTime?.trim()) return null;
  const time = matchTime.trim();
  const iso = `${matchDate.trim()}T${time.length === 5 ? `${time}:00` : time}Z`;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

export function arePredictionsOpen(match: EventMatch): boolean {
  if (match.predictionsLocked) return false;
  if (match.predictionsOpen === false) return false;
  if (match.status === 'Completed' || match.status === 'Live' || match.status === 'Postponed') return false;
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

export function isMatchToday(match: EventMatch): boolean {
  if (!match.matchDate?.trim()) return false;
  const today = new Date().toISOString().slice(0, 10);
  return match.matchDate.trim() === today;
}

export function categorizeMatches(matches: EventMatch[]) {
  const today: EventMatch[] = [];
  const upcoming: EventMatch[] = [];
  const completed: EventMatch[] = [];
  for (const m of matches) {
    if (m.status === 'Completed') completed.push(m);
    else if (m.status === 'Live' || isMatchToday(m)) today.push(m);
    else if (m.status === 'Scheduled') upcoming.push(m);
    else upcoming.push(m);
  }
  const sortKey = (m: EventMatch) => `${m.matchDate ?? ''}${m.matchTime ?? ''}`;
  today.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  upcoming.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  completed.sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  return { today, upcoming, completed };
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
