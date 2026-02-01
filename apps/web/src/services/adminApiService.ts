import { fetchAuthSession } from 'aws-amplify/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://goskwzjzjg.execute-api.us-east-1.amazonaws.com';

const ADMIN_TOKEN_KEY = 'adminToken';

class AdminApiService {
  private async getAuthHeaders(): Promise<HeadersInit> {
    const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (adminToken) {
      return {
        'X-Admin-Token': adminToken,
        'Content-Type': 'application/json',
      };
    }

    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (token) {
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
    }

    throw new Error('No admin or auth token found. Please log in.');
  }

  private async parseResponse(response: Response): Promise<any> {
    const text = await response.text();
    if (!text || !text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async get(endpoint: string): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers,
    });

    const data = await this.parseResponse(response);

    if (!response.ok) {
      const error = data?.error ?? data?.message ?? 'Request failed';
      throw new Error(typeof error === 'string' ? error : `HTTP ${response.status}`);
    }

    return data;
  }

  async post(endpoint: string, data?: any, skipAuth: boolean = false): Promise<any> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (!skipAuth) {
      const authHeaders = await this.getAuthHeaders();
      Object.assign(headers, authHeaders);
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    const parsed = await this.parseResponse(response);

    if (!response.ok) {
      const error = parsed?.error ?? parsed?.message ?? 'Request failed';
      throw new Error(typeof error === 'string' ? error : `HTTP ${response.status}`);
    }

    return parsed;
  }

  async put(endpoint: string, data?: any): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    const parsed = await this.parseResponse(response);

    if (!response.ok) {
      const error = parsed?.error ?? parsed?.message ?? 'Request failed';
      throw new Error(typeof error === 'string' ? error : `HTTP ${response.status}`);
    }

    return parsed;
  }

  async delete(endpoint: string, data?: any): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    const parsed = await this.parseResponse(response);

    if (!response.ok) {
      const error = parsed?.error ?? parsed?.message ?? 'Request failed';
      throw new Error(typeof error === 'string' ? error : `HTTP ${response.status}`);
    }

    return parsed;
  }
}

export const adminApiService = new AdminApiService();
