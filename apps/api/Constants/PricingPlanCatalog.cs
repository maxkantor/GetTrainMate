namespace GetTrainMate.Api.Constants;

/// <summary>
/// Canonical credit pack definitions for GetTrainMate. Keep in sync with apps/web/src/config/pricingPlans.ts.
/// Legacy keys (FREE_3, PACK_*) remain valid for lookups and historical Stripe metadata; new purchases use canonical keys.
/// </summary>
public static class PricingPlanCatalog
{
    /// <summary>Ordered list used as server fallback when DynamoDB packs are unavailable.</summary>
    public static readonly IReadOnlyList<CreditPackFallbackDto> CanonicalPacks = new List<CreditPackFallbackDto>
    {
        new() { Key = "starter", Title = "Starter", PriceUsd = 0m, Credits = 3, SortOrder = 1, IsBestValue = false },
        new() { Key = "go", Title = "Go", PriceUsd = 2.99m, Credits = 10, SortOrder = 2, IsBestValue = false },
        new() { Key = "best_value", Title = "Best Value", PriceUsd = 6.99m, Credits = 30, SortOrder = 3, IsBestValue = true },
        new() { Key = "power", Title = "Power", PriceUsd = 14.99m, Credits = 80, SortOrder = 4, IsBestValue = false },
        new() { Key = "elite", Title = "Elite", PriceUsd = 29.99m, Credits = 200, SortOrder = 5, IsBestValue = false },
    };

    /// <summary>Old Dynamo/Stripe keys to deactivate after sync (never delete — preserves FK/history).</summary>
    public static readonly IReadOnlyList<string> LegacyPackKeys = new[] { "FREE_3", "PACK_10", "PACK_25", "PACK_100" };

    private static readonly Dictionary<string, string> LegacyToCanonical = new(StringComparer.OrdinalIgnoreCase)
    {
        ["FREE_3"] = "starter",
        ["PACK_10"] = "go",
        ["PACK_25"] = "best_value",
        ["PACK_100"] = "power",
    };

    /// <summary>Maps legacy or alias keys to canonical plan keys (starter, go, best_value, power, elite).</summary>
    public static string NormalizePackKey(string? packKey)
    {
        if (string.IsNullOrWhiteSpace(packKey)) return "";
        var k = packKey.Trim();
        if (LegacyToCanonical.TryGetValue(k, out var canonical)) return canonical;
        return k;
    }

    public static bool IsFreePackKey(string? packKey) =>
        string.Equals(NormalizePackKey(packKey), "starter", StringComparison.OrdinalIgnoreCase);

    public static CreditPackFallbackDto? TryGetFallbackPack(string? packKey)
    {
        if (string.IsNullOrWhiteSpace(packKey)) return null;
        var n = NormalizePackKey(packKey);
        return CanonicalPacks.FirstOrDefault(p => string.Equals(p.Key, n, StringComparison.OrdinalIgnoreCase));
    }
}
