import type { EventMatch, EventPrediction } from '@/services/sportsEventLayerService';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import { compareMatchesChronological, isMatchToday } from '@/utils/eventMatchUtils';
import type { TodayPickRow } from '@/utils/todayPredictionsShareCanvas';

export type TodaySharePick = {
  match: EventMatch;
  pred: EventPrediction;
  row: TodayPickRow;
};

/** Matches shown on the Upcoming tab (not today, live, or completed). */
export function isMatchUpcomingTab(match: EventMatch): boolean {
  if (match.status === 'Completed' || match.status === 'Live') return false;
  return !isMatchToday(match);
}

export function buildTodayPickRow(
  match: EventMatch,
  prediction: EventPrediction,
  teamName: (id: string, name?: string) => string,
  t: (key: string) => string,
): TodayPickRow {
  const teamADisplay = teamName(match.teamAId, match.teamAName);
  const teamBDisplay = teamName(match.teamBId, match.teamBName);
  let pickLabel: string;
  let scoreLine: string | undefined;

  if (prediction.predictionType === 'draw') {
    pickLabel = t('event_hub.pick_draw');
  } else if (prediction.predictionType === 'exact_score' && prediction.predictedScoreA != null) {
    pickLabel = `${prediction.predictedScoreA}–${prediction.predictedScoreB}`;
    scoreLine = `${teamADisplay} ${prediction.predictedScoreA}–${prediction.predictedScoreB} ${teamBDisplay}`;
  } else {
    pickLabel = prediction.predictedWinnerTeamId === match.teamAId ? teamADisplay : teamBDisplay;
  }

  return {
    teamAId: match.teamAId,
    teamBId: match.teamBId,
    teamAName: teamADisplay,
    teamBName: teamBDisplay,
    pickLabel,
    scoreLine,
  };
}

/** Every local-calendar-day fixture the user has saved a pick for (incl. finished today). */
export async function fetchTodaySharePicks(
  eventId: string,
  matches: EventMatch[],
  teamName: (id: string, name?: string) => string,
  t: (key: string) => string,
): Promise<TodaySharePick[]> {
  return fetchSharePicksForMatches(
    eventId,
    matches.filter(isMatchToday).sort(compareMatchesChronological),
    teamName,
    t,
  );
}

/** Every upcoming-tab fixture the user has saved a pick for. */
export async function fetchUpcomingSharePicks(
  eventId: string,
  matches: EventMatch[],
  teamName: (id: string, name?: string) => string,
  t: (key: string) => string,
): Promise<TodaySharePick[]> {
  return fetchSharePicksForMatches(
    eventId,
    matches.filter(isMatchUpcomingTab).sort(compareMatchesChronological),
    teamName,
    t,
  );
}

async function fetchSharePicksForMatches(
  eventId: string,
  tabMatches: EventMatch[],
  teamName: (id: string, name?: string) => string,
  t: (key: string) => string,
): Promise<TodaySharePick[]> {
  if (tabMatches.length === 0) return [];

  const tabIds = new Set(tabMatches.map((m) => m.matchId));
  const matchById = new Map(tabMatches.map((m) => [m.matchId, m]));

  const summary = await sportsEventLayerService.getMyPicksSummary(eventId);
  if (!summary?.predictions.length) return [];

  return summary.predictions
    .filter((p) => tabIds.has(p.matchId))
    .map((pred) => {
      const match = matchById.get(pred.matchId);
      if (!match) return null;
      return {
        match,
        pred,
        row: buildTodayPickRow(match, pred, teamName, t),
      };
    })
    .filter((x): x is TodaySharePick => x != null)
    .sort((a, b) => compareMatchesChronological(a.match, b.match));
}

export function todaySharePicksQueryKey(eventId: string, matches: EventMatch[]) {
  return [
    'today-share-picks',
    eventId,
    matches.filter(isMatchToday).map((m) => m.matchId).sort().join('|'),
  ] as const;
}

export function upcomingSharePicksQueryKey(eventId: string, matches: EventMatch[]) {
  return [
    'upcoming-share-picks',
    eventId,
    matches.filter(isMatchUpcomingTab).map((m) => m.matchId).sort().join('|'),
  ] as const;
}
