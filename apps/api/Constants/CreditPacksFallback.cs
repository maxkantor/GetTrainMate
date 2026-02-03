namespace GetTrainMate.Api.Constants;

/// <summary>Fallback credit packs when DB is empty or unavailable. Single source of truth on server.</summary>
public static class CreditPacksFallback
{
    public static readonly IReadOnlyList<CreditPackFallbackDto> Packs = new List<CreditPackFallbackDto>
    {
        new() { Key = "FREE_3", Title = "Starter", PriceUsd = 0, Credits = 3, SortOrder = 1, IsBestValue = false },
        new() { Key = "PACK_10", Title = "10 Credits", PriceUsd = 3.99m, Credits = 10, SortOrder = 2, IsBestValue = false },
        new() { Key = "PACK_25", Title = "Best Value", PriceUsd = 7.99m, Credits = 25, SortOrder = 3, IsBestValue = true },
        new() { Key = "PACK_100", Title = "Power", PriceUsd = 19.99m, Credits = 100, SortOrder = 4, IsBestValue = false },
    };
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
