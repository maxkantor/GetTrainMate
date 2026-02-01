using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public interface IBillingService
{
    Task<List<BillingPlanDto>> GetActivePlansAsync();
    Task<(List<BillingPlanDto> plans, string source)> GetActivePlansWithSourceAsync();
    Task<List<BillingPlan>> GetAllPlansForAdminAsync();
    Task<BillingPlan?> GetPlanByKeyAsync(string key);
    Task SavePlanAsync(BillingPlan plan);
    Task<string> CreateCheckoutSessionAsync(string userId, string planKey, string baseUrl);
    Task SaveOrUpdateSubscriptionAsync(SubscriptionRecord record);
    Task<SubscriptionRecord?> GetSubscriptionByStripeIdAsync(string stripeSubscriptionId);
    Task<SubscriptionRecord?> GetActiveSubscriptionByUserIdAsync(string userId);
}

public class BillingPlanDto
{
    public string Key { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public decimal MonthlyPrice { get; set; }
    public List<string> Features { get; set; } = new();
    public bool IsConfigured { get; set; }
}

public class SubscriptionRecord
{
    public string SubscriptionId { get; set; } = string.Empty;
    public string? UserId { get; set; }
    public string? StripeCustomerId { get; set; }
    public string StripeSubscriptionId { get; set; } = string.Empty;
    public string PlanKey { get; set; } = string.Empty;
    public string Status { get; set; } = "active";
    public DateTime? CurrentPeriodEnd { get; set; }
    public bool CancelAtPeriodEnd { get; set; }
}
