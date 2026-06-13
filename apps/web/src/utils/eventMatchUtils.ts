import type { EventMatch, EventTeam } from '@/services/sportsEventLayerService';
import { WORLD_CUP_SCORE_OVERRIDES } from '@/data/worldCupOfficial';

export function parseKickoffUtc(matchDate?: string, matchTime?: string): number | null {
  if (!matchDate?.trim() || !matchTime?.trim()) return null;
  const time = matchTime.trim();
  const iso = `${matchDate.trim()}T${time.length === 5 ? `${time}:00` : time}Z`;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/** True when a fixture has not started and predictions are still open. */
export function isMatchUpcoming(match: EventMatch): boolean {
  return match.status === 'Scheduled' && arePredictionsOpen(match);
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

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatLocalKickoffTime(d: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(d);
}

/** User-friendly local kickoff, e.g. "Friday, June 12 at 7:00 PM" or "Today at 3:00 PM". */
export function formatKickoffFriendly(matchDate?: string, matchTime?: string): string | null {
  const kickoff = parseKickoffUtc(matchDate, matchTime);
  if (kickoff == null) return null;

  const d = new Date(kickoff);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const timeStr = formatLocalKickoffTime(d);

  if (isSameLocalDay(d, now)) return `Today at ${timeStr}`;
  if (isSameLocalDay(d, tomorrow)) return `Tomorrow at ${timeStr}`;

  const dateStr = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(d);

  return `${dateStr} at ${timeStr}`;
}

export type KickoffCardLabels = {
  dateLabel: string;
  timeLabel: string;
  /** Single line for title/tooltip */
  fullLabel: string;
};

/** Card kickoff labels in the viewer's local timezone (date row + time+TZ row). */
export function formatKickoffCard(matchDate?: string, matchTime?: string): KickoffCardLabels | null {
  const kickoff = parseKickoffUtc(matchDate, matchTime);
  if (kickoff == null) return null;

  const d = new Date(kickoff);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const timeParts = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).formatToParts(d);
  const clock = timeParts
    .filter((p) => p.type === 'hour' || p.type === 'minute' || p.type === 'dayPeriod' || p.type === 'literal')
    .map((p) => p.value)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  const tz = timeParts.find((p) => p.type === 'timeZoneName')?.value ?? '';

  let dateLabel: string;
  if (isSameLocalDay(d, now)) dateLabel = 'Today';
  else if (isSameLocalDay(d, tomorrow)) dateLabel = 'Tomorrow';
  else {
    dateLabel = new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(d);
  }

  const timeLabel = tz ? `${clock} ${tz}` : clock;
  const fullLabel = `${dateLabel} · ${timeLabel}`;
  return { dateLabel, timeLabel, fullLabel };
}

/** One-line card kickoff in the viewer's timezone, e.g. "Thu, Jun 18 · 7:00 PM EDT". */
export function formatKickoffCompact(matchDate?: string, matchTime?: string): string | null {
  return formatKickoffCard(matchDate, matchTime)?.fullLabel ?? null;
}

export function formatMatchMeta(match: EventMatch): string {
  const friendly = formatKickoffCompact(match.matchDate, match.matchTime);
  if (friendly) {
    return [friendly, match.venue?.trim()].filter(Boolean).join(' · ');
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

const sameTeam = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const pairKey = (teamAId: string, teamBId: string) => {
  const a = teamAId.trim().toLowerCase();
  const b = teamBId.trim().toLowerCase();
  return a <= b ? `${a}|${b}` : `${b}|${a}`;
};

/** Overlay authoritative scores when the API fixture is still Scheduled or stale. */
export function mergeOfficialResultsIntoMatches(matches: EventMatch[], teams: EventTeam[]): EventMatch[] {
  const resultByPair = new Map(
    WORLD_CUP_SCORE_OVERRIDES.map((r) => [pairKey(r.teamAId, r.teamBId), r]),
  );
  const teamById = new Map(teams.map((t) => [t.teamId.toLowerCase(), t]));
  const seenPairs = new Set<string>();

  const merged = matches.map((match) => {
    if (!match.groupId?.trim()) return match;
    const key = pairKey(match.teamAId, match.teamBId);
    seenPairs.add(key);
    const official = resultByPair.get(key);
    if (!official) return match;

    const aIsCatalogA = sameTeam(match.teamAId, official.teamAId);
    const scoreA = aIsCatalogA ? official.scoreA : official.scoreB;
    const scoreB = aIsCatalogA ? official.scoreB : official.scoreA;
    if (match.status === official.status && match.scoreA === scoreA && match.scoreB === scoreB) return match;
    return { ...match, status: official.status, scoreA, scoreB };
  });

  for (const official of WORLD_CUP_SCORE_OVERRIDES) {
    const key = pairKey(official.teamAId, official.teamBId);
    if (seenPairs.has(key)) continue;
    const teamA = teamById.get(official.teamAId.toLowerCase());
    const teamB = teamById.get(official.teamBId.toLowerCase());
    if (!teamA?.groupId) continue;
    merged.push({
      eventId: teamA.eventId,
      matchId: `gs-${official.teamAId}-vs-${official.teamBId}`,
      teamAId: official.teamAId,
      teamBId: official.teamBId,
      teamAName: teamA.name,
      teamBName: teamB?.name,
      teamAFlag: teamA.flagEmoji,
      teamBFlag: teamB?.flagEmoji,
      groupId: teamA.groupId,
      matchDate: '',
      venue: '',
      status: official.status,
      scoreA: official.scoreA,
      scoreB: official.scoreB,
    });
  }

  return merged;
}

const standingsMatches = (matches: EventMatch[]) => matches.filter(
  (m) => (m.status === 'Completed' || m.status === 'Live')
    && m.scoreA != null
    && m.scoreB != null
    && Boolean(m.groupId?.trim()),
);

/** Derive group standings from completed and in-play fixtures. */
export function computeStandingsFromMatches(teams: EventTeam[], matches: EventMatch[]): EventTeam[] {
  const effectiveMatches = mergeOfficialResultsIntoMatches(matches, teams);
  const counted = standingsMatches(effectiveMatches);

  return teams.map((team) => {
    let played = 0;
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;

    for (const m of counted) {
      const isA = sameTeam(m.teamAId, team.teamId);
      const isB = sameTeam(m.teamBId, team.teamId);
      if (!isA && !isB) continue;

      const scored = isA ? m.scoreA! : m.scoreB!;
      const conceded = isA ? m.scoreB! : m.scoreA!;
      played += 1;
      goalsFor += scored;
      goalsAgainst += conceded;
      if (scored > conceded) wins += 1;
      else if (scored === conceded) draws += 1;
      else losses += 1;
    }

    const goalDifference = goalsFor - goalsAgainst;
    const points = wins * 3 + draws;
    return {
      ...team,
      played,
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
      goalDifference,
      points,
    };
  });
}

/** Poll faster while matches are live or recently finished. */
export function hubRefetchIntervalMs(matches: EventMatch[] | undefined, baseMs = 45_000): number {
  if (WORLD_CUP_SCORE_OVERRIDES.some((r) => r.status === 'Live')) return 10_000;
  if (!matches?.length) return baseMs;
  if (matches.some((m) => m.status === 'Live')) return 10_000;
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  const recentResult = matches.some((m) => {
    if (m.status !== 'Completed' || m.updatedAt == null) return false;
    const ms = Date.parse(m.updatedAt);
    return !Number.isNaN(ms) && ms >= twoHoursAgo;
  });
  return recentResult ? 15_000 : baseMs;
}
