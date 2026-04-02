namespace GetTrainMate.Api.Models;

/// <summary>
/// Single source of truth for credit costs (server-side). UI may mirror for display only — never trust client for charging.
/// </summary>
public static class CreditRules
{
    public const int DiscoverSendLike = 1;
    public const int ChatUnlock = 1;
    public const int AiMatchInsight = 2;
    public const int AiIcebreaker = 1;
    public const int AiProfileOptimize = 2;
    public const int AiWorkoutPlan = 2;
    public const int EventCreate = 2;
    public const int EventJoin = 1;
}
