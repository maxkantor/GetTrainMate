namespace GetTrainMate.Api.Models;

/// <summary>Stripe webhook event for idempotency (gettrainmate-stripe-webhook-events).</summary>
public class StripeWebhookEvent
{
    public string EventId { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAt { get; set; }
    public string Status { get; set; } = "RECEIVED"; // RECEIVED, PROCESSED, FAILED
    public string? Error { get; set; }
}
