import axios from 'axios';
import { API_BASE_URL } from '@/config/api';
import { authService } from '@/services/authService';

export const WORLD_CUP_EVENT_ID = 'world-cup-2026';

export interface SportsEventConfig {
  eventId: string;
  name: string;
  label: string;
  sport: string;
  enabled: boolean;
  isFeatured: boolean;
  showAnytime?: boolean;
  startDate: string;
  endDate: string;
  icon: string;
  themeColor?: string;
  bannerImageUrl?: string;
  landingHeadline?: string;
  ctaLabel?: string;
  description: string;
  activities: string[];
  tags: string[];
  teams?: string[];
  locations?: string[];
  boostEnabled: boolean;
  boostPrice?: number;
  boostLabel?: string;
  stripePriceIdDev?: string;
  stripePriceIdProd?: string;
  homepageHeadline?: string;
  homepageSubheadline?: string;
  homepageCtaPrimary?: string;
  homepageCtaSecondary?: string;
  homepagePromoText?: string;
  homepageBackgroundImage?: string;
  homepageVisible?: boolean;
  navbarVisible?: boolean;
  hubRoute?: string;
  predictionsEnabled?: boolean;
  exactScoreEnabled?: boolean;
  winnerPickEnabled?: boolean;
  drawPickEnabled?: boolean;
  commentsEnabled?: boolean;
  sharingEnabled?: boolean;
}

export interface EventHubSettings {
  homepageHeadline?: string;
  homepageSubheadline?: string;
  homepageCtaPrimary?: string;
  homepageCtaSecondary?: string;
  homepagePromoText?: string;
  homepageBackgroundImage?: string;
  homepageVisible: boolean;
  navbarVisible: boolean;
  hubRoute?: string;
  predictionsEnabled: boolean;
  exactScoreEnabled: boolean;
  winnerPickEnabled: boolean;
  drawPickEnabled: boolean;
  commentsEnabled: boolean;
  sharingEnabled: boolean;
}

export interface EventGroup {
  eventId: string;
  groupId: string;
  label: string;
  sortOrder: number;
}

export interface EventTeam {
  eventId: string;
  teamId: string;
  name: string;
  country: string;
  flagEmoji: string;
  groupId: string;
  description?: string;
  sortOrder: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface EventMatch {
  eventId: string;
  matchId: string;
  teamAId: string;
  teamBId: string;
  teamAName?: string;
  teamBName?: string;
  teamAFlag?: string;
  teamBFlag?: string;
  matchDate: string;
  matchTime?: string;
  venue: string;
  status: 'Scheduled' | 'Live' | 'Completed';
  scoreA?: number;
  scoreB?: number;
  groupId?: string;
  stage?: string;
}

export interface EventPrediction {
  eventId: string;
  predictionKey: string;
  matchId: string;
  userId: string;
  userDisplayName?: string;
  predictionType: 'winner' | 'draw' | 'exact_score';
  predictedWinnerTeamId?: string;
  predictedScoreA?: number;
  predictedScoreB?: number;
  reason?: string;
  shareCount: number;
}

export interface EventComment {
  eventId: string;
  commentKey: string;
  threadId: string;
  threadType: string;
  userId: string;
  userDisplayName?: string;
  body: string;
  parentCommentKey?: string;
  createdAt: string;
}

export interface EventLeaderboardEntry {
  userId: string;
  displayName?: string;
  score: number;
  predictionsCount: number;
  correctCount: number;
  shareCount: number;
  commentCount: number;
}

export interface EventHubSnapshot {
  config: SportsEventConfig;
  effectivelyEnabled: boolean;
  settings: EventHubSettings;
  groups: EventGroup[];
  teams: EventTeam[];
  matches: EventMatch[];
}

export interface EventHubAnalytics {
  totalPredictions: number;
  totalComments: number;
  totalShares: number;
  uniquePredictors: number;
  predictionsPerMatch: Record<string, number>;
  popularTeams: Record<string, number>;
  topPredictors: EventLeaderboardEntry[];
  mostActiveFans: EventLeaderboardEntry[];
  mostShared: EventLeaderboardEntry[];
}

export interface CreatePredictionPayload {
  matchId: string;
  predictionType: 'winner' | 'draw' | 'exact_score';
  predictedWinnerTeamId?: string;
  predictedScoreA?: number;
  predictedScoreB?: number;
  reason?: string;
}

export interface CreateCommentPayload {
  threadId: string;
  threadType?: string;
  body: string;
  parentCommentKey?: string;
}

export interface EventMeetupPayload {
  title: string;
  activityType: 'watch' | 'play' | 'train' | 'meet' | 'vibe' | 'date';
  sport: string;
  team?: string;
  locationText: string;
  city?: string;
  state?: string;
  startTime?: string;
  visibility: 'public' | 'private';
}

class SportsEventLayerService {
  async getActiveEvents(): Promise<SportsEventConfig[]> {
    const res = await axios.get<SportsEventConfig[]>(`${API_BASE_URL}/api/events/active`);
    return res.data ?? [];
  }

  async getEvent(eventId: string): Promise<SportsEventConfig> {
    const res = await axios.get<SportsEventConfig>(`${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}`);
    return res.data;
  }

  async getHubSnapshot(eventId: string): Promise<EventHubSnapshot> {
    const res = await axios.get<EventHubSnapshot>(`${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}/hub`);
    return res.data;
  }

  async getGroups(eventId: string): Promise<EventGroup[]> {
    const res = await axios.get<EventGroup[]>(`${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}/groups`);
    return res.data ?? [];
  }

  async getTeams(eventId: string, groupId?: string): Promise<EventTeam[]> {
    const params = groupId ? { groupId } : {};
    const res = await axios.get<EventTeam[]>(`${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}/teams`, { params });
    return res.data ?? [];
  }

  async getMatches(eventId: string, date?: string): Promise<EventMatch[]> {
    const params = date ? { date } : {};
    const res = await axios.get<EventMatch[]>(`${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}/matches`, { params });
    return res.data ?? [];
  }

  async getLeaderboard(eventId: string, type = 'predictors'): Promise<EventLeaderboardEntry[]> {
    const res = await axios.get<EventLeaderboardEntry[]>(
      `${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}/leaderboard`,
      { params: { type } }
    );
    return res.data ?? [];
  }

  async getComments(eventId: string, threadId: string): Promise<EventComment[]> {
    const res = await axios.get<EventComment[]>(
      `${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}/comments/${encodeURIComponent(threadId)}`
    );
    return res.data ?? [];
  }

  async getMyPrediction(eventId: string, matchId: string): Promise<EventPrediction | null> {
    const token = await authService.getJWT();
    if (!token) return null;
    try {
      const res = await axios.get<EventPrediction>(
        `${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}/predictions/${encodeURIComponent(matchId)}/mine`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    } catch {
      return null;
    }
  }

  async submitPrediction(eventId: string, payload: CreatePredictionPayload): Promise<EventPrediction> {
    const token = await authService.getJWT();
    if (!token) throw new Error('Sign in required');
    const res = await axios.post<EventPrediction>(
      `${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}/predictions`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
  }

  async sharePrediction(eventId: string, matchId: string): Promise<void> {
    const token = await authService.getJWT();
    if (!token) throw new Error('Sign in required');
    await axios.post(
      `${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}/predictions/${encodeURIComponent(matchId)}/share`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  async postComment(eventId: string, payload: CreateCommentPayload): Promise<EventComment> {
    const token = await authService.getJWT();
    if (!token) throw new Error('Sign in required');
    const res = await axios.post<EventComment>(
      `${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}/comments`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
  }

  async createMeetup(eventId: string, payload: EventMeetupPayload): Promise<void> {
    const token = await authService.getJWT();
    if (!token) throw new Error('Sign in required');
    await axios.post(`${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}/meetups`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

export const sportsEventLayerService = new SportsEventLayerService();
