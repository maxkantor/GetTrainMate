/**
 * AppSync GraphQL service. Used when VITE_APPSYNC_GRAPHQL_URL is set.
 * Uses Amplify generateClient with userPool auth.
 */

import { generateClient } from 'aws-amplify/api';
import { isGraphQLEnabled, APPSYNC_GRAPHQL_URL } from '@/config/appsync';
import {
  GET_ME,
  DISCOVER_CANDIDATES,
  LIST_MY_MATCHES,
  GET_THREAD_BY_MATCH,
  LIST_MESSAGES,
  ENSURE_FREE_START_CREDITS,
  LIKE_USER,
  UNLOCK_CHAT,
  CREATE_MESSAGE,
  ON_MESSAGE_CREATED,
  SEED_DEMO_DATA,
} from '@/api/operations';

function getClient() {
  if (!isGraphQLEnabled || !APPSYNC_GRAPHQL_URL) {
    throw new Error('GraphQL API is not configured. Set VITE_APPSYNC_GRAPHQL_URL.');
  }
  return generateClient({
    endpoint: APPSYNC_GRAPHQL_URL,
    authMode: 'userPool',
  });
}

export async function graphqlGetMe() {
  const result = await getClient().graphql({
    query: GET_ME,
  });
  const data = (result as { data?: { getMe?: unknown } }).data;
  if (!data?.getMe) throw new Error('getMe failed');
  return data.getMe as {
    user: { id: string; email?: string; isAdmin?: boolean };
    profile: Record<string, unknown> | null;
    credits: number;
    isProfileComplete: boolean;
  };
}

export async function graphqlDiscoverCandidates(limit?: number, nextToken?: string) {
  const result = await getClient().graphql({
    query: DISCOVER_CANDIDATES,
    variables: { limit: limit ?? 20, nextToken },
  });
  const data = (result as { data?: { discoverCandidates?: { items: unknown[]; nextToken?: string } } }).data;
  if (!data?.discoverCandidates) throw new Error('discoverCandidates failed');
  return data.discoverCandidates;
}

export async function graphqlListMyMatches() {
  const result = await getClient().graphql({
    query: LIST_MY_MATCHES,
  });
  const data = (result as { data?: { listMyMatches?: { items: unknown[] } } }).data;
  if (!data?.listMyMatches) throw new Error('listMyMatches failed');
  return data.listMyMatches.items;
}

export async function graphqlGetThreadByMatch(matchId: string) {
  const result = await getClient().graphql({
    query: GET_THREAD_BY_MATCH,
    variables: { matchId },
  });
  const data = (result as { data?: { getThreadByMatch?: unknown } }).data;
  return data?.getThreadByMatch ?? null;
}

export async function graphqlListMessages(threadId: string, limit?: number, nextToken?: string) {
  const result = await getClient().graphql({
    query: LIST_MESSAGES,
    variables: { threadId, limit: limit ?? 30, nextToken },
  });
  const data = (result as { data?: { listMessages?: { items: unknown[]; nextToken?: string } } }).data;
  if (!data?.listMessages) throw new Error('listMessages failed');
  return data.listMessages;
}

export async function graphqlEnsureFreeStartCredits() {
  const result = await getClient().graphql({
    query: ENSURE_FREE_START_CREDITS,
  });
  const data = (result as { data?: { ensureFreeStartCredits?: boolean } }).data;
  return data?.ensureFreeStartCredits ?? false;
}

export async function graphqlLikeUser(toUserId: string) {
  const result = await getClient().graphql({
    query: LIKE_USER,
    variables: { toUserId },
  });
  const data = (result as { data?: { likeUser?: { matchId: string; isMatched: boolean; compatibilityScore: number } } }).data;
  if (!data?.likeUser) throw new Error('likeUser failed');
  return data.likeUser;
}

export async function graphqlUnlockChat(matchId: string) {
  const result = await getClient().graphql({
    query: UNLOCK_CHAT,
    variables: { matchId },
  });
  const data = (result as { data?: { unlockChat?: { threadId: string; unlocked: boolean } } }).data;
  if (!data?.unlockChat) throw new Error('unlockChat failed');
  return data.unlockChat;
}

export async function graphqlCreateMessage(params: { matchId?: string; threadId?: string; body: string }) {
  const result = await getClient().graphql({
    query: CREATE_MESSAGE,
    variables: params,
  });
  const data = (result as { data?: { createMessage?: unknown } }).data;
  if (!data?.createMessage) throw new Error('createMessage failed');
  return data.createMessage as {
    id: string;
    threadId: string;
    createdAt: string;
    fromUserId: string;
    body: string;
    senderName?: string;
  };
}

export function graphqlSubscribeMessages(threadId: string, callback: (message: unknown) => void) {
  const client = getClient();
  const sub = client.graphql({
    query: ON_MESSAGE_CREATED,
    variables: { threadId },
  });
  if (typeof (sub as { subscribe?: (obs: { next: (v: unknown) => void }) => { unsubscribe: () => void } }).subscribe === 'function') {
    return (sub as { subscribe: (obs: { next: (v: unknown) => void }) => { unsubscribe: () => void } }).subscribe({
      next: (value: unknown) => {
        const v = value as { data?: { onMessageCreated?: unknown } };
        if (v?.data?.onMessageCreated) callback(v.data.onMessageCreated);
      },
    });
  }
  return { unsubscribe: () => {} };
}

export async function graphqlSeedDemoData() {
  const result = await getClient().graphql({
    query: SEED_DEMO_DATA,
  });
  const data = (result as { data?: { seedDemoData?: { created: number; message: string } } }).data;
  if (!data?.seedDemoData) throw new Error('seedDemoData failed');
  return data.seedDemoData;
}

export { isGraphQLEnabled };
