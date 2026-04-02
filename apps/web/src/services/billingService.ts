import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

const PLANS_CACHE_KEY = 'billing_plans_cache';
const CREDIT_PACKS_CACHE_KEY = 'credit_packs_cache';
const PLANS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

export interface BillingPlanDto {
  key: string;
  displayName: string;
  monthlyPrice: number;
  features: string[];
  isConfigured: boolean;
}

export interface CreateCheckoutResponse {
  url: string;
}

export interface SubscriptionStatusDto {
  isPremium: boolean;
  planKey: string;
  expiresAt?: string;
  recentPayments?: Array<{ paymentId: string; amount: number; status: string; planType: string; createdAt: string }>;
}

export interface CreditPackDto {
  key: string;
  title: string;
  priceUsd: number;
  credits: number;
  isActive: boolean;
  sortOrder: number;
  isBestValue: boolean;
}

export interface CreditsBalanceDto {
  balance: number;
  lifetimeEarned: number;
  unlimitedDiscovery?: boolean;
}

export const billingService = {
  async getPlans(): Promise<{ plans: BillingPlanDto[]; source: string }> {
    try {
      const cached = sessionStorage.getItem(PLANS_CACHE_KEY);
      if (cached) {
        const { data, expires } = JSON.parse(cached);
        if (expires > Date.now()) return data;
      }
    } catch {
      /* ignore cache parse errors */
    }

    try {
      const response = await axios.get<{ plans: BillingPlanDto[]; source: string }>(
        `${API_BASE_URL}/api/billing/plans`,
        { timeout: 8000 }
      );
      const data = response.data;
      if (data?.plans?.length) {
        try {
          sessionStorage.setItem(
            PLANS_CACHE_KEY,
            JSON.stringify({ data, expires: Date.now() + PLANS_CACHE_TTL_MS })
          );
        } catch {
          /* ignore */
        }
      }
      return data ?? { plans: [], source: 'default' };
    } catch {
      return { plans: [], source: 'default' };
    }
  },

  async confirmSession(token: string, sessionId: string): Promise<void> {
    await axios.post(
      `${API_BASE_URL}/api/billing/confirm-session`,
      { sessionId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
  },

  async getSubscriptionStatus(token: string): Promise<SubscriptionStatusDto> {
    const response = await axios.get<SubscriptionStatusDto>(
      `${API_BASE_URL}/api/billing/subscription-status`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  },

  async getCreditPacks(): Promise<{ packs: CreditPackDto[]; source: string }> {
    try {
      const cached = sessionStorage.getItem(CREDIT_PACKS_CACHE_KEY);
      if (cached) {
        const { data, expires } = JSON.parse(cached);
        if (expires > Date.now()) return data;
      }
    } catch {
      /* ignore */
    }
    try {
      const response = await axios.get<{ packs: CreditPackDto[]; source: string }>(
        `${API_BASE_URL}/api/billing/credit-packs`,
        { timeout: 8000 }
      );
      const data = response.data;
      if (data?.packs?.length) {
        try {
          sessionStorage.setItem(
            CREDIT_PACKS_CACHE_KEY,
            JSON.stringify({ data, expires: Date.now() + PLANS_CACHE_TTL_MS })
          );
        } catch {
          /* ignore */
        }
      }
      return data ?? { packs: [], source: 'default' };
    } catch {
      return { packs: [], source: 'default' };
    }
  },

  async getCreditsBalance(token: string): Promise<CreditsBalanceDto> {
    const response = await axios.get<CreditsBalanceDto>(
      `${API_BASE_URL}/api/billing/credits-balance`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.data;
  },

  /** Apply purchased credits using session_id (success page). Idempotent; single source of truth for credits. */
  async confirmCreditsPurchase(token: string, sessionId: string): Promise<CreditsBalanceDto | null> {
    try {
      const response = await axios.post<CreditsBalanceDto>(
        `${API_BASE_URL}/api/billing/confirm-credits-purchase`,
        { sessionId: sessionId.trim() },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data ?? null;
    } catch {
      return null;
    }
  },

  async grantFreeSignup(token: string): Promise<void> {
    await axios.post(
      `${API_BASE_URL}/api/billing/grant-free-signup`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
  },

  async createCheckoutSession(
    token: string,
    packKey: string
  ): Promise<string> {
    try {
      const response = await axios.post<CreateCheckoutResponse>(
        `${API_BASE_URL}/api/billing/create-checkout-session`,
        { packKey },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );
      const url = response.data?.url;
      if (!url) throw new Error('No checkout URL returned');
      return url;
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 404) {
          throw new Error('Checkout service unavailable. Please try again later or contact support.');
        }
        if (err.response?.status === 503) {
          const msg = err.response?.data?.error;
          throw new Error(typeof msg === 'string' ? msg : 'Credit packs are being configured. Please try again in a minute.');
        }
        const msg = err.response?.data?.error;
        if (typeof msg === 'string') throw new Error(msg);
      }
      throw err;
    }
  },
};
