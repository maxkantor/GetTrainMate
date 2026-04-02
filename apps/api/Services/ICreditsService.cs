using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

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
    Task<bool> GrantFreeSignupCreditsAsync(string userId);
    /// <summary>Admin: grant credits to a user (e.g. refund for failed AI).</summary>
    Task GrantCreditsAsync(string userId, int amount, string reason);
    /// <summary>Spend credits. Throws <see cref="Models.InsufficientCreditsException"/> if balance &lt; amount.</summary>
    Task SpendCreditsAsync(string userId, int amount, string reason, string? refId = null);
    /// <summary>
    /// Discover like: if balance &gt; 0, unlimited likes (no charge). If balance is 0, consume one of 5 free daily likes (UTC).
    /// Throws <see cref="InsufficientCreditsException"/> when free quota is exhausted.
    /// </summary>
    Task ChargeLikeForDiscoverAsync(string userId, string targetUserId);
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
}
