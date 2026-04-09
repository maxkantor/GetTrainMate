namespace GetTrainMate.Api.Configuration;

/// <summary>
/// Credit cost per AI feature. Configure in appsettings or env (e.g. AiCreditCosts:MatchInsight = 2).
/// </summary>
public class AiCreditCostsOptions
{
    public const string SectionName = "AiCreditCosts";

    public int MatchInsight { get; set; } = 2;
    public int Icebreakers { get; set; } = 1;
    public int WorkoutPlan { get; set; } = 3;
    /// <summary>Per AI Coach user message (1 = charge after successful reply).</summary>
    public int CoachPremiumAction { get; set; } = 1;
    public int ProfileOptimize { get; set; } = 2;
}
