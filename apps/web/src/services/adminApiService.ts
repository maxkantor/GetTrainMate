import { API_BASE_URL } from '@/config/api';
import { getAdminToken } from '@/services/adminAuthStorage';

class AdminApiService {
  private getAuthHeaders(): HeadersInit {
    const token = getAdminToken();
    if (!token) {
      throw new Error('Admin session required. Please sign in at /admin/login.');
    }
    return {
      'X-Admin-Token': token,
      'Content-Type': 'application/json',
    };
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

  private attachStatusError(response: Response, data: any, fallback: string): Error {
    const msg =
      (typeof data?.error === 'string' && data.error) ||
      (typeof data?.message === 'string' && data.message) ||
      fallback;
    const err = new Error(msg) as Error & { status?: number };
    err.status = response.status;
    return err;
  }

  async get(endpoint: string): Promise<any> {
    const headers = this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers,
    });

    const data = await this.parseResponse(response);

    if (!response.ok) {
      throw this.attachStatusError(response, data, `HTTP ${response.status}`);
    }

    return data;
  }

  /**
   * @param skipAuth only for unauthenticated endpoints: POST /api/admin/login, POST /api/admin/login/validate-session
   */
  async post(endpoint: string, data?: any, skipAuth: boolean = false): Promise<any> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (!skipAuth) {
      Object.assign(headers, this.getAuthHeaders());
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    const parsed = await this.parseResponse(response);

    if (!response.ok) {
      throw this.attachStatusError(response, parsed, `HTTP ${response.status}`);
    }

    return parsed;
  }

  async put(endpoint: string, data?: any): Promise<any> {
    const headers = this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    const parsed = await this.parseResponse(response);

    if (!response.ok) {
      throw this.attachStatusError(response, parsed, `HTTP ${response.status}`);
    }

    return parsed;
  }

  async delete(endpoint: string, data?: any): Promise<any> {
    const headers = this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    const parsed = await this.parseResponse(response);

    if (!response.ok) {
      throw this.attachStatusError(response, parsed, `HTTP ${response.status}`);
    }

    return parsed;
  }
}

export const adminApiService = new AdminApiService();
