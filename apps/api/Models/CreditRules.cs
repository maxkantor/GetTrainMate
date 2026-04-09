using GetTrainMate.Api.Constants;

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
    /// <summary>AI Coach chat turn (general Q&amp;A).</summary>
    public const int AiCoachMessage = 1;
    public const int AiProfileOptimize = 2;
    public const int AiWorkoutPlan = 3;
    public const int ProfileBoost24h = 2;
    public const int RevealLikes = 3;
    public const int EventCreate = 2;
    public const int EventJoin = 1;

    public static int CostForPremiumAction(string actionType) => actionType switch
    {
        PremiumActionType.UnlockChat => ChatUnlock,
        PremiumActionType.AiIcebreaker => AiIcebreaker,
        PremiumActionType.AiCoachMessage => AiCoachMessage,
        PremiumActionType.DeeperMatchInsight => AiMatchInsight,
        PremiumActionType.ProfileBoost24h => ProfileBoost24h,
        PremiumActionType.RevealLikes => RevealLikes,
        PremiumActionType.AiWorkoutPlan => AiWorkoutPlan,
        PremiumActionType.AiProfileRewrite => AiProfileOptimize,
        _ => 0,
    };
}
