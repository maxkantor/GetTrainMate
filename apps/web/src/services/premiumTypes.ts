/** Balance shape from POST /api/premium/* (matches server CreditsBalanceDto, camelCase JSON). */
export interface CreditsBalance {
  balance: number;
  lifetimeEarned: number;
  unlimitedDiscovery: boolean;
  boostExpiresAtUtc?: string | null;
  revealLikesUnlocked?: boolean;
}
