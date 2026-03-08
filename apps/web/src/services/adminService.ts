import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

export interface AdminLoginResponse {
  token?: string;
  sessionToken?: string;
  admin?: {
    adminId: string;
    email: string;
    name: string;
    permissions: string[];
    isActive: boolean;
  };
  email?: string;
  expiresAt?: string;
}

class AdminService {
  async login(email: string, password: string): Promise<AdminLoginResponse> {
    const res = await axios.post<AdminLoginResponse>(`${API_BASE_URL}/api/admin/login`, { email, password });
    return res.data;
  }
}

export const adminService = new AdminService();
