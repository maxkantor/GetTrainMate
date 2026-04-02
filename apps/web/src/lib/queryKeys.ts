/** All TanStack Query keys include the authenticated Cognito `sub` to prevent cross-user cache hits. */

export const matchQueryKeys = {
  mutualMatches: (userSub: string) => ['gtm', 'mutualMatches', userSub] as const,
  sentRequests: (userSub: string) => ['gtm', 'sentRequests', userSub] as const,
  skippedProfiles: (userSub: string) => ['gtm', 'skippedProfiles', userSub] as const,
};
