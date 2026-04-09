namespace GetTrainMate.Api.Models;

/// <summary>Credit transaction types.</summary>
public static class CreditTransactionType
{
    public const string Grant = "GRANT";
    public const string Purchase = "PURCHASE";
    public const string Spend = "SPEND";
    public const string Adjustment = "ADJUSTMENT";
}

/// <summary>Ledger reason for audit (align with product actions).</summary>
public static class CreditLedgerReason
{
    public const string FreeStart = "FREE_START";
    public const string Purchase = "PURCHASE";
    public const string Like = "LIKE";
    public const string ChatUnlock = "CHAT_UNLOCK";
    public const string Boost = "BOOST";
    public const string AiInsight = "AI_INSIGHT";
    public const string AiIcebreaker = "AI_ICEBREAKER";
    public const string AiWorkoutPlan = "AI_WORKOUT_PLAN";
    public const string AiProfileOptimize = "AI_PROFILE_OPTIMIZE";
    /// <summary>AI Coach general message (streaming or single).</summary>
    public const string AiCoachMessage = "AI_COACH_MESSAGE";
    public const string ProfileBoost24h = "PROFILE_BOOST_24H";
    public const string RevealLikes = "REVEAL_LIKES";
    public const string AdminAdjust = "ADMIN_ADJUST";
    public const string FreeDailyDiscoverLike = "FREE_DAILY_DISCOVER_LIKE";
    public const string EventCreate = "EVENT_CREATE";
    public const string EventJoin = "EVENT_JOIN";
}

/// <summary>Single credit transaction (gettrainmate-credit-transactions).</summary>
public class CreditTransaction
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty; // GRANT, PURCHASE, SPEND, ADJUSTMENT
    public int CreditsDelta { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? StripeCheckoutSessionId { get; set; }
    public string? StripePaymentIntentId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
