namespace GetTrainMate.Api.Constants;

/// <summary>
/// Central premium action keys and display labels. Costs are in <see cref="Models.CreditRules"/> (server source of truth).
/// </summary>
public static class PremiumActionType
{
    public const string UnlockChat = "unlock_chat";
    public const string AiIcebreaker = "ai_icebreaker";
    public const string AiCoachMessage = "ai_coach_message";
    public const string DeeperMatchInsight = "deeper_match_insight";
    public const string ProfileBoost24h = "profile_boost_24h";
    public const string RevealLikes = "reveal_likes";
    public const string AiWorkoutPlan = "ai_workout_plan";
    public const string AiProfileRewrite = "ai_profile_rewrite";
}

public static class PremiumMonetizationLabels
{
    public static readonly IReadOnlyDictionary<string, string> ActionLabels = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        [PremiumActionType.UnlockChat] = "Unlock chat",
        [PremiumActionType.AiIcebreaker] = "AI Icebreaker",
        [PremiumActionType.AiCoachMessage] = "Ask AI Coach",
        [PremiumActionType.DeeperMatchInsight] = "Why You Match",
        [PremiumActionType.ProfileBoost24h] = "Profile Boost (24h)",
        [PremiumActionType.RevealLikes] = "Reveal Likes",
        [PremiumActionType.AiWorkoutPlan] = "AI Workout Plan",
        [PremiumActionType.AiProfileRewrite] = "Improve Profile with AI",
    };

    public static string LabelOrDefault(string actionType) =>
        ActionLabels.TryGetValue(actionType, out var l) ? l : actionType;
}
