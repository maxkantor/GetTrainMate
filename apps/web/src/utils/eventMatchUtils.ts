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

/** "Today" in the viewer's local timezone — kickoffs are stored in UTC. */
export function isMatchToday(match: EventMatch): boolean {
  const kickoff = parseKickoffUtc(match.matchDate, match.matchTime);
  if (kickoff != null) {
    const k = new Date(kickoff);
    const now = new Date();
    return k.getFullYear() === now.getFullYear()
      && k.getMonth() === now.getMonth()
      && k.getDate() === now.getDate();
  }
  if (!match.matchDate?.trim()) return false;
  return match.matchDate.trim() === new Date().toISOString().slice(0, 10);
}

/** Ascending chronological order: soonest kickoff first; undated TBD slots last (by stage). */
export function compareMatchesChronological(a: EventMatch, b: EventMatch): number {
  const kickA = parseKickoffUtc(a.matchDate, a.matchTime);
  const kickB = parseKickoffUtc(b.matchDate, b.matchTime);
  const keyA = kickA ?? Number.MAX_SAFE_INTEGER;
  const keyB = kickB ?? Number.MAX_SAFE_INTEGER;
  if (keyA !== keyB) return keyA - keyB;
  const stage = stageOrder(a) - stageOrder(b);
  if (stage !== 0) return stage;
  return a.matchId.localeCompare(b.matchId);
}

export function categorizeMatches(matches: EventMatch[]) {
  const today: EventMatch[] = [];
  const upcoming: EventMatch[] = [];
  const completed: EventMatch[] = [];
  for (const m of matches) {
    if (m.status === 'Completed') completed.push(m);
    else if (m.status === 'Live' || isMatchToday(m)) today.push(m);
    else upcoming.push(m);
  }
  today.sort(compareMatchesChronological);
  upcoming.sort(compareMatchesChronological);
  completed.sort((a, b) => -compareMatchesChronological(a, b));
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
