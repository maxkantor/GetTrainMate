import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://goskwzjzjg.execute-api.us-east-1.amazonaws.com';

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

export const billingService = {
  async getPlans(): Promise<BillingPlanDto[]> {
    const response = await axios.get<BillingPlanDto[]>(
      `${API_BASE_URL}/api/billing/plans`
    );
    return response.data;
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

  async createCheckoutSession(
    token: string,
    planKey: 'pro' | 'elite'
  ): Promise<string> {
    const response = await axios.post<CreateCheckoutResponse>(
      `${API_BASE_URL}/api/billing/create-checkout-session`,
      { planKey },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const url = response.data?.url;
    if (!url) throw new Error('No checkout URL returned');
    return url;
  },
};
