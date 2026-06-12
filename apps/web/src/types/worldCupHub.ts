import type {
  EventComment,
  EventMatch,
  EventPrediction,
  EventTeam,
  MatchPredictionBreakdown,
} from '@/services/sportsEventLayerService';

/** Canonical domain aliases for the World Cup Fan Hub. */
export type Fixture = EventMatch;
export type Prediction = EventPrediction;
export type FanOpinion = EventComment;
export type Team = EventTeam;
export type PredictionAggregate = MatchPredictionBreakdown;

export type WinnerPick = 'teamA' | 'draw' | 'teamB';

export interface CommunityPulse {
  totalPredictions: number;
  mostPickedTeamId?: string;
  mostPickedTeamName?: string;
  mostDiscussedMatchId?: string;
  mostDiscussedMatchLabel?: string;
  latestTakes: FanTakePreview[];
}

export interface FanTakePreview {
  userDisplayName?: string;
  body: string;
  threadId: string;
  pickedTeamId?: string;
  createdAt: string;
}
