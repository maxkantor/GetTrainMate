import axios from 'axios';
import { handleApiError } from '@/utils/apiErrorHandler';
import type { UserProfile } from '@/services/profileService';
import { API_BASE_URL } from '@/config/api';

export interface MeUser {
  id: string;
  email: string;
}

export interface MeResponse {
  user: MeUser;
  profile: UserProfile | null;
  credits: number;
  /** Total credits ever earned (for X/Y display: current / total). */
  lifetimeEarned?: number;
  /** Browse/deck entitlement; does not waive per-interest credit when balance &gt; 0. */
  unlimitedDiscovery?: boolean;
  boostExpiresAtUtc?: string | null;
  revealLikesUnlocked?: boolean;
  isProfileComplete: boolean;
  isAdmin: boolean;
}

class MeService {
  private getHeaders(token: string) {
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  }

  async getMe(token: string): Promise<MeResponse> {
    try {
      const response = await axios.get<MeResponse>(
        `${API_BASE_URL}/api/me`,
        this.getHeaders(token)
      );
      return response.data;
    } catch (error) {
      const apiError = handleApiError(error);
      throw new Error(apiError.message);
    }
  }
}

export const meService = new MeService();
