namespace GetTrainMate.Api.Services.PartnerOutreach;

/// <summary>
/// TRAIN / VIBE / DATE relevance for partner prospects. Not every org is TRAIN-only.
/// </summary>
public static class PartnerAudience
{
    public static IReadOnlyList<string> RelevantModesFor(string? organizationType, string? name = null)
    {
        var type = (organizationType ?? "").Trim().ToLowerInvariant();
        var hay = $"{type} {(name ?? "").ToLowerInvariant()}";

        if (hay.Contains("date") || hay.Contains("social event") || hay.Contains("nightlife"))
            return new[] { "VIBE", "DATE" };

        return type switch
        {
            "pickleball" or "rec_sports" or "soccer" or "volleyball" or "tennis" or "swimming"
                or "event" or "event_organizer" => new[] { "TRAIN", "VIBE", "DATE" },
            "creator" or "influencer" or "community" => new[] { "VIBE", "DATE" },
            "run_club" or "cycling" or "hiking" or "outdoor_club" or "gym"
                or "crossfit_hyrox" or "personal_trainer" => new[] { "TRAIN", "VIBE" },
            _ => new[] { "TRAIN", "VIBE" },
        };
    }

    public static string PrimaryModeFor(IReadOnlyList<string> modes)
    {
        if (modes.Count >= 3) return "CROSS_MODE";
        if (modes.Count == 2 && modes.Contains("VIBE") && modes.Contains("DATE") && !modes.Contains("TRAIN"))
            return "VIBE";
        return modes.FirstOrDefault() ?? "TRAIN";
    }

    public static bool IsQualified(int score, int minScore) =>
        score > 0 && score >= minScore;

    public static string DeliveredTrackingStatus(string? sesConfigurationSet) =>
        string.IsNullOrWhiteSpace(sesConfigurationSet) ? "NOT TRACKED" : "CONFIGURED";
}
