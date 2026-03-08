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

  async getMyMatches(token: string) {
    const response = await axios.get(
      `${API_BASE_URL}/api/match/my-matches`,
      this.getHeaders(token)
    );
    return response.data;
  }
}

export const matchService = new MatchService();
