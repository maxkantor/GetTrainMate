import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface CMSContent {
  contentType: string;
  contentId: string;
  title: string;
  body: string;
  translations: Record<string, string>;
  status: 'draft' | 'published' | 'archived' | string;
  createdAt: string;
  publishedAt?: string;
  createdBy?: string;
}

export interface CreateContentRequest {
  contentType: string;
  title: string;
  body: string;
  translations?: Record<string, string>;
  status?: 'draft' | 'published' | 'archived' | string;
}

class CmsService {
  private getHeaders(adminToken: string) {
    return {
      headers: {
        'X-Admin-Token': adminToken,
        'Content-Type': 'application/json',
      },
    };
  }

  async listContent(adminToken: string, params?: { contentType?: string; status?: string; limit?: number; q?: string }): Promise<CMSContent[]> {
    const query = new URLSearchParams();
    if (params?.contentType) query.set('contentType', params.contentType);
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.q) query.set('q', params.q);

    const url = `${API_BASE_URL}/api/cms${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await axios.get<CMSContent[]>(url, this.getHeaders(adminToken));
    return res.data;
  }

  async getContent(adminToken: string, contentType: string, contentId: string): Promise<CMSContent> {
    const res = await axios.get<CMSContent>(`${API_BASE_URL}/api/cms/${contentType}/${contentId}` , this.getHeaders(adminToken));
    return res.data;
  }

  async createContent(adminToken: string, payload: CreateContentRequest): Promise<CMSContent> {
    const res = await axios.post<CMSContent>(`${API_BASE_URL}/api/cms`, payload, this.getHeaders(adminToken));
    return res.data;
  }

  async updateContent(adminToken: string, contentType: string, contentId: string, payload: CreateContentRequest): Promise<CMSContent> {
    const res = await axios.put<CMSContent>(`${API_BASE_URL}/api/cms/${contentType}/${contentId}`, payload, this.getHeaders(adminToken));
    return res.data;
  }

  async publishContent(adminToken: string, contentType: string, contentId: string): Promise<CMSContent> {
    const res = await axios.post<CMSContent>(`${API_BASE_URL}/api/cms/${contentType}/${contentId}/publish`, {}, this.getHeaders(adminToken));
    return res.data;
  }

  async archiveContent(adminToken: string, contentType: string, contentId: string): Promise<CMSContent> {
    const res = await axios.post<CMSContent>(`${API_BASE_URL}/api/cms/${contentType}/${contentId}/archive`, {}, this.getHeaders(adminToken));
    return res.data;
  }

  async deleteContent(adminToken: string, contentType: string, contentId: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/api/cms/${contentType}/${contentId}`, this.getHeaders(adminToken));
  }
}

export const cmsService = new CmsService();
