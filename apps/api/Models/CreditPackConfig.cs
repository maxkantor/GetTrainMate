namespace GetTrainMate.Api.Models;

/// <summary>Credit pack config stored in DynamoDB (gettrainmate-credit-pack-config).</summary>
public class CreditPackConfig
{
    public string Key { get; set; } = string.Empty; // starter, go, best_value, power, elite (legacy: FREE_3, PACK_*)
    public string Title { get; set; } = string.Empty;
    public decimal PriceUsd { get; set; }
    public int Credits { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public bool IsBestValue { get; set; }
    public string? StripePriceId { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
