using Amazon.DynamoDBv2.DataModel;
using System.ComponentModel.DataAnnotations;

namespace GetTrainMate.Api.Models;

[DynamoDBTable("payments")]
public class Payment
{
    [DynamoDBHashKey]
    public string PaymentId { get; set; } = Guid.NewGuid().ToString();

    [DynamoDBRangeKey]
    public string UserId { get; set; }

    public string StripePaymentIntentId { get; set; }
    public string StripeSessionId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "usd";
    public string Status { get; set; } // pending, completed, failed, refunded
    public string PlanType { get; set; } // premium_monthly, premium_yearly, lifetime
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
    public string? FailureReason { get; set; }
}

[DynamoDBTable("entitlements")]
public class Entitlement
{
    [DynamoDBHashKey]
    public string UserId { get; set; }

    [DynamoDBRangeKey]
    public string EntitlementType { get; set; } // premium, admin

    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ExpiresAt { get; set; } // null for lifetime
}

public class CreateCheckoutSessionRequest
{
    [Required]
    public string PlanType { get; set; } // premium_monthly, premium_yearly, lifetime

    /// <summary>Non-PII acquisition params (src/utm/metro/experiment_id) for Stripe metadata.</summary>
    public Dictionary<string, string>? Attribution { get; set; }
}

public class CheckoutSessionResponse
{
    public string SessionId { get; set; }
    public string CheckoutUrl { get; set; }
}

public class PaymentWebhookPayload
{
    public string Type { get; set; }
    public PaymentWebhookData Data { get; set; }
}

public class PaymentWebhookData
{
    public string Id { get; set; }
    public string Status { get; set; }
    public Dictionary<string, string> Metadata { get; set; }
}

public class SubscriptionStatus
{
    public bool IsPremium { get; set; }
    public string PlanType { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public List<Payment> RecentPayments { get; set; } = new();
}
