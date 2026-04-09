import axios, { isAxiosError } from 'axios';
import { API_BASE_URL } from '@/config/api';
import { handleApiError } from '@/utils/apiErrorHandler';
import type { CreditsBalance } from './premiumTypes';

function getHeaders(token: string) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
}

export async function activateProfileBoost24h(token: string): Promise<CreditsBalance> {
  try {
    const { data } = await axios.post<CreditsBalance>(
      `${API_BASE_URL}/api/premium/profile-boost`,
      {},
      getHeaders(token)
    );
    return data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 402) {
      const e = new Error(handleApiError(error).message) as Error & { status?: number };
      e.status = 402;
      throw e;
    }
    throw new Error(handleApiError(error).message);
  }
}

export async function unlockRevealLikes(token: string): Promise<CreditsBalance> {
  try {
    const { data } = await axios.post<CreditsBalance>(
      `${API_BASE_URL}/api/premium/reveal-likes`,
      {},
      getHeaders(token)
    );
    return data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 402) {
      const e = new Error(handleApiError(error).message) as Error & { status?: number };
      e.status = 402;
      throw e;
    }
    throw new Error(handleApiError(error).message);
  }
}
