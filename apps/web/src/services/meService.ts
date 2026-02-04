import axios from 'axios';
import { handleApiError } from '@/utils/apiErrorHandler';
import type { UserProfile } from '@/services/profileService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://goskwzjzjg.execute-api.us-east-1.amazonaws.com';

export interface MeUser {
  id: string;
  email: string;
}

export interface MeResponse {
  user: MeUser;
  profile: UserProfile | null;
  credits: number;
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
