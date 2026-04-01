import axios from 'axios';
import { handleApiError } from '@/utils/apiErrorHandler';
import { API_BASE_URL } from '@/config/api';

export interface MatchFeedItem {
  userId: string;
  name: string;
  city?: string;
  bio?: string;
  sportTags: string[];
  level?: string;
  photoUrls: string[];
  compatibilityScore: number;
  commonSports: string[];
  mode?: string;
  /** Short AI-generated compatibility explanation (when available; 2 credits to unlock if not). */
  aiMatchInsight?: string;
}

export interface MatchResponse {
  matchId: string;
  compatibilityScore: number;
  isMatched: boolean;
}

export interface DiscoverSkipRecord {
  targetUserId: string;
  skippedAt: string;
  skippedByUserId: string;
  isSkipped: boolean;
  restored: boolean;
}

class MatchService {
  private getHeaders(token: string) {
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  }

  async seedDemoProfiles(token: string): Promise<{ created: number; message: string }> {
    const response = await axios.post<{ created: number; message: string }>(
      `${API_BASE_URL}/api/match/seed-demo`,
      {},
      this.getHeaders(token)
    );
    return response.data;
  }

  async getCompatibility(token: string, targetUserId: string): Promise<{
    compatibilityScore: number;
    commonSports: string[];
    level?: string;
    city?: string;
    mode?: string;
  } | null> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/match/compatibility/${encodeURIComponent(targetUserId)}`,
        this.getHeaders(token)
      );
      return response.data;
    } catch (error) {
      if ((error as { response?: { status?: number } })?.response?.status === 404) return null;
      const apiError = handleApiError(error);
      throw new Error(apiError.message);
    }
  }

  async getDiscoveryFeed(token: string, limit: number = 20): Promise<MatchFeedItem[]> {
    try {
      const response = await axios.get<MatchFeedItem[]>(
        `${API_BASE_URL}/api/match/discover?limit=${limit}`,
        this.getHeaders(token)
      );
      return response.data;
    } catch (error) {
      const apiError = handleApiError(error);
      throw new Error(apiError.message);
    }
  }

  async likeUser(token: string, targetUserId: string): Promise<MatchResponse> {
    const response = await axios.post<MatchResponse>(
      `${API_BASE_URL}/api/match/like`,
      { targetUserId },
      this.getHeaders(token)
    );
    return response.data;
  }

  async passUser(token: string, targetUserId: string): Promise<MatchResponse> {
    const response = await axios.post<MatchResponse>(
      `${API_BASE_URL}/api/match/pass`,
      { targetUserId },
      this.getHeaders(token)
    );
    return response.data;
  }

  async undoPass(token: string, targetUserId: string): Promise<{ restored: boolean }> {
    const response = await axios.post<{ restored: boolean }>(
      `${API_BASE_URL}/api/match/undo-pass`,
      { targetUserId },
      this.getHeaders(token)
    );
    return response.data;
  }

  async getLastSkipped(token: string): Promise<DiscoverSkipRecord | null> {
    try {
      const response = await axios.get<DiscoverSkipRecord | null>(
        `${API_BASE_URL}/api/match/last-skipped`,
        this.getHeaders(token)
      );
      return response.data;
    } catch {
      return null;
    }
  }

  async getMyMatches(token: string) {
    const response = await axios.get(
      `${API_BASE_URL}/api/match/my-matches`,
      this.getHeaders(token)
    );
    return response.data;
  }
}

export const matchService = new MatchService();
