import axios from 'axios';
import { handleApiError } from '@/utils/apiErrorHandler';
import { API_BASE_URL } from '@/config/api';

export interface AvailabilitySlot {
  days: string[]; // e.g., ["Mon", "Wed", "Fri"]
  timeStart: string; // e.g., "18:00"
  timeEnd: string; // e.g., "20:00"
}

export interface UserProfile {
  userId: string;
  email: string;
  name: string; // Display name (required)
  city?: string;
  state?: string;
  country?: string;
  bio?: string; // Required, 20-500 chars
  birthDate?: string;
  gender?: string;
  sportTags: string[]; // Training types (required, at least 1)
  level?: string; // Required
  goals: string[]; // Training goals (optional)
  availabilitySchedule: AvailabilitySlot[]; // Required, at least 1 slot
  mode: 'TRAIN' | 'VIBE' | 'DATE';
  latitude?: number;
  longitude?: number;
  photoKey?: string; // S3 key for profile photo
  photoUrls: string[]; // Legacy support
  preferredDistanceMiles?: number;
  isComplete: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateProfileRequest {
  name?: string; // Display name (required for completion)
  city?: string;
  state?: string;
  country?: string;
  bio?: string; // Required, 20-500 chars
  birthDate?: string;
  gender?: string;
  sportTags?: string[]; // Training types (required, at least 1)
  level?: string; // Required
  goals?: string[];
  availabilitySchedule?: AvailabilitySlot[]; // Required, at least 1 slot
  mode?: 'TRAIN' | 'VIBE' | 'DATE';
  latitude?: number;
  longitude?: number;
  photoKey?: string; // S3 key for profile photo
  preferredDistanceMiles?: number;
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

  async getPhotoUrl(token: string, photoKey: string): Promise<string> {
    const response = await axios.post<{ url: string }>(
      `${API_BASE_URL}/api/profile/me/photos/url`,
      { key: photoKey },
      this.getHeaders(token)
    );
    return response.data.url;
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
