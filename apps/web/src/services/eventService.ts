import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://goskwzjzjg.execute-api.us-east-1.amazonaws.com';

export interface EventResponse {
  eventId: string;
  title: string;
  description: string;
  sport: string;
  city: string;
  eventDate: string;
  skillLevel: string;
  maxParticipants: number;
  participantCount: number;
  isJoined: boolean;
  organizerName: string;
}

export interface CreateEventRequest {
  title: string;
  description: string;
  sport: string;
  city: string;
  latitude?: number;
  longitude?: number;
  eventDate: string;
  skillLevel: string;
  maxParticipants: number;
}

class EventService {
  private getHeaders(token: string) {
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  }

  async getEvents(token: string, limit: number = 50): Promise<EventResponse[]> {
    const response = await axios.get<EventResponse[]>(
      `${API_BASE_URL}/api/event?limit=${limit}`,
      this.getHeaders(token)
    );
    return response.data;
  }

  async getEvent(token: string, eventId: string): Promise<EventResponse> {
    const response = await axios.get<EventResponse>(
      `${API_BASE_URL}/api/event/${eventId}`,
      this.getHeaders(token)
    );
    return response.data;
  }

  async createEvent(token: string, data: CreateEventRequest): Promise<EventResponse> {
    const response = await axios.post<EventResponse>(
      `${API_BASE_URL}/api/event`,
      data,
      this.getHeaders(token)
    );
    return response.data;
  }

  async joinEvent(token: string, eventId: string): Promise<EventResponse> {
    const response = await axios.post<EventResponse>(
      `${API_BASE_URL}/api/event/${eventId}/join`,
      {},
      this.getHeaders(token)
    );
    return response.data;
  }

  async leaveEvent(token: string, eventId: string): Promise<void> {
    await axios.post(
      `${API_BASE_URL}/api/event/${eventId}/leave`,
      {},
      this.getHeaders(token)
    );
  }

  async getMyEvents(token: string): Promise<EventResponse[]> {
    const response = await axios.get<EventResponse[]>(
      `${API_BASE_URL}/api/event/my-events`,
      this.getHeaders(token)
    );
    return response.data;
  }
}

export const eventService = new EventService();
