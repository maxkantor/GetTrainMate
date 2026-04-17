using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public interface IPaymentService
{
    Task<(string SessionId, string CheckoutUrl)> CreateCheckoutSessionAsync(string userId, string planType);
    Task<Payment> GetPaymentAsync(string paymentId);
    Task<bool> CompletePaymentAsync(string paymentId, string userId, string paymentIntentId);
    Task<SubscriptionStatus> GetSubscriptionStatusAsync(string userId);
    Task<List<Payment>> GetUserPaymentsAsync(string userId, int limit = 20);
    Task GrantEntitlementAsync(string userId, string entitlementType, DateTime? expiresAt);
    Task RevokeEntitlementAsync(string userId, string entitlementType);
    Task<bool> HasEntitlementAsync(string userId, string entitlementType);
}
