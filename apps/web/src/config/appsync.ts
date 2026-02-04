/**
 * AppSync GraphQL API config (optional).
 * Set VITE_APPSYNC_GRAPHQL_URL and VITE_APPSYNC_REGION to use GraphQL for chat/discover/matches.
 */

export const APPSYNC_GRAPHQL_URL =
  import.meta.env.VITE_APPSYNC_GRAPHQL_URL || '';
export const APPSYNC_REGION =
  import.meta.env.VITE_APPSYNC_REGION || 'us-east-1';

export const isGraphQLEnabled = Boolean(
  APPSYNC_GRAPHQL_URL && APPSYNC_GRAPHQL_URL.startsWith('https://'),
);
