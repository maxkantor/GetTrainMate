using Amazon.DynamoDBv2.DataModel;

namespace GetTrainMate.Api.Models;

[DynamoDBTable("gettrainmate-subscriptions")]
public class Subscription
{
    [DynamoDBHashKey]
    public string SubscriptionId { get; set; } = string.Empty; // Use Stripe subscription ID for idempotency

    public string? StripeCustomerId { get; set; }

    [DynamoDBGlobalSecondaryIndexHashKey("userId-index")]
    public string? UserId { get; set; }

    [DynamoDBGlobalSecondaryIndexHashKey("status-index")]
    public string Status { get; set; } = "active"; // active, canceled, past_due, etc.

    public string PlanKey { get; set; } = string.Empty; // free | pro | elite
    public string PlanType { get; set; } = string.Empty; // legacy
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CurrentPeriodEnd { get; set; }
    public bool CancelAtPeriodEnd { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public DateTime? CanceledAt { get; set; }
}
