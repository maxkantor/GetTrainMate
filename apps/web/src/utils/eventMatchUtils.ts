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

/** Knockout placeholder slots seeded by the API until real qualifiers are assigned. */
export function isTbdMatch(match: EventMatch): boolean {
  return match.teamAId.startsWith('tbd-') || match.teamBId.startsWith('tbd-');
}

const STAGE_ORDER: Record<string, number> = {
  'opening match': 0,
  'group stage': 0,
  'round of 32': 1,
  'round of 16': 2,
  'quarter-final': 3,
  'semi-final': 4,
  'third-place match': 5,
  'final': 6,
};

const STAGE_I18N_KEY: Record<string, string> = {
  'opening match': 'event_hub.stage_group',
  'group stage': 'event_hub.stage_group',
  'round of 32': 'event_hub.stage_r32',
  'round of 16': 'event_hub.stage_r16',
  'quarter-final': 'event_hub.stage_qf',
  'semi-final': 'event_hub.stage_sf',
  'third-place match': 'event_hub.stage_third',
  'final': 'event_hub.stage_final',
};

/** Group-stage matches (anything with a groupId) sort before knockout rounds. */
export function stageOrder(match: EventMatch): number {
  if (match.groupId?.trim()) return 0;
  return STAGE_ORDER[(match.stage ?? '').trim().toLowerCase()] ?? 0;
}

export function stageI18nKey(match: EventMatch): string | null {
  if (match.groupId?.trim()) return 'event_hub.stage_group';
  return STAGE_I18N_KEY[(match.stage ?? '').trim().toLowerCase()] ?? null;
}

export function formatMatchMeta(match: EventMatch): string {
  const kickoff = parseKickoffUtc(match.matchDate, match.matchTime);
  if (kickoff != null) {
    const local = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(kickoff));
    return [local, match.venue?.trim()].filter(Boolean).join(' · ');
  }
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
