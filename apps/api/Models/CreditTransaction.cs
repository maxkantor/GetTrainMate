namespace GetTrainMate.Api.Models;

/// <summary>Credit transaction types.</summary>
public static class CreditTransactionType
{
    public const string Grant = "GRANT";
    public const string Purchase = "PURCHASE";
    public const string Spend = "SPEND";
    public const string Adjustment = "ADJUSTMENT";
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
