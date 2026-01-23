import axios from 'axios';
import { UpdateProfileRequest } from './profileService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

  async getDiscoveryFeed(token: string, limit: number = 20): Promise<MatchFeedItem[]> {
    const response = await axios.get<MatchFeedItem[]>(
      `${API_BASE_URL}/api/match/discover?limit=${limit}`,
      this.getHeaders(token)
    );
    return response.data;
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
