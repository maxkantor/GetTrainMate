/**
 * AppSync GraphQL service. Used when VITE_APPSYNC_GRAPHQL_URL is set.
 * Uses Amplify generateClient with userPool auth.
 */

import { generateClient } from 'aws-amplify/api';
import { isGraphQLEnabled, APPSYNC_GRAPHQL_URL } from '@/config/appsync';
import { IMAGE_BUCKET_BASE } from '@/config/media';
import {
  GET_ME,
  GET_PROFILE,
  DISCOVER_CANDIDATES,
  LIST_MY_MATCHES,
  GET_THREAD_BY_MATCH,
  LIST_MESSAGES,
  ENSURE_FREE_START_CREDITS,
  LIKE_USER,
  PASS_USER,
  UNLOCK_CHAT,
  CREATE_MESSAGE,
  ON_MESSAGE_CREATED,
  SEED_DEMO_DATA,
} from '@/api/operations';

/** Thrown when AppSync returns errors or missing data; carries status (e.g. 401) for callers. */
export class GraphQLApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly graphqlErrors?: Array<{ message?: string; extensions?: Record<string, unknown> }>
  ) {
    super(message);
    this.name = 'GraphQLApiError';
  }
}

function statusFromGraphQLErrors(errors: Array<{ message?: string; extensions?: Record<string, unknown> }> | undefined): number | undefined {
  if (!errors?.length) return undefined;
  const first = errors[0];
  const msg = (first?.message ?? '').toLowerCase();
  const ext = first?.extensions;
  if (ext?.errorType === 'Unauthorized' || ext?.code === 'UNAUTHENTICATED' || msg.includes('unauthorized') || msg.includes('not authorized')) return 401;
  if (ext?.errorType === 'Forbidden' || ext?.code === 'FORBIDDEN' || msg.includes('forbidden')) return 403;
  return undefined;
}

function checkResult<T>(result: { data?: T; errors?: Array<{ message?: string; extensions?: Record<string, unknown> }> }, getData: (data: T) => unknown, opName: string): void {
  const errors = result.errors;
  if (errors?.length) {
    const status = statusFromGraphQLErrors(errors);
    const msg = errors.map((e) => e.message ?? 'Unknown').join('; ');
    throw new GraphQLApiError(msg || `${opName} failed`, status, errors);
  }
  const data = result.data;
  if (data == null || getData(data) == null) {
    const status = statusFromGraphQLErrors(errors);
    throw new GraphQLApiError(`${opName} failed`, status, errors);
  }
}

function getClient() {
  if (!isGraphQLEnabled || !APPSYNC_GRAPHQL_URL) {
    throw new Error('GraphQL API is not configured. Set VITE_APPSYNC_GRAPHQL_URL.');
  }
  return generateClient({
    endpoint: APPSYNC_GRAPHQL_URL,
    authMode: 'userPool',
  });
}

/** Normalize thrown value: if it's an array (e.g. Amplify errors), use first element. */
function normalizeThrown(thrown: unknown): unknown {
  if (Array.isArray(thrown) && thrown.length > 0) return thrown[0];
  return thrown;
}

/** Derive status from a thrown error (Amplify/fetch may put statusCode, status, or body.errors). */
function statusFromThrownError(thrown: unknown): number | undefined {
  const o = normalizeThrown(thrown);
  if (o == null || typeof o !== 'object') return undefined;
  const obj = o as Record<string, unknown>;
  if (typeof obj.statusCode === 'number') return obj.statusCode;
  if (typeof obj.status === 'number') return obj.status;
  const res = obj.response as Record<string, unknown> | undefined;
  if (res && typeof res.status === 'number') return res.status;
  const body = (obj.body ?? res?.data) as { errors?: Array<{ message?: string; extensions?: Record<string, unknown> }> } | undefined;
  return body?.errors ? statusFromGraphQLErrors(body.errors) : undefined;
}

/** Errors array from a thrown error (or the array itself if it looks like GraphQL errors). */
function errorsFromThrown(thrown: unknown): Array<{ message?: string; extensions?: Record<string, unknown> }> | undefined {
  if (Array.isArray(thrown) && thrown.length > 0) {
    const first = thrown[0];
    if (first != null && typeof first === 'object' && 'message' in first) {
      return thrown as Array<{ message?: string; extensions?: Record<string, unknown> }>;
    }
    return undefined;
  }
  if (thrown == null || typeof thrown !== 'object') return undefined;
  const o = thrown as Record<string, unknown>;
  const errs = (o.errors ?? (o.body as { errors?: unknown[] })?.errors ?? (o.response as { data?: { errors?: unknown[] } })?.data?.errors) as Array<{ message?: string; extensions?: Record<string, unknown> }> | undefined;
  return Array.isArray(errs) ? errs : undefined;
}

/** Safe user-facing message from thrown value; never returns "[object Object]". */
function messageFromThrown(thrown: unknown): string {
  const o = normalizeThrown(thrown);
  if (o instanceof Error) return o.message || 'An unexpected error occurred';
  if (o != null && typeof o === 'object') {
    const obj = o as Record<string, unknown>;
    const msg = obj.message;
    if (typeof msg === 'string' && msg && !msg.includes('[object Object]')) return msg;
    const errs = errorsFromThrown(thrown);
    if (errs?.length && typeof errs[0].message === 'string') return errs[0].message;
  }
  return 'An unexpected error occurred';
}

export async function graphqlGetMe() {
  try {
    const result = await getClient().graphql({
      query: GET_ME,
    }) as { data?: { getMe?: unknown }; errors?: Array<{ message?: string; extensions?: Record<string, unknown> }> };
    checkResult(result, (d) => d.getMe, 'getMe');
    return (result.data as { getMe: {
      user: { id: string; email?: string; isAdmin?: boolean };
      profile: Record<string, unknown> | null;
      credits: number;
      isProfileComplete: boolean;
    } }).getMe;
  } catch (e) {
    const status = statusFromThrownError(e);
    const graphqlErrors = errorsFromThrown(e);
    const message = messageFromThrown(e);
    throw new GraphQLApiError(message, status, graphqlErrors);
  }
}

export async function graphqlGetProfile(userId: string) {
  try {
    const result = await getClient().graphql({
      query: GET_PROFILE,
      variables: { userId },
    }) as { data?: { getProfile?: { userId: string; displayName?: string; age?: number; city?: string; bio?: string; sports?: string[]; goals?: string[]; avatarUrl?: string; level?: string; mode?: string } | null }; errors?: Array<{ message?: string; extensions?: Record<string, unknown> }> };
    if (result.errors?.length) {
      const status = statusFromGraphQLErrors(result.errors);
      const message = result.errors.map((e) => e.message ?? 'Unknown').join('; ');
      throw new GraphQLApiError(message, status, result.errors);
    }
    const p = result.data?.getProfile ?? null;
    if (!p) return null;
    let avatarUrl = p.avatarUrl;
    if (avatarUrl && (avatarUrl.includes('randomuser.me') || avatarUrl.includes('randomuser.me/'))) {
      avatarUrl = undefined;
    }
    const photoUrl = avatarUrl?.startsWith('http') ? avatarUrl : (avatarUrl ? `${IMAGE_BUCKET_BASE}/${avatarUrl.replace(/^\//, '')}` : undefined);
    return {
      userId: p.userId,
      name: p.displayName ?? undefined,
      city: p.city ?? undefined,
      bio: p.bio ?? undefined,
      sportTags: p.sports ?? undefined,
      goals: p.goals,
      level: p.level ?? undefined,
      mode: p.mode ?? undefined,
      photoUrls: photoUrl ? [photoUrl] : undefined,
    };
  } catch (e) {
    const status = statusFromThrownError(e);
    const graphqlErrors = errorsFromThrown(e);
    const message = messageFromThrown(e);
    throw new GraphQLApiError(message, status, graphqlErrors);
  }
}

export async function graphqlDiscoverCandidates(limit?: number, nextToken?: string) {
  try {
    const result = await getClient().graphql({
      query: DISCOVER_CANDIDATES,
      variables: { limit: limit ?? 20, nextToken },
    }) as { data?: { discoverCandidates?: { items: unknown[]; nextToken?: string } }; errors?: Array<{ message?: string; extensions?: Record<string, unknown> }> };
    checkResult(result, (d) => d.discoverCandidates, 'discoverCandidates');
    return result.data!.discoverCandidates!;
  } catch (e) {
    const status = statusFromThrownError(e);
    const graphqlErrors = errorsFromThrown(e);
    const message = messageFromThrown(e);
    throw new GraphQLApiError(message, status, graphqlErrors);
  }
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

export async function graphqlPassUser(targetUserId: string) {
  const result = await getClient().graphql({
    query: PASS_USER,
    variables: { targetUserId },
  });
  const data = (result as { data?: { passUser?: boolean } }).data;
  if (data?.passUser !== true) throw new Error('passUser failed');
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
