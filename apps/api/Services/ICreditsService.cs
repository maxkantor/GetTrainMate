using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

/// <summary>
/// Central credit engine: balance and entitlements in user-credits table; all spends go through <see cref="SpendCreditsAsync"/>
/// (with optional idempotency via <paramref name="idempotent"/> + <paramref name="refId"/>).
/// Discover send-interest: <see cref="ChargeLikeForDiscoverAsync"/> — 1 credit when balance &gt; 0 (idempotent per target), else up to 5 free UTC daily likes at 0 balance.
/// <see cref="CreditsBalanceDto.UnlimitedDiscovery"/> removes browse/deck caps only; it does not waive per-like credit costs when the user has a positive balance.
/// </summary>
public interface ICreditsService
{
    Task<(List<CreditPackDto> packs, string source)> GetActiveCreditPacksWithSourceAsync();
    Task<CreditPackDto?> GetPackByKeyAsync(string packKey);
    Task<string> CreateCreditsCheckoutSessionAsync(string userId, string packKey, string baseUrl);
    /// <summary>Apply purchased credits using Stripe session (idempotent). Used when user lands on success page so credits show immediately without relying on webhook timing. Returns null if session invalid or not paid.</summary>
    Task<CreditsBalanceDto?> ConfirmCreditsPurchaseAsync(string sessionId, string userId);
    Task RecordWebhookEventReceivedAsync(string eventId, string type);
    Task<bool> ProcessCheckoutSessionCompletedAsync(string stripeEventId, Stripe.Checkout.Session session);
    Task<CreditsBalanceDto> GetCreditsBalanceAsync(string userId);
    /// <param name="signupEmail">Cognito email claim when available (for admin notification).</param>
    Task<GrantFreeSignupCreditsResult> GrantFreeSignupCreditsAsync(string userId, string? signupEmail = null);
    /// <summary>True if the user already has a FREE_SIGNUP grant in the credit transaction ledger.</summary>
    Task<bool> HasReceivedFreeSignupCreditsAsync(string userId);
    /// <summary>Admin: grant credits to a user (compensation, promo, etc.).</summary>
    Task GrantCreditsAsync(string userId, int amount, string reason);
    /// <summary>
    /// Spend credits. Throws <see cref="Models.InsufficientCreditsException"/> if balance &lt; amount.
    /// When <paramref name="idempotent"/> is true and <paramref name="refId"/> is set, uses a deterministic transaction id so duplicate calls do not double-charge.
    /// </summary>
    Task SpendCreditsAsync(string userId, int amount, string reason, string? refId = null, bool idempotent = false);
    /// <summary>
    /// Discover send-interest: debits <see cref="Models.CreditRules.DiscoverSendLike"/> when balance &gt; 0 (idempotent per user+target).
    /// At 0 balance, consumes one of 5 free daily likes (UTC) and writes a zero-delta audit row.
    /// </summary>
    Task ChargeLikeForDiscoverAsync(string userId, string targetUserId);
    /// <summary>Admin: grant or revoke unlimited discovery browsing (does not waive like costs when user has credits).</summary>
    Task SetUnlimitedDiscoveryAsync(string userId, bool enabled);
    Task<List<CreditPackConfig>> GetAllCreditPacksForAdminAsync();
    Task SaveCreditPackAsync(CreditPackConfig pack);
    Task SeedDefaultCreditPacksIfEmptyAsync();
    /// <summary>Upsert canonical plans in DynamoDB and mark legacy pack keys inactive (admin migration).</summary>
    Task<int> SyncCanonicalCreditPacksAsync();

    /// <summary>Recent spend/grant/purchase rows for CRM (scan; capped).</summary>
    Task<IReadOnlyList<CreditTransactionAuditDto>> ListRecentTransactionsForUserAsync(string userId, int limit = 50);

    /// <summary>24h profile boost. If an active boost exists, extends end time by 24h from previous end.</summary>
    Task<CreditsBalanceDto> ActivateProfileBoost24hAsync(string userId);

    /// <summary>One-time reveal-likes entitlement (idempotent).</summary>
    Task<CreditsBalanceDto> UnlockRevealLikesAsync(string userId);
}

public class CreditPackDto
{
    public string Key { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public decimal PriceUsd { get; set; }
    public int Credits { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
    public bool IsBestValue { get; set; }
}

public class CreditsBalanceDto
{
    public int Balance { get; set; }
    public int LifetimeEarned { get; set; }
    /// <summary>When true, product may lift daily discover deck/browse caps (likes still follow balance/free-daily rules).</summary>
    public bool UnlimitedDiscovery { get; set; }
    /// <summary>UTC when profile boost ends, if any.</summary>
    public DateTime? BoostExpiresAtUtc { get; set; }
    /// <summary>User purchased permanent-style reveal-likes unlock (product uses flag for future UI).</summary>
    public bool RevealLikesUnlocked { get; set; }
}

public class CreditTransactionAuditDto
{
    public string Id { get; set; } = "";
    public string Type { get; set; } = "";
    public int CreditsDelta { get; set; }
    public string Reason { get; set; } = "";
    public string? RefId { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? BalanceBefore { get; set; }
    public int? BalanceAfter { get; set; }
}
