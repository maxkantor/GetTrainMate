using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using GetTrainMate.Api.Services;
using Stripe;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/billing")]
public class BillingController : ControllerBase
{
    private readonly IBillingService _billingService;
    private readonly StripeWebhookSecret _webhookSecret;
    private readonly ILogger<BillingController> _logger;

    public BillingController(
        IBillingService billingService,
        StripeWebhookSecret webhookSecret,
        ILogger<BillingController> logger)
    {
        _billingService = billingService;
        _webhookSecret = webhookSecret;
        _logger = logger;
    }

    [HttpPost("seed")]
    [AllowAnonymous]
    public async Task<ActionResult> SeedPlans()
    {
        try
        {
            await _billingService.SeedDefaultPlansIfEmptyAsync();
            return Ok(new { message = "Plans seeded. Configure Stripe Price IDs for Pro and Elite in Admin CRM." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error seeding billing plans");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("plans")]
    [AllowAnonymous]
    public async Task<ActionResult<BillingPlansResponse>> GetPlans()
    {
        try
        {
            var (plans, source) = await _billingService.GetActivePlansWithSourceAsync();
            return Ok(new BillingPlansResponse { Plans = plans, Source = source });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching billing plans");
            return StatusCode(500, new { error = "Failed to load plans" });
        }
    }

    [HttpGet("subscription-status")]
    [AllowAnonymous]
    public async Task<ActionResult<SubscriptionStatusDto>> GetSubscriptionStatus()
    {
        var userId = GetUserIdFromToken();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { error = "Valid authentication required." });

        var sub = await _billingService.GetActiveSubscriptionByUserIdAsync(userId);
        return Ok(new SubscriptionStatusDto
        {
            IsPremium = sub != null && (sub.PlanKey == "pro" || sub.PlanKey == "elite"),
            PlanKey = sub?.PlanKey ?? "free",
            ExpiresAt = sub?.CurrentPeriodEnd?.ToString("O"),
            RecentPayments = new List<object>(),
        });
    }

    [HttpPost("create-checkout-session")]
    [AllowAnonymous]
    public async Task<ActionResult<CreateCheckoutResponse>> CreateCheckoutSession(
        [FromBody] CreateCheckoutRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.PlanKey))
        {
            return BadRequest(new { error = "planKey is required. Use \"pro\" or \"elite\"." });
        }

        var userId = GetUserIdFromToken();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { error = "Valid authentication required. Please sign in again." });

        var baseUrl = GetBaseUrl();
        if (string.IsNullOrEmpty(baseUrl))
        {
            _logger.LogWarning("Could not determine base URL from request");
            return StatusCode(500, new { error = "Could not determine app URL. Check request headers." });
        }

        try
        {
            var url = await _billingService.CreateCheckoutSessionAsync(userId, request.PlanKey, baseUrl);
            return Ok(new CreateCheckoutResponse { Url = url });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("Checkout failed: {Message}", ex.Message);
            var isConfigError = ex.Message.Contains("not configured") || ex.Message.Contains("Stripe Price") || ex.Message.Contains("no Stripe");
            return StatusCode(isConfigError ? 503 : 400, new { error = isConfigError ? "Billing not configured. Add Payment Link URLs to SSM." : ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Checkout failed");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<ActionResult> HandleWebhook()
    {
        var json = await new StreamReader(HttpContext.Request.Body).ReadToEndAsync();
        var signature = Request.Headers["Stripe-Signature"].FirstOrDefault();

        Stripe.Event stripeEvent;
        if (!string.IsNullOrEmpty(_webhookSecret.Value) && !string.IsNullOrEmpty(signature))
        {
            try
            {
                stripeEvent = EventUtility.ConstructEvent(json, signature, _webhookSecret.Value);
            }
            catch (StripeException ex)
            {
                _logger.LogWarning("Webhook signature verification failed: {Message}", ex.Message);
                return BadRequest(new { error = "Invalid signature" });
            }
        }
        else
        {
            _logger.LogWarning("Webhook secret not configured; skipping verification");
            stripeEvent = EventUtility.ParseEvent(json);
        }

        _logger.LogInformation("Stripe webhook: {Type}", stripeEvent.Type);

        try
        {
            switch (stripeEvent.Type)
            {
                case Events.CheckoutSessionCompleted:
                    await HandleCheckoutSessionCompleted(stripeEvent);
                    break;
                case "customer.subscription.created":
                case "customer.subscription.updated":
                    await HandleSubscriptionCreatedOrUpdated(stripeEvent);
                    break;
                case "customer.subscription.deleted":
                    await HandleSubscriptionDeleted(stripeEvent);
                    break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing webhook {Type}", stripeEvent.Type);
            return StatusCode(500, new { error = ex.Message });
        }

        return Ok();
    }

    private async Task HandleCheckoutSessionCompleted(Stripe.Event evt)
    {
        var session = evt.Data.Object as Stripe.Checkout.Session;
        if (session?.SubscriptionId == null) return;

        var subscriptionService = new Stripe.SubscriptionService();
        var subscription = await subscriptionService.GetAsync(session.SubscriptionId);
        var metadata = session.Metadata != null ? new Dictionary<string, string>(session.Metadata) : new Dictionary<string, string>();
        // Payment Links pass userId__planKey in client_reference_id
        if (!string.IsNullOrEmpty(session.ClientReferenceId) && session.ClientReferenceId.Contains("__"))
        {
            var parts = session.ClientReferenceId.Split(new[] { "__" }, 2, StringSplitOptions.None);
            if (parts.Length == 2)
            {
                if (!metadata.ContainsKey("userId")) metadata["userId"] = parts[0];
                if (!metadata.ContainsKey("planKey")) metadata["planKey"] = parts[1];
            }
        }
        await UpsertSubscription(subscription, metadata);
    }

    private async Task HandleSubscriptionCreatedOrUpdated(Stripe.Event evt)
    {
        var stripeSubscription = evt.Data.Object as Stripe.Subscription;
        if (stripeSubscription == null) return;

        await UpsertSubscription(stripeSubscription, null);
    }

    private async Task HandleSubscriptionDeleted(Stripe.Event evt)
    {
        var stripeSubscription = evt.Data.Object as Stripe.Subscription;
        if (stripeSubscription == null) return;

        var existing = await _billingService.GetSubscriptionByStripeIdAsync(stripeSubscription.Id);
        if (existing == null) return;

        await _billingService.SaveOrUpdateSubscriptionAsync(new SubscriptionRecord
        {
            StripeSubscriptionId = stripeSubscription.Id,
            UserId = existing.UserId,
            StripeCustomerId = stripeSubscription.CustomerId,
            PlanKey = existing.PlanKey,
            Status = "canceled",
            CurrentPeriodEnd = null,
            CancelAtPeriodEnd = false,
        });
    }

    private async Task UpsertSubscription(Stripe.Subscription stripeSubscription, Dictionary<string, string>? metadata)
    {
        var planKey = metadata?.GetValueOrDefault("planKey") ?? "unknown";

        string? userId = metadata?.GetValueOrDefault("userId");
        if (string.IsNullOrEmpty(userId))
        {
            var customerId = stripeSubscription.CustomerId;
            userId = await ResolveUserIdFromCustomer(customerId);
        }

        var record = new SubscriptionRecord
        {
            StripeSubscriptionId = stripeSubscription.Id,
            StripeCustomerId = stripeSubscription.CustomerId,
            UserId = userId,
            PlanKey = planKey,
            Status = stripeSubscription.Status ?? "active",
            CurrentPeriodEnd = stripeSubscription.CurrentPeriodEnd,
            CancelAtPeriodEnd = stripeSubscription.CancelAtPeriodEnd,
        };

        await _billingService.SaveOrUpdateSubscriptionAsync(record);
    }

    private async Task<string?> ResolveUserIdFromCustomer(string? customerId)
    {
        if (string.IsNullOrEmpty(customerId)) return null;
        var customerService = new Stripe.CustomerService();
        var customer = await customerService.GetAsync(customerId);
        var email = customer.Email;
        if (string.IsNullOrEmpty(email)) return null;
        // Could look up user by email - for now return null; webhook will store customerId for later linking
        return null;
    }

    private string? GetUserIdFromToken()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        if (!string.IsNullOrEmpty(userId)) return userId;

        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
            return null;

        var token = authHeader.Substring("Bearer ".Length).Trim();
        try
        {
            var handler = new JwtSecurityTokenHandler();
            var jsonToken = handler.ReadJwtToken(token);
            return jsonToken.Claims.FirstOrDefault(c => c.Type == "sub" || c.Type == ClaimTypes.NameIdentifier)?.Value;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Billing: failed to parse JWT");
            return null;
        }
    }

    private string? GetBaseUrl()
    {
        var origin = Request.Headers["Origin"].FirstOrDefault();
        if (!string.IsNullOrEmpty(origin)) return origin;

        var host = Request.Headers["Host"].FirstOrDefault();
        var scheme = Request.Headers["X-Forwarded-Proto"].FirstOrDefault() ?? Request.Scheme;
        if (!string.IsNullOrEmpty(host))
            return $"{scheme}://{host}";

        return null;
    }
}

public class CreateCheckoutRequest
{
    public string PlanKey { get; set; } = string.Empty;
}

public class CreateCheckoutResponse
{
    public string Url { get; set; } = string.Empty;
}

public class SubscriptionStatusDto
{
    public bool IsPremium { get; set; }
    public string PlanKey { get; set; } = "free";
    public string? ExpiresAt { get; set; }
    public List<object> RecentPayments { get; set; } = new();
}

public class BillingPlansResponse
{
    public List<BillingPlanDto> Plans { get; set; } = new();
    public string Source { get; set; } = "default";
}
