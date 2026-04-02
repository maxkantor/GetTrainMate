/**
 * GetTrainMate AppSync GraphQL operations (queries, mutations, subscriptions).
 * Used when VITE_APPSYNC_GRAPHQL_URL is set.
 */

export const GET_ME = /* GraphQL */ `
  query GetMe {
    getMe {
      user { id email isAdmin createdAt updatedAt }
      profile {
        userId displayName age city bio sports goals schedule avatarUrl level modes workoutStyle personalityTag isComplete updatedAt
      }
      credits
      lifetimeEarned
      isProfileComplete
    }
  }
`;

export const GET_PROFILE = /* GraphQL */ `
  query GetProfile($userId: ID!) {
    getProfile(userId: $userId) {
      userId displayName age city bio sports goals schedule avatarUrl level modes workoutStyle personalityTag isComplete updatedAt
    }
  }
`;

export const DISCOVER_CANDIDATES = /* GraphQL */ `
  query DiscoverCandidates($limit: Int, $nextToken: String) {
    discoverCandidates(limit: $limit, nextToken: $nextToken) {
      items {
        userId displayName age city bio sports goals avatarUrl level compatibilityScore
        modes intentMatchTier matchPreviewReasons lockedInsightReasons seenBefore
      }
      nextToken
    }
  }
`;

export const LIST_MY_MATCHES = /* GraphQL */ `
  query ListMyMatches {
    listMyMatches {
      items {
        matchId
        threadId
        unlockedByMe
        createdAt
        otherUserProfile {
          userId displayName age city bio sports goals avatarUrl
        }
      }
    }
  }
`;

export const GET_THREAD_BY_MATCH = /* GraphQL */ `
  query GetThreadByMatch($matchId: ID!) {
    getThreadByMatch(matchId: $matchId) {
      threadId matchId userA userB unlockedByUserA unlockedByUserB unlockedByCurrentUser
      createdAt updatedAt
      otherUserProfile { userId displayName age city bio sports avatarUrl }
    }
  }
`;

export const LIST_MESSAGES = /* GraphQL */ `
  query ListMessages($threadId: ID!, $limit: Int, $nextToken: String) {
    listMessages(threadId: $threadId, limit: $limit, nextToken: $nextToken) {
      items { id threadId createdAt fromUserId body senderName }
      nextToken
    }
  }
`;

export const ENSURE_FREE_START_CREDITS = /* GraphQL */ `
  mutation EnsureFreeStartCredits {
    ensureFreeStartCredits
  }
`;

export const LIKE_USER = /* GraphQL */ `
  mutation LikeUser($toUserId: ID!) {
    likeUser(toUserId: $toUserId) {
      matchId isMatched compatibilityScore
    }
  }
`;

export const PASS_USER = /* GraphQL */ `
  mutation PassUser($targetUserId: ID!) {
    passUser(targetUserId: $targetUserId)
  }
`;

export const UNLOCK_CHAT = /* GraphQL */ `
  mutation UnlockChat($matchId: ID!) {
    unlockChat(matchId: $matchId) {
      threadId unlocked
    }
  }
`;

export const CREATE_MESSAGE = /* GraphQL */ `
  mutation CreateMessage($matchId: ID, $threadId: ID, $body: String!) {
    createMessage(matchId: $matchId, threadId: $threadId, body: $body) {
      id threadId createdAt fromUserId body senderName
    }
  }
`;

export const ON_MESSAGE_CREATED = /* GraphQL */ `
  subscription OnMessageCreated($threadId: ID!) {
    onMessageCreated(threadId: $threadId) {
      id threadId createdAt fromUserId body senderName
    }
  }
`;

export const SEED_DEMO_DATA = /* GraphQL */ `
  mutation SeedDemoData {
    seedDemoData {
      created message
    }
  }
`;
