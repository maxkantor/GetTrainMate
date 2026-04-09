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
    Task<bool> GrantFreeSignupCreditsAsync(string userId, string? signupEmail = null);
    /// <summary>Admin: grant credits to a user (e.g. refund for failed AI).</summary>
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
}
