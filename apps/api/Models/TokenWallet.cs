using Amazon.DynamoDBv2.DataModel;

namespace GetTrainMate.Api.Models;

/// <summary>
/// User token wallet - stores token balances per user/device
/// </summary>
[DynamoDBTable("gettrainmate-token-wallets")]
public class TokenWallet
{
    [DynamoDBHashKey]
    public string WalletId { get; set; } = Guid.NewGuid().ToString();

    [DynamoDBGlobalSecondaryIndexHashKey("userId-index")]
    public string UserId { get; set; } = string.Empty;

    [DynamoDBGlobalSecondaryIndexHashKey("email-index")]
    public string Email { get; set; } = string.Empty; // lowercase

    public string? DeviceId { get; set; }
    public string? DeviceName { get; set; }
    public int TokenBalance { get; set; } = 0;
    public bool IsPrimary { get; set; } = false;
    public string? MergedInto { get; set; } // If merged, points to primary wallet
    public string? StripeCustomerId { get; set; }
    public DateTime LastActive { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Token ledger entries - immutable record of all token transactions
/// </summary>
[DynamoDBTable("gettrainmate-token-ledger")]
public class TokenLedgerEntry
{
    [DynamoDBHashKey]
    public string EntryId { get; set; } = Guid.NewGuid().ToString();

    [DynamoDBRangeKey]
    public string Timestamp { get; set; } = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");

    [DynamoDBGlobalSecondaryIndexHashKey("walletId-index")]
    public string WalletId { get; set; } = string.Empty;

    public string Type { get; set; } = string.Empty; // ADD, REMOVE, MERGE_OUT, MERGE_IN, RESET, etc.
    public int Amount { get; set; }
    public int BalanceBefore { get; set; }
    public int BalanceAfter { get; set; }
    public string? Reason { get; set; }
    public string? AdminSub { get; set; }
    public string? RelatedWalletId { get; set; } // For MERGE operations
}

/// <summary>
/// Stripe customer mapping
/// </summary>
[DynamoDBTable("gettrainmate-stripe-customers")]
public class StripeCustomer
{
    [DynamoDBHashKey]
    public string StripeCustomerId { get; set; } = string.Empty;

    [DynamoDBGlobalSecondaryIndexHashKey("email-index")]
    public string Email { get; set; } = string.Empty; // lowercase

    public string? UserId { get; set; }
    public string? WalletId { get; set; } // Primary wallet ID
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
