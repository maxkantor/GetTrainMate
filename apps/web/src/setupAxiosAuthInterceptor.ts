import axios from 'axios';
import { API_BASE_URL } from '@/config/api';
import { handleSessionInvalid } from '@/utils/sessionInvalid';

function requestPath(configUrl: string | undefined): string {
  if (!configUrl) return '';
  try {
    return configUrl.startsWith('http') ? new URL(configUrl).pathname : configUrl;
  } catch {
    return configUrl;
  }
}

/** True when this response is from our REST API and should force a user session reset on 401. */
function shouldForceLogoutOn401(configUrl: string | undefined): boolean {
  const path = requestPath(configUrl);
  if (path.includes('/api/admin/login')) return false;
  if (path.startsWith('/api/')) return true;
  if (configUrl?.startsWith(API_BASE_URL)) return true;
  return false;
}

axios.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);
    const status = error.response?.status;
    if (status !== 401) return Promise.reject(error);
    const url = error.config?.url;
    if (!shouldForceLogoutOn401(url)) return Promise.reject(error);
    await handleSessionInvalid();
    return Promise.reject(error);
  }
);
