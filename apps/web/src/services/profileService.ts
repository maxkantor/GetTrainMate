import axios from 'axios';
import { handleApiError } from '@/utils/apiErrorHandler';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://goskwzjzjg.execute-api.us-east-1.amazonaws.com';

export interface UserProfile {
  userId: string;
  email: string;
  name: string;
  city?: string;
  bio?: string;
  birthDate?: string;
  gender?: string;
  sportTags: string[];
  level?: string;
  goals?: string;
  availabilitySchedule: string[];
  mode: 'TRAIN' | 'VIBE' | 'DATE';
  latitude?: number;
  longitude?: number;
  photoUrls: string[];
  isComplete: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateProfileRequest {
  name?: string;
  city?: string;
  bio?: string;
  birthDate?: string;
  gender?: string;
  sportTags?: string[];
  level?: string;
  goals?: string;
  availabilitySchedule?: string[];
  mode?: 'TRAIN' | 'VIBE' | 'DATE';
  latitude?: number;
  longitude?: number;
}

export interface PhotoUploadInfo {
  key: string;
  uploadUrl: string;
  publicUrl: string;
}

class ProfileService {
  private getHeaders(token: string) {
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  }

  async getMyProfile(token: string): Promise<UserProfile> {
    try {
      const response = await axios.get<UserProfile>(
        `${API_BASE_URL}/api/profile/me`,
        this.getHeaders(token)
      );
      return response.data;
    } catch (error) {
      const apiError = handleApiError(error);
      throw new Error(apiError.message);
    }
  }

  async updateMyProfile(token: string, data: UpdateProfileRequest): Promise<UserProfile> {
    const response = await axios.put<UserProfile>(
      `${API_BASE_URL}/api/profile/me`,
      data,
      this.getHeaders(token)
    );
    return response.data;
  }

  async getProfile(token: string, userId: string): Promise<Partial<UserProfile>> {
    const response = await axios.get<Partial<UserProfile>>(
      `${API_BASE_URL}/api/profile/${userId}`,
      this.getHeaders(token)
    );
    return response.data;
  }

  async getPhotoUploadUrl(token: string, contentType: string): Promise<PhotoUploadInfo> {
    const response = await axios.post<PhotoUploadInfo>(
      `${API_BASE_URL}/api/profile/me/photos/upload-url`,
      { contentType },
      this.getHeaders(token)
    );
    return response.data;
  }

  async addPhoto(token: string, url: string): Promise<UserProfile> {
    const response = await axios.post<UserProfile>(
      `${API_BASE_URL}/api/profile/me/photos`,
      { url },
      this.getHeaders(token)
    );
    return response.data;
  }
}

export const profileService = new ProfileService();
