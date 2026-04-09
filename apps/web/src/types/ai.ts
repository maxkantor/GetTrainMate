/**
 * AI feature types and API shapes.
 */

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface MatchInsightRequest {
  userId: string;
  targetUserId: string;
  myName?: string;
  myBio?: string;
  mySports: string[];
  myLevel?: string;
  myGoals: string[];
  myScheduleSummary?: string;
  otherName?: string;
  otherBio?: string;
  otherSports: string[];
  otherLevel?: string;
  otherGoals: string[];
  otherScheduleSummary?: string;
  compatibilityScore: number;
}

export interface MatchInsightResponse {
  summary: string;
  reasons: string[];
  caution?: string;
}

export interface IcebreakerRequest {
  /** When set, server bills at most once per thread for icebreaker (idempotency). */
  threadId?: string;
  myName: string;
  myBio?: string;
  mySports: string[];
  myLevel?: string;
  myGoals: string[];
  otherName?: string;
  otherBio?: string;
  otherSports: string[];
  otherLevel?: string;
  otherGoals: string[];
}

export interface IcebreakerResponse {
  suggestions: string[];
}

export interface ProfileOptimizeRequest {
  bio?: string;
  goals: string[];
  sportTags: string[];
  level?: string;
  scheduleSummary?: string;
}

export interface ProfileOptimizeResponse {
  suggestedBio?: string;
  suggestedGoals: string[];
  suggestedScheduleSummary?: string;
}

export interface WorkoutPlanRequest {
  sport: string;
  level?: string;
  goal?: string;
  availableDays: string[];
  durationMinutes?: number;
  equipment?: string;
  constraints?: string;
}

export interface WorkoutPlanResponse {
  title: string;
  summary: string;
  sessions: string[];
}

export interface CreditCheckResult {
  allowed: boolean;
  balance: number;
  required: number;
  message?: string;
}

export interface AiCreditCosts {
  matchInsight: number;
  icebreakers: number;
  workoutPlan: number;
  profileOptimize: number;
  coachPremiumAction: number;
}

export interface AiErrorShape {
  code?: string;
  message: string;
  balance?: number;
  required?: number;
}
