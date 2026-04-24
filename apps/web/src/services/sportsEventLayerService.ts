import axios from 'axios';
import { API_BASE_URL } from '@/config/api';
import { authService } from '@/services/authService';

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

  async createMeetup(eventId: string, payload: EventMeetupPayload): Promise<void> {
    const token = await authService.getJWT();
    if (!token) throw new Error('Sign in required');
    await axios.post(`${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}/meetups`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

export const sportsEventLayerService = new SportsEventLayerService();
