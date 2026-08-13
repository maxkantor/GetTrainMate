using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DataModel;
using Amazon.DynamoDBv2.DocumentModel;
using Stripe;
using Stripe.Checkout;
using GetTrainMate.Api.Infrastructure;
using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public class PaymentService : IPaymentService
{
    private readonly IDynamoDBContext _context;
    private readonly ILogger<PaymentService> _logger;

    // Pricing aligned with frontend: Free | Pro | Elite (monthly only)
    private readonly Dictionary<string, (decimal amount, string description)> PricingPlans = new()
    {
        { "pro", (5.99m, "Pro - Monthly") },
        { "elite", (9.99m, "Elite - Monthly") },
        // Legacy plans kept for backward compatibility
        { "premium_monthly", (9.99m, "Premium - Monthly") },
        { "premium_yearly", (89.99m, "Premium - Yearly") },
        { "lifetime", (199.99m, "Premium - Lifetime Access") }
    };

    public PaymentService(IDynamoDBContext context, ILogger<PaymentService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<(string SessionId, string CheckoutUrl)> CreateCheckoutSessionAsync(
        string userId,
        string planType,
        IDictionary<string, string>? attribution = null)
    {
        _logger.LogInformation("CreateCheckoutSession: plan={Plan}, userId={UserId}", planType, userId);

        if (!PricingPlans.ContainsKey(planType))
        {
            _logger.LogWarning("Invalid plan type: {Plan}", planType);
            throw new ArgumentException($"Invalid plan type: {planType}");
        }

        var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL");
        if (string.IsNullOrWhiteSpace(frontendUrl))
        {
            _logger.LogError("FRONTEND_URL env var is not set");
            throw new InvalidOperationException("FRONTEND_URL environment variable is not configured. Set it to your app URL (e.g. https://yourdomain.com).");
        }

        var stripeKey = Environment.GetEnvironmentVariable("STRIPE_SECRET_KEY")
            ?? Stripe.StripeConfiguration.ApiKey;
        if (string.IsNullOrWhiteSpace(stripeKey))
        {
            _logger.LogError("Stripe secret key not found. Set STRIPE_SECRET_KEY env or /gettrainmate/stripe/secret-key in SSM.");
            throw new InvalidOperationException("Stripe is not configured. Set STRIPE_SECRET_KEY or add /gettrainmate/stripe/secret-key to SSM Parameter Store.");
        }

        var (amount, description) = PricingPlans[planType];

        try
        {
            var paymentId = Guid.NewGuid().ToString();
            var metadata = new Dictionary<string, string>
            {
                { StripeSessionOwnership.AppSourceKey, StripeSessionOwnership.AppSourceValue },
                { "userId", userId },
                { "planType", planType },
                { "paymentId", paymentId }
            };
            StripeAcquisitionMetadata.MergeInto(metadata, attribution);

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
                SuccessUrl = $"{frontendUrl.TrimEnd('/')}/app/subscription?session_id={{CHECKOUT_SESSION_ID}}&success=true",
                CancelUrl = $"{frontendUrl.TrimEnd('/')}/pricing?canceled=1",
                Metadata = metadata
            };

            var service = new SessionService();
            var session = await service.CreateAsync(options);

            // Store payment record as pending (paymentId in metadata for webhook lookup)
            var payment = new Payment
            {
                PaymentId = paymentId,
                UserId = userId,
                StripeSessionId = session.Id,
                Amount = amount,
                PlanType = planType,
                Status = "pending"
            };

            await _context.SaveAsync(payment);
            _logger.LogInformation("Stripe checkout session created: sessionId={SessionId}, userId={UserId}, plan={Plan}, url={HasUrl}",
                session.Id, userId, planType, !string.IsNullOrEmpty(session.Url));

            if (string.IsNullOrEmpty(session.Url))
            {
                _logger.LogError("Stripe session has no URL");
                throw new InvalidOperationException("Stripe did not return a checkout URL.");
            }

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

    public async Task<bool> CompletePaymentAsync(string paymentId, string userId, string paymentIntentId)
    {
        try
        {
            var payment = await _context.LoadAsync<Payment>(paymentId, userId);
            if (payment == null)
                throw new KeyNotFoundException($"Payment {paymentId} not found");

            payment.Status = "completed";
            payment.StripePaymentIntentId = paymentIntentId;
            payment.CompletedAt = DateTime.UtcNow;

            await _context.SaveAsync(payment);

            // Grant entitlement (pro/elite = 1 month, yearly = 1 year, lifetime = no expiry)
            DateTime? expiresAt = payment.PlanType switch
            {
                "pro" => DateTime.UtcNow.AddMonths(1),
                "elite" => DateTime.UtcNow.AddMonths(1),
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

    public async Task<SubscriptionStatus> GetSubscriptionStatusAsync(string userId)
    {
        try
        {
            var entitlements = await _context.QueryAsync<Entitlement>(userId).GetRemainingAsync();
            var premiumEntitlement = entitlements.FirstOrDefault(e => e.EntitlementType == "premium");

            var payments = await GetUserPaymentsAsync(userId, 5);

            var isPremium = premiumEntitlement?.IsActive ?? false;
            // Return actual plan from latest payment (pro, elite, etc.) or "premium" for legacy
            var planType = isPremium
                ? (payments.FirstOrDefault(p => p.Status == "completed")?.PlanType ?? "premium")
                : "free";

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
