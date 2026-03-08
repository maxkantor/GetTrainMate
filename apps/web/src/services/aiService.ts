/**
 * AI API client: chat (streaming), match insight, icebreakers, profile optimize, workout plan, help.
 * Uses VITE_API_URL. All endpoints require auth (Bearer token).
 */

import axios, { AxiosError } from 'axios';
import type {
  AiChatMessage,
  MatchInsightRequest,
  MatchInsightResponse,
  IcebreakerRequest,
  IcebreakerResponse,
  ProfileOptimizeRequest,
  ProfileOptimizeResponse,
  WorkoutPlanRequest,
  WorkoutPlanResponse,
  AiCreditCosts,
  AiErrorShape,
} from '@/types/ai';

const API_BASE = import.meta.env.VITE_API_URL || 'https://goskwzjzjg.execute-api.us-east-1.amazonaws.com';

function getHeaders(token: string) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
}

export function isInsufficientCreditsError(err: unknown): boolean {
  const ax = err as AxiosError<AiErrorShape>;
  return ax.response?.status === 402 || ax.response?.data?.code === 'INSUFFICIENT_CREDITS';
}

export function getAiErrorMessage(err: unknown): string {
  const ax = err as AxiosError<AiErrorShape>;
  const msg = ax.response?.data?.message;
  if (msg) return msg;
  if (ax.response?.status === 402) return 'Not enough credits. Get more on the Pricing page.';
  return ax.message || 'Something went wrong. Please try again.';
}

/** Stream AI Coach chat (SSE). Yields { text } or { error }. */
export async function* streamAiChat(
  token: string,
  message: string,
  history: AiChatMessage[] = []
): AsyncGenerator<{ text?: string; error?: string }> {
  const res = await fetch(`${API_BASE}/api/ai/chat/stream`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      history: history.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    yield { error: data.message || 'Failed to start chat.' };
    return;
  }
  const reader = res.body?.getReader();
  if (!reader) {
    yield { error: 'Stream not available.' };
    return;
  }
  const dec = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6);
          if (raw === '[DONE]') continue;
          try {
            const data = JSON.parse(raw);
            if (data.error) yield { error: data.error };
            else if (data.text) yield { text: data.text };
          } catch {
            // skip malformed
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Single-turn AI Coach (non-streaming). */
export async function sendAiChat(
  token: string,
  message: string,
  history: AiChatMessage[] = []
): Promise<{ content: string }> {
  const { data } = await axios.post<{ content: string }>(
    `${API_BASE}/api/ai/chat`,
    { message, history: history.map((m) => ({ role: m.role, content: m.content })) },
    getHeaders(token)
  );
  return data;
}

/** Get AI match insight (charges credits). */
export async function getMatchInsight(
  token: string,
  request: MatchInsightRequest
): Promise<MatchInsightResponse> {
  const { data } = await axios.post<MatchInsightResponse>(
    `${API_BASE}/api/ai/match-insight`,
    request,
    getHeaders(token)
  );
  return data;
}

/** Get AI icebreakers (charges credits). */
export async function getIcebreakers(
  token: string,
  request: IcebreakerRequest
): Promise<IcebreakerResponse> {
  const { data } = await axios.post<IcebreakerResponse>(
    `${API_BASE}/api/ai/icebreakers`,
    request,
    getHeaders(token)
  );
  return data;
}

/** Get profile optimization suggestions. */
export async function getProfileOptimize(
  token: string,
  request: ProfileOptimizeRequest
): Promise<ProfileOptimizeResponse> {
  const { data } = await axios.post<ProfileOptimizeResponse>(
    `${API_BASE}/api/ai/profile-optimize`,
    request,
    getHeaders(token)
  );
  return data;
}

/** Get workout plan (charges credits). */
export async function getWorkoutPlan(
  token: string,
  request: WorkoutPlanRequest
): Promise<WorkoutPlanResponse> {
  const { data } = await axios.post<WorkoutPlanResponse>(
    `${API_BASE}/api/ai/workout-plan`,
    request,
    getHeaders(token)
  );
  return data;
}

/** Help assistant (FAQ, credits, safety). */
export async function askHelp(token: string, question: string): Promise<{ answer: string }> {
  const { data } = await axios.post<{ answer: string }>(
    `${API_BASE}/api/ai/help`,
    { question },
    getHeaders(token)
  );
  return data;
}

/** Get credit costs for AI features. */
export async function getAiCreditCosts(token: string): Promise<AiCreditCosts> {
  const { data } = await axios.get<AiCreditCosts>(
    `${API_BASE}/api/ai/credit-costs`,
    getHeaders(token)
  );
  return data;
}
