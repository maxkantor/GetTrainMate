namespace GetTrainMate.Api.Constants;

/// <summary>Fallback credit packs when DB is empty or unavailable. Delegates to <see cref="PricingPlanCatalog"/>.</summary>
public static class CreditPacksFallback
{
    public static readonly IReadOnlyList<CreditPackFallbackDto> Packs = PricingPlanCatalog.CanonicalPacks;
}

public class CreditPackFallbackDto
{
    public string Key { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public decimal PriceUsd { get; set; }
    public int Credits { get; set; }
    public int SortOrder { get; set; }
    public bool IsBestValue { get; set; }
}
