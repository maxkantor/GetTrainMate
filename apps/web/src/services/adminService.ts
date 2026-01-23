import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface AdminLoginResponse {
  token: string;
  admin: {
    adminId: string;
    email: string;
    name: string;
    permissions: string[];
    isActive: boolean;
  };
}

class AdminService {
  async login(email: string, password: string): Promise<AdminLoginResponse> {
    const res = await axios.post<AdminLoginResponse>(`${API_BASE_URL}/api/admin/login`, { email, password });
    return res.data;
  }
}

export const adminService = new AdminService();
