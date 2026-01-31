import axios from 'axios';
import { handleApiError } from '@/utils/apiErrorHandler';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://goskwzjzjg.execute-api.us-east-1.amazonaws.com';

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

  async createCheckoutSession(
    token: string,
    planType: 'pro' | 'elite' | 'premium_monthly' | 'premium_yearly' | 'lifetime'
  ): Promise<CheckoutSessionResponse> {
    const response = await axios.post<CheckoutSessionResponse>(
      `${API_BASE_URL}/api/payment/checkout`,
      { planType },
      this.getHeaders(token)
    );
    return response.data;
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
