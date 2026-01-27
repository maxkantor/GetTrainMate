using Amazon.DynamoDBv2.DataModel;

namespace GetTrainMate.Api.Models;

[DynamoDBTable("gettrainmate-subscriptions")]
public class Subscription
{
    [DynamoDBHashKey]
    public string SubscriptionId { get; set; } = Guid.NewGuid().ToString();

    public string? StripeCustomerId { get; set; }
    
    [DynamoDBGlobalSecondaryIndexHashKey("userId-index")]
    public string? UserId { get; set; }
    
    [DynamoDBGlobalSecondaryIndexHashKey("status-index")]
    public string Status { get; set; } = "active"; // active, canceled, past_due, etc.
    
    public string PlanType { get; set; } = string.Empty; // premium_monthly, premium_yearly, etc.
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ExpiresAt { get; set; }
    public DateTime? CanceledAt { get; set; }
}
