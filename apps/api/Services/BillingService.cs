using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DataModel;
using Amazon.DynamoDBv2.DocumentModel;
using Amazon.DynamoDBv2.Model;
using GetTrainMate.Api.Models;
using Stripe;
using Stripe.Checkout;

namespace GetTrainMate.Api.Services;

public class BillingService : IBillingService
{
    private readonly IDynamoDBContext _context;
    private readonly IAmazonDynamoDB _dynamoDb;
    private readonly ILogger<BillingService> _logger;
    private const string PlansTable = "gettrainmate-billing-plans";
    private const string SubscriptionsTable = "gettrainmate-subscriptions";

    public BillingService(
        IDynamoDBContext context,
        IAmazonDynamoDB dynamoDb,
        ILogger<BillingService> logger)
    {
        _context = context;
        _dynamoDb = dynamoDb;
        _logger = logger;
    }

    public async Task<List<BillingPlanDto>> GetActivePlansAsync()
    {
        var (plans, _) = await GetActivePlansWithSourceAsync();
        return plans;
    }

    public async Task<(List<BillingPlanDto> plans, string source)> GetActivePlansWithSourceAsync()
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, PlansTable);
            var scan = table.Scan(new ScanFilter());
            var docs = await scan.GetNextSetAsync();
            var plans = docs
                .Select(ToBillingPlan)
                .Where(p => p != null && p.IsActive)
                .OrderBy(p => p!.SortOrder)
                .ToList();
            if (plans.Count > 0)
            {
                var dtos = plans.Select(p => new BillingPlanDto
                {
                    Key = p!.Key,
                    DisplayName = p.DisplayName,
                    MonthlyPrice = p.MonthlyPrice,
                    Features = p.Features,
                    IsConfigured = p.Key == "free" || !string.IsNullOrWhiteSpace(p.StripePriceIdMonthly),
                }).ToList();
                return (dtos, "db");
            }
        }
        catch (ResourceNotFoundException ex)
        {
            _logger.LogWarning(ex, "Billing plans table not found. Return default plans.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error loading billing plans from DB. Return default plans.");
        }

        return (GetDefaultPlans(), "default");
    }

    private static List<BillingPlanDto> GetDefaultPlans()
    {
        return new List<BillingPlanDto>
        {
            new() { Key = "free", DisplayName = "Free", MonthlyPrice = 0, Features = new List<string> { "10 matches per day", "5 messages per day", "Basic filters" }, IsConfigured = true },
            new() { Key = "pro", DisplayName = "Pro", MonthlyPrice = 5.99m, Features = new List<string> { "Unlimited matches", "Unlimited messaging", "Advanced filters", "AI compatibility", "See who liked you" }, IsConfigured = false },
            new() { Key = "elite", DisplayName = "Elite", MonthlyPrice = 9.99m, Features = new List<string> { "Unlimited matches", "Unlimited messaging", "Advanced filters", "AI compatibility", "See who liked you", "Priority placement" }, IsConfigured = false },
        };
    }

    public async Task<List<BillingPlan>> GetAllPlansForAdminAsync()
    {
        var table = Table.LoadTable(_dynamoDb, PlansTable);
        var scan = table.Scan(new ScanFilter());
        var docs = await scan.GetNextSetAsync();
        return docs.Select(ToBillingPlan).Where(p => p != null).Cast<BillingPlan>().OrderBy(p => p.SortOrder).ToList();
    }

    public async Task<BillingPlan?> GetPlanByKeyAsync(string key)
    {
        var table = Table.LoadTable(_dynamoDb, PlansTable);
        var doc = await table.GetItemAsync(key);
        return doc != null ? ToBillingPlan(doc) : null;
    }

    public async Task SeedDefaultPlansIfEmptyAsync()
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, PlansTable);
            var scan = table.Scan(new ScanFilter());
            var docs = await scan.GetNextSetAsync();
            if (docs.Count > 0)
            {
                _logger.LogInformation("Billing plans already exist ({Count}). Skip seed.", docs.Count);
                return;
            }
        }
        catch (ResourceNotFoundException)
        {
            _logger.LogWarning("Billing plans table not found. Cannot seed.");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error checking billing plans. Attempting seed.");
        }

        var defaults = new[]
        {
            new BillingPlan { Key = "free", DisplayName = "Free", MonthlyPrice = 0, Features = new List<string> { "10 matches per day", "5 messages per day", "Basic filters" }, IsActive = true, SortOrder = 1, StripePriceIdMonthly = null },
            new BillingPlan { Key = "pro", DisplayName = "Pro", MonthlyPrice = 5.99m, Features = new List<string> { "Unlimited matches", "Unlimited messaging", "Advanced filters", "AI compatibility", "See who liked you" }, IsActive = true, SortOrder = 2, StripePriceIdMonthly = null },
            new BillingPlan { Key = "elite", DisplayName = "Elite", MonthlyPrice = 9.99m, Features = new List<string> { "Unlimited matches", "Unlimited messaging", "Advanced filters", "AI compatibility", "See who liked you", "Priority placement" }, IsActive = true, SortOrder = 3, StripePriceIdMonthly = null },
        };
        foreach (var plan in defaults)
        {
            await SavePlanAsync(plan);
        }
        _logger.LogInformation("Billing plans seeded (free, pro, elite).");
    }

    public async Task SavePlanAsync(BillingPlan plan)
    {
        var table = Table.LoadTable(_dynamoDb, PlansTable);
        plan.UpdatedAt = DateTime.UtcNow;
        var doc = new Document
        {
            ["Key"] = plan.Key,
            ["DisplayName"] = plan.DisplayName,
            ["MonthlyPrice"] = plan.MonthlyPrice,
            ["Features"] = new DynamoDBList(plan.Features.Select(f => new Primitive(f)).ToList()),
            ["IsActive"] = plan.IsActive,
            ["SortOrder"] = plan.SortOrder,
            ["CreatedAt"] = (plan.CreatedAt == default ? DateTime.UtcNow : plan.CreatedAt).ToString("O"),
            ["UpdatedAt"] = plan.UpdatedAt.ToString("O"),
        };
        if (!string.IsNullOrEmpty(plan.StripePriceIdMonthly))
            doc["StripePriceIdMonthly"] = plan.StripePriceIdMonthly;
        await table.PutItemAsync(doc);
    }

    public async Task<string> CreateCheckoutSessionAsync(string userId, string planKey, string baseUrl)
    {
        if (planKey != "pro" && planKey != "elite")
            throw new ArgumentException("Invalid plan key. Use pro or elite.");

        var plan = await GetPlanByKeyAsync(planKey);
        if (plan == null || !plan.IsActive)
            throw new InvalidOperationException($"Plan {planKey} not found or inactive.");
        if (plan.MonthlyPrice <= 0)
            throw new InvalidOperationException($"Plan {planKey} has invalid price. Set monthly price in Admin CRM → Billing Plans.");

        var baseUrlClean = baseUrl.TrimEnd('/');
        var successUrl = $"{baseUrlClean}/billing/success?session_id={{CHECKOUT_SESSION_ID}}";
        var cancelUrl = $"{baseUrlClean}/pricing?canceled=1";

        var amountCents = (long)(plan.MonthlyPrice * 100);
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
                        UnitAmount = amountCents,
                        ProductData = new SessionLineItemPriceDataProductDataOptions
                        {
                            Name = plan.DisplayName,
                            Description = $"GetTrainMate {plan.DisplayName} - Monthly",
                        },
                        Recurring = new SessionLineItemPriceDataRecurringOptions
                        {
                            Interval = "month",
                        },
                    },
                    Quantity = 1,
                },
            },
            Mode = "subscription",
            SuccessUrl = successUrl,
            CancelUrl = cancelUrl,
            Metadata = new Dictionary<string, string>
            {
                { "userId", userId },
                { "planKey", planKey },
            },
        };

        var service = new SessionService();
        var session = await service.CreateAsync(options);

        if (string.IsNullOrEmpty(session.Url))
            throw new InvalidOperationException("Stripe did not return a checkout URL.");

        _logger.LogInformation("Checkout session created for user {UserId}, plan {Plan}", userId, planKey);
        return session.Url;
    }

    public async Task<string?> ResolvePlanKeyFromPriceIdAsync(string priceId)
    {
        if (string.IsNullOrWhiteSpace(priceId)) return null;
        foreach (var key in new[] { "pro", "elite" })
        {
            var plan = await GetPlanByKeyAsync(key);
            if (plan?.StripePriceIdMonthly == priceId)
                return key;
        }
        return null;
    }

    public async Task SaveOrUpdateSubscriptionAsync(SubscriptionRecord record)
    {
        var table = Table.LoadTable(_dynamoDb, SubscriptionsTable);
        var existing = await GetSubscriptionByStripeIdAsync(record.StripeSubscriptionId);
        if (existing != null)
        {
            _logger.LogInformation("Subscription {Id} already exists, updating", record.StripeSubscriptionId);
        }

        var doc = new Document
        {
            ["SubscriptionId"] = record.StripeSubscriptionId,
            ["StripeCustomerId"] = record.StripeCustomerId ?? "",
            ["UserId"] = record.UserId ?? "",
            ["PlanKey"] = record.PlanKey,
            ["PlanType"] = record.PlanKey,
            ["Status"] = record.Status,
            ["CurrentPeriodEnd"] = record.CurrentPeriodEnd?.ToString("O") ?? "",
            ["CancelAtPeriodEnd"] = record.CancelAtPeriodEnd,
            ["CreatedAt"] = DateTime.UtcNow.ToString("O"),
            ["UpdatedAt"] = DateTime.UtcNow.ToString("O"),
        };

        await table.PutItemAsync(doc);
    }

    public async Task<SubscriptionRecord?> GetSubscriptionByStripeIdAsync(string stripeSubscriptionId)
    {
        var table = Table.LoadTable(_dynamoDb, SubscriptionsTable);
        try
        {
            var doc = await table.GetItemAsync(stripeSubscriptionId);
            if (doc == null) return null;
            return new SubscriptionRecord
            {
                SubscriptionId = doc["SubscriptionId"]?.AsString() ?? stripeSubscriptionId,
                StripeSubscriptionId = stripeSubscriptionId,
                UserId = doc.Contains("UserId") ? doc["UserId"].AsString() : null,
                StripeCustomerId = doc.Contains("StripeCustomerId") ? doc["StripeCustomerId"].AsString() : null,
                PlanKey = doc.Contains("PlanKey") ? doc["PlanKey"].AsString() : "",
                Status = doc.Contains("Status") ? doc["Status"].AsString() : "active",
            };
        }
        catch
        {
            return null;
        }
    }

    public async Task<SubscriptionRecord?> GetActiveSubscriptionByUserIdAsync(string userId)
    {
        var table = Table.LoadTable(_dynamoDb, SubscriptionsTable);
        var filter = new ScanFilter();
        filter.AddCondition("UserId", ScanOperator.Equal, userId);
        var search = table.Scan(filter);
        var docs = await search.GetNextSetAsync();
        var active = docs
            .Where(d => !d.Contains("Status") || d["Status"].AsString() == "active")
            .OrderByDescending(d => d.Contains("CreatedAt") ? d["CreatedAt"].AsString() : "")
            .FirstOrDefault();
        if (active == null) return null;
        return new SubscriptionRecord
        {
            SubscriptionId = active["SubscriptionId"].AsString(),
            StripeSubscriptionId = active["SubscriptionId"].AsString(),
            UserId = active.Contains("UserId") ? active["UserId"].AsString() : null,
            StripeCustomerId = active.Contains("StripeCustomerId") ? active["StripeCustomerId"].AsString() : null,
            PlanKey = active.Contains("PlanKey") ? active["PlanKey"].AsString() : "",
            Status = active.Contains("Status") ? active["Status"].AsString() : "active",
        };
    }

    private static BillingPlan? ToBillingPlan(Document doc)
    {
        if (!doc.Contains("Key")) return null;
        var features = new List<string>();
        if (doc.Contains("Features"))
        {
            try
            {
                features = doc["Features"].AsListOfString();
            }
            catch
            {
                features = new List<string>();
            }
        }
        var createdAt = DateTime.UtcNow;
        if (doc.Contains("CreatedAt") && DateTime.TryParse(doc["CreatedAt"].AsString(), out var ca))
            createdAt = ca;

        return new BillingPlan
        {
            Key = doc["Key"].AsString(),
            DisplayName = doc.Contains("DisplayName") ? doc["DisplayName"].AsString() : "",
            MonthlyPrice = doc.Contains("MonthlyPrice") ? doc["MonthlyPrice"].AsDecimal() : 0,
            Features = features,
            IsActive = !doc.Contains("IsActive") || doc["IsActive"].AsBoolean(),
            SortOrder = doc.Contains("SortOrder") ? doc["SortOrder"].AsInt() : 0,
            StripePriceIdMonthly = doc.Contains("StripePriceIdMonthly") ? doc["StripePriceIdMonthly"].AsString() : null,
            CreatedAt = createdAt,
        };
    }
}
