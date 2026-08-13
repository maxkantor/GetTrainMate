import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

export interface SubscriptionStatus {
  isPremium: boolean;
  planType: string;
  expiresAt?: string;
  recentPayments: Payment[];
}

export interface Payment {
  paymentId: string;
  amount: number;
  status: string;
  planType: string;
  createdAt: string;
  completedAt?: string;
  failureReason?: string;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  checkoutUrl: string;
  url?: string; // Some APIs return `url` instead of `checkoutUrl`
}

class PaymentService {
  private getHeaders(token: string) {
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  }

  /**
   * Create Stripe Checkout Session and return the redirect URL.
   * Throws on error with a user-friendly message.
   */
  async createCheckoutSessionAndGetUrl(
    token: string,
    plan: 'pro' | 'elite',
    attribution?: Record<string, string>
  ): Promise<string> {
    const endpoint = `${API_BASE_URL}/api/payment/checkout`;
    console.log('[PaymentService] Creating checkout session', { plan, endpoint });

    try {
      const response = await axios.post<CheckoutSessionResponse>(
        endpoint,
        {
          planType: plan,
          attribution: attribution && Object.keys(attribution).length ? attribution : undefined,
        },
        this.getHeaders(token)
      );

      console.log('[PaymentService] Response status:', response.status, 'body:', response.data);

      const data = response.data;
      const url = data.checkoutUrl ?? data.url;

      if (!url || typeof url !== 'string') {
        console.error('[PaymentService] No checkout URL in response:', data);
        throw new Error('Server did not return a checkout URL. Please try again or contact support.');
      }

      return url;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const body = err.response?.data;
        console.error('[PaymentService] Checkout error:', { status, body, message: err.message });

        if (status === 400) {
          throw new Error(body?.error ?? 'Invalid plan. Please refresh and try again.');
        }
        if (status === 401) {
          throw new Error('Please sign in and try again.');
        }
        if (status === 500) {
          throw new Error(body?.error ?? 'Checkout is temporarily unavailable. Please try again later.');
        }
        throw new Error(body?.error ?? err.message ?? 'Checkout failed. Please try again.');
      }
      throw err;
    }
  }

  async createCheckoutSession(
    token: string,
    planType: 'pro' | 'elite' | 'premium_monthly' | 'premium_yearly' | 'lifetime',
    attribution?: Record<string, string>
  ): Promise<CheckoutSessionResponse> {
    const plan = planType === 'pro' || planType === 'elite' ? planType : 'pro';
    const url = await this.createCheckoutSessionAndGetUrl(token, plan, attribution);
    return { sessionId: '', checkoutUrl: url };
  }

  async getSubscriptionStatus(token: string): Promise<SubscriptionStatus> {
    const response = await axios.get<SubscriptionStatus>(
      `${API_BASE_URL}/api/payment/subscription-status`,
      this.getHeaders(token)
    );
    return response.data;
  }

  async getPayments(token: string, limit: number = 20): Promise<Payment[]> {
    const response = await axios.get<Payment[]>(
      `${API_BASE_URL}/api/payment/payments?limit=${limit}`,
      this.getHeaders(token)
    );
    return response.data;
  }

  async getPayment(token: string, paymentId: string): Promise<Payment> {
    const response = await axios.get<Payment>(
      `${API_BASE_URL}/api/payment/payment/${paymentId}`,
      this.getHeaders(token)
    );
    return response.data;
  }
}

export const paymentService = new PaymentService();
