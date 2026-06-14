import type { EventMatch, EventPrediction } from '@/services/sportsEventLayerService';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import { compareMatchesChronological, isMatchToday } from '@/utils/eventMatchUtils';
import type { TodayPickRow } from '@/utils/todayPredictionsShareCanvas';

export type TodaySharePick = {
  match: EventMatch;
  pred: EventPrediction;
  row: TodayPickRow;
};

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
  const todayMatches = matches.filter(isMatchToday).sort(compareMatchesChronological);
  if (todayMatches.length === 0) return [];

  const entries = await Promise.all(
    todayMatches.map(async (match) => {
      const pred = await sportsEventLayerService.getMyPrediction(eventId, match.matchId);
      if (!pred) return null;
      return {
        match,
        pred,
        row: buildTodayPickRow(match, pred, teamName, t),
      };
    }),
  );

  return entries.filter((x): x is TodaySharePick => x != null);
}

export function todaySharePicksQueryKey(eventId: string, matches: EventMatch[]) {
  return [
    'today-share-picks',
    eventId,
    matches.filter(isMatchToday).map((m) => m.matchId).sort().join('|'),
  ] as const;
}
