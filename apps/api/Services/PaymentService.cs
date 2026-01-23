using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DataModel;
using Amazon.DynamoDBv2.DocumentModel;
using Stripe;
using Stripe.Checkout;
using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public class PaymentService : IPaymentService
{
    private readonly IDynamoDBContext _context;
    private readonly ILogger<PaymentService> _logger;

    private readonly Dictionary<string, (decimal amount, string description)> PricingPlans = new()
    {
        { "premium_monthly", (9.99m, "Premium - Monthly") },
        { "premium_yearly", (89.99m, "Premium - Yearly") },
        { "lifetime", (199.99m, "Premium - Lifetime Access") }
    };

    public PaymentService(IDynamoDBContext context, ILogger<PaymentService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<(string SessionId, string CheckoutUrl)> CreateCheckoutSessionAsync(string userId, string planType)
    {
        if (!PricingPlans.ContainsKey(planType))
            throw new ArgumentException($"Invalid plan type: {planType}");

        var (amount, description) = PricingPlans[planType];

        try
        {
            var options = new SessionCreateOptions
            {
                PaymentMethodTypes = new List<string> { "card" },
                LineItems = new List<SessionLineItemOptions>
                {
                    new()
                    {
                        PriceData = new SessionLineItemPriceDataOptions
                        {
                            Currency = "usd",
                            ProductData = new SessionLineItemPriceDataProductDataOptions
                            {
                                Name = description,
                                Description = $"GetTrainMate {description}",
                            },
                            UnitAmount = (long)(amount * 100), // Convert to cents
                        },
                        Quantity = 1,
                    }
                },
                Mode = "payment",
                SuccessUrl = $"{Environment.GetEnvironmentVariable("FRONTEND_URL")}/app/subscription?session_id={{CHECKOUT_SESSION_ID}}&success=true",
                CancelUrl = $"{Environment.GetEnvironmentVariable("FRONTEND_URL")}/app/subscription?canceled=true",
                Metadata = new Dictionary<string, string>
                {
                    { "userId", userId },
                    { "planType", planType }
                }
            };

            var service = new SessionService();
            var session = await service.CreateAsync(options);

            // Store payment record as pending
            var payment = new Payment
            {
                PaymentId = Guid.NewGuid().ToString(),
                UserId = userId,
                StripeSessionId = session.Id,
                Amount = amount,
                PlanType = planType,
                Status = "pending"
            };

            await _context.SaveAsync(payment);
            _logger.LogInformation($"Created checkout session {session.Id} for user {userId}, plan {planType}");

            return (session.Id, session.Url);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error creating checkout session: {ex.Message}");
            throw;
        }
    }

    public async Task<Payment> GetPaymentAsync(string paymentId)
    {
        try
        {
            var payment = await _context.LoadAsync<Payment>(paymentId);
            return payment ?? throw new KeyNotFoundException($"Payment {paymentId} not found");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error retrieving payment: {ex.Message}");
            throw;
        }
    }

    public async Task<bool> CompletePaymentAsync(string sessionId, string paymentIntentId)
    {
        try
        {
            var payments = await _context.QueryAsync<Payment>(sessionId).GetRemainingAsync();
            var payment = payments.FirstOrDefault();

            if (payment == null)
                throw new KeyNotFoundException($"Payment with session {sessionId} not found");

            payment.Status = "completed";
            payment.StripePaymentIntentId = paymentIntentId;
            payment.CompletedAt = DateTime.UtcNow;

            await _context.SaveAsync(payment);

            // Grant entitlement
            DateTime? expiresAt = payment.PlanType switch
            {
                "premium_monthly" => DateTime.UtcNow.AddMonths(1),
                "premium_yearly" => DateTime.UtcNow.AddYears(1),
                "lifetime" => null,
                _ => DateTime.UtcNow.AddMonths(1)
            };

            await GrantEntitlementAsync(payment.UserId, "premium", expiresAt);
            _logger.LogInformation($"Completed payment {payment.PaymentId} for user {payment.UserId}");

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error completing payment: {ex.Message}");
            throw;
        }
    }

    public async Task<bool> RefundPaymentAsync(string paymentId)
    {
        try
        {
            var payment = await GetPaymentAsync(paymentId);

            if (payment.Status != "completed")
                throw new InvalidOperationException("Only completed payments can be refunded");

            var options = new RefundCreateOptions
            {
                PaymentIntent = payment.StripePaymentIntentId,
                Reason = RefundReasons.RequestedByCustomer
            };

            var service = new RefundService();
            var refund = await service.CreateAsync(options);

            payment.Status = "refunded";
            await _context.SaveAsync(payment);

            // Revoke entitlement
            await RevokeEntitlementAsync(payment.UserId, "premium");
            _logger.LogInformation($"Refunded payment {paymentId}");

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error refunding payment: {ex.Message}");
            throw;
        }
    }

    public async Task<SubscriptionStatus> GetSubscriptionStatusAsync(string userId)
    {
        try
        {
            var entitlements = await _context.QueryAsync<Entitlement>(userId).GetRemainingAsync();
            var premiumEntitlement = entitlements.FirstOrDefault(e => e.EntitlementType == "premium");

            var payments = await GetUserPaymentsAsync(userId, 5);

            var isPremium = premiumEntitlement?.IsActive ?? false;
            var planType = isPremium ? "premium" : "none";

            return new SubscriptionStatus
            {
                IsPremium = isPremium,
                PlanType = planType,
                ExpiresAt = premiumEntitlement?.ExpiresAt,
                RecentPayments = payments
            };
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting subscription status: {ex.Message}");
            throw;
        }
    }

    public async Task<List<Payment>> GetUserPaymentsAsync(string userId, int limit = 20)
    {
        try
        {
            var payments = await _context.QueryAsync<Payment>(userId)
                .GetRemainingAsync();

            return payments
                .OrderByDescending(p => p.CreatedAt)
                .Take(limit)
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error retrieving user payments: {ex.Message}");
            throw;
        }
    }

    public async Task GrantEntitlementAsync(string userId, string entitlementType, DateTime? expiresAt)
    {
        try
        {
            var entitlement = new Entitlement
            {
                UserId = userId,
                EntitlementType = entitlementType,
                IsActive = true,
                ExpiresAt = expiresAt
            };

            await _context.SaveAsync(entitlement);
            _logger.LogInformation($"Granted {entitlementType} entitlement to user {userId}, expires: {expiresAt}");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error granting entitlement: {ex.Message}");
            throw;
        }
    }

    public async Task RevokeEntitlementAsync(string userId, string entitlementType)
    {
        try
        {
            var entitlements = await _context.QueryAsync<Entitlement>(userId).GetRemainingAsync();
            var entitlement = entitlements.FirstOrDefault(e => e.EntitlementType == entitlementType);

            if (entitlement != null)
            {
                entitlement.IsActive = false;
                await _context.SaveAsync(entitlement);
                _logger.LogInformation($"Revoked {entitlementType} entitlement from user {userId}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error revoking entitlement: {ex.Message}");
            throw;
        }
    }

    public async Task<bool> HasEntitlementAsync(string userId, string entitlementType)
    {
        try
        {
            var entitlements = await _context.QueryAsync<Entitlement>(userId).GetRemainingAsync();
            var entitlement = entitlements.FirstOrDefault(e => 
                e.EntitlementType == entitlementType && 
                e.IsActive &&
                (e.ExpiresAt == null || e.ExpiresAt > DateTime.UtcNow));

            return entitlement != null;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error checking entitlement: {ex.Message}");
            return false;
        }
    }
}
