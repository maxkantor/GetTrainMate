using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using GetTrainMate.Api.Infrastructure;
using GetTrainMate.Api.Services;
using Stripe;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/billing")]
public class BillingController : ControllerBase
{
    private readonly IBillingService _billingService;
    private readonly ICreditsService _creditsService;
    private readonly StripeWebhookSecret _webhookSecret;
    private readonly ILogger<BillingController> _logger;
    private readonly IConfiguration _configuration;

    public BillingController(
        IBillingService billingService,
        ICreditsService creditsService,
        StripeWebhookSecret webhookSecret,
        ILogger<BillingController> logger,
        IConfiguration configuration)
    {
        _billingService = billingService;
        _creditsService = creditsService;
        _webhookSecret = webhookSecret;
        _logger = logger;
        _configuration = configuration;
    }

    [HttpGet("credit-packs")]
    [AllowAnonymous]
    public async Task<ActionResult<CreditPacksResponse>> GetCreditPacks()
    {
        try
        {
            var (packs, source) = await _creditsService.GetActiveCreditPacksWithSourceAsync();
            return Ok(new CreditPacksResponse { Packs = packs, Source = source });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching credit packs");
            return StatusCode(500, new { error = "Failed to load credit packs" });
        }
    }

    [HttpGet("credits-balance")]
    [AllowAnonymous]
    public async Task<ActionResult<CreditsBalanceDto>> GetCreditsBalance()
    {
        var userId = GetUserIdFromToken();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { error = "Valid authentication required." });
        var balance = await _creditsService.GetCreditsBalanceAsync(userId);
        return Ok(balance);
    }

    /// <summary>Apply purchased credits when user lands on success page (session_id). Idempotent; does not depend on webhook timing. Credits are calculated from single source: user-credits table.</summary>
    [HttpPost("confirm-credits-purchase")]
    [AllowAnonymous]
    public async Task<ActionResult<CreditsBalanceDto>> ConfirmCreditsPurchase([FromBody] ConfirmCreditsPurchaseRequest request)
    {
        var userId = GetUserIdFromToken();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { error = "Valid authentication required." });
        if (request == null || string.IsNullOrWhiteSpace(request.SessionId))
            return BadRequest(new { error = "sessionId is required." });

        var balance = await _creditsService.ConfirmCreditsPurchaseAsync(request.SessionId.Trim(), userId);
        if (balance == null)
            return BadRequest(new { error = "Could not confirm purchase. Session may be invalid or already applied." });
        return Ok(balance);
    }

    [HttpGet("free-signup-status")]
    [AllowAnonymous]
    public async Task<ActionResult> GetFreeSignupStatus()
    {
        var userId = GetUserIdFromToken();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { error = "Valid authentication required." });
        var claimed = await _creditsService.HasReceivedFreeSignupCreditsAsync(userId);
        return Ok(new { claimed });
    }

    [HttpPost("grant-free-signup")]
    [AllowAnonymous]
    public async Task<ActionResult> GrantFreeSignup()
    {
        var userId = GetUserIdFromToken();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { error = "Valid authentication required." });
        var email = GetEmailFromToken();
        var name = GetNameFromToken();
        var result = await _creditsService.GrantFreeSignupCreditsAsync(userId, email, name);
        if (!result.Success)
            return BadRequest(new { error = "Could not grant free credits." });
        return Ok(new
        {
            message = result.AlreadyGranted ? "Free credits were already granted." : "Free credits granted.",
            credits = 3,
            alreadyGranted = result.AlreadyGranted,
        });
    }

    [HttpPost("seed")]
    [AllowAnonymous]
    public async Task<ActionResult> SeedPlans()
    {
        try
        {
            await _billingService.SeedDefaultPlansIfEmptyAsync();
            return Ok(new { message = "Plans seeded. Prices are sent directly from plans." });
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

    [HttpPost("confirm-session")]
    [AllowAnonymous]
    public async Task<ActionResult> ConfirmSession([FromBody] ConfirmSessionRequest request)
    {
        var userId = GetUserIdFromToken();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { error = "Valid authentication required." });
        if (request == null || string.IsNullOrWhiteSpace(request.SessionId))
            return BadRequest(new { error = "sessionId is required." });
        var ok = await _billingService.ConfirmCheckoutSessionAsync(request.SessionId, userId);
        return ok ? Ok(new { message = "Subscription confirmed." }) : BadRequest(new { error = "Could not confirm session." });
    }

    [HttpPost("create-checkout-session")]
    [AllowAnonymous]
    public async Task<ActionResult<CreateCheckoutResponse>> CreateCheckoutSession(
        [FromBody] CreateCheckoutRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.PackKey))
        {
            return BadRequest(new { error = "packKey is required (e.g. go, best_value, power, elite)." });
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
            var url = await _creditsService.CreateCreditsCheckoutSessionAsync(
                userId,
                request.PackKey,
                baseUrl,
                request.Attribution);
            return Ok(new CreateCheckoutResponse { Url = url });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("Checkout failed: {Message}", ex.Message);
            var isConfigError = ex.Message.Contains("invalid price") || ex.Message.Contains("Admin CRM");
            return StatusCode(isConfigError ? 503 : 400, new { error = isConfigError ? "Credit packs are being configured. Set price in Admin CRM → Credit Packs." : ex.Message });
        }
        catch (StripeException ex) when (ex.Message?.Contains("Expired", StringComparison.OrdinalIgnoreCase) == true
            || ex.Message?.Contains("Invalid API Key", StringComparison.OrdinalIgnoreCase) == true)
        {
            _logger.LogError(ex, "Stripe API key invalid or expired");
            return StatusCode(503, new { error = "Payment configuration error. Update Stripe key in SSM: /gettrainmate/stripe/secret-key. See docs/STRIPE_SSM_SETUP.md" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Checkout failed");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("webhook")]
    [Route("~/stripe/webhook")]
    [Route("~/api/billing/webhook")]
    [AllowAnonymous]
    public async Task<ActionResult> HandleWebhook(CancellationToken cancellationToken)
    {
        var requestId = HttpContext.TraceIdentifier;
        var lambdaAwsRequestId = Environment.GetEnvironmentVariable("AWS_REQUEST_ID");
        _logger.LogInformation(
            "Stripe webhook ingress: requestId={RequestId} awsRequestId={AwsRequestId} path={Path} contentLength={ContentLength} xAmznTraceId={Trace}",
            requestId,
            lambdaAwsRequestId ?? "(n/a)",
            Request.Path.Value,
            Request.ContentLength,
            Request.Headers["X-Amzn-Trace-Id"].FirstOrDefault() ?? "(none)");

        var json = await StripeWebhookVerification.ReadRawBodyUtf8Async(Request, cancellationToken);
        var sigHeaderParts = Request.Headers["Stripe-Signature"].Count;
        var signature = StripeWebhookVerification.GetStripeSignatureHeader(Request.Headers);
        var bodySha = StripeWebhookVerification.BodySha256Prefix12(json);
        var sigT = StripeWebhookVerification.TryGetSignatureTimestamp(signature);
        var v1Count = StripeWebhookVerification.CountV1Signatures(signature);
        _logger.LogInformation(
            "Stripe webhook payload: requestId={RequestId} utf8Len={Len} bodySha256p12={Sha} hasStripeSignature={HasSig} stripeSigHeaderParts={SigParts} sigT={SigT} v1Signatures={V1}",
            requestId,
            json.Length,
            bodySha,
            !string.IsNullOrEmpty(signature),
            sigHeaderParts,
            sigT?.ToString(CultureInfo.InvariantCulture) ?? "(missing)",
            v1Count);

        Stripe.Event stripeEvent;
        if (_webhookSecret.HasSigningSecrets && !string.IsNullOrEmpty(signature))
        {
            if (!StripeWebhookVerification.TryConstructEvent(
                    json,
                    signature,
                    _webhookSecret.SigningSecrets,
                    out var verified,
                    out var verifyErr,
                    out var perSecretFailures))
            {
                _logger.LogWarning(
                    verifyErr,
                    "Stripe webhook signature verification failed: requestId={RequestId} secretsTried={Count} bodyLen={Len} bodySha256p12={Sha} lastExceptionMessage={Last} perSecret={Details}. " +
                    "Ensure SSM /gettrainmate/stripe/webhook-secret matches Signing secret for this exact endpoint URL in Stripe (Developers → Webhooks → endpoint → Signing secret).",
                    requestId,
                    _webhookSecret.SigningSecrets.Count,
                    json.Length,
                    bodySha,
                    verifyErr?.Message ?? "(none)",
                    string.Join(" || ", perSecretFailures));
                return BadRequest(new { error = "Invalid signature", requestId });
            }
            stripeEvent = verified!;
        }
        else if (!_webhookSecret.HasSigningSecrets)
        {
            _logger.LogWarning("Webhook secret not configured; skipping verification");
            stripeEvent = EventUtility.ParseEvent(json);
        }
        else
        {
            return BadRequest(new { error = "Missing Stripe-Signature header" });
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
        if (session == null) return;

        if (session.Mode == "payment")
        {
            await _creditsService.ProcessCheckoutSessionCompletedAsync(evt.Id, session);
            return;
        }

        if (session.SubscriptionId == null) return;

        if (!StripeSessionOwnership.IsGetTrainMateSubscription(session))
        {
            _logger.LogInformation(
                "Stripe webhook: ignoring subscription checkout session {SessionId} (not GetTrainMate; shared Stripe account).",
                session.Id);
            return;
        }

        var subscriptionService = new Stripe.SubscriptionService();
        var subscription = await subscriptionService.GetAsync(session.SubscriptionId);
        await UpsertSubscription(subscription, session.Metadata);
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
        if (!await IsGetTrainMateStripeSubscriptionAsync(stripeSubscription, metadata))
        {
            _logger.LogInformation(
                "Ignoring subscription upsert for {SubId} (not GetTrainMate; shared Stripe account).",
                stripeSubscription.Id);
            return;
        }

        var priceId = stripeSubscription.Items?.Data?.FirstOrDefault()?.Price?.Id;
        var planKey = await ResolvePlanKeyFromPriceId(priceId) ?? metadata?.GetValueOrDefault("planKey") ?? "unknown";

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

    private async Task<string?> ResolvePlanKeyFromPriceId(string? priceId)
    {
        if (string.IsNullOrEmpty(priceId)) return null;
        return await _billingService.ResolvePlanKeyFromPriceIdAsync(priceId);
    }

    /// <summary>Stripe sends the same events to every webhook URL on the account — only persist ours.</summary>
    private async Task<bool> IsGetTrainMateStripeSubscriptionAsync(
        Stripe.Subscription stripeSubscription,
        Dictionary<string, string>? sessionMetadata)
    {
        var priceId = stripeSubscription.Items?.Data?.FirstOrDefault()?.Price?.Id;
        var planFromOurCatalog = await ResolvePlanKeyFromPriceId(priceId);
        if (!string.IsNullOrEmpty(planFromOurCatalog))
            return true;

        var m = sessionMetadata ?? stripeSubscription.Metadata;
        return StripeSessionOwnership.IsGetTrainMateSubscriptionMeta(m);
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

    private string? GetEmailFromToken()
    {
        var email = User.FindFirst("email")?.Value
            ?? User.FindFirst(ClaimTypes.Email)?.Value;
        if (!string.IsNullOrEmpty(email)) return email;

        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
            return null;

        var token = authHeader.Substring("Bearer ".Length).Trim();
        try
        {
            var handler = new JwtSecurityTokenHandler();
            var jsonToken = handler.ReadJwtToken(token);
            return jsonToken.Claims.FirstOrDefault(c =>
                c.Type == "email" || c.Type == ClaimTypes.Email)?.Value;
        }
        catch
        {
            return null;
        }
    }

    private string? GetNameFromToken()
    {
        var name = User.FindFirst(ClaimTypes.Name)?.Value
            ?? User.FindFirst("name")?.Value
            ?? User.FindFirst("given_name")?.Value;
        if (!string.IsNullOrWhiteSpace(name)) return name.Trim();

        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
            return null;

        var token = authHeader.Substring("Bearer ".Length).Trim();
        try
        {
            var handler = new JwtSecurityTokenHandler();
            var jsonToken = handler.ReadJwtToken(token);
            name = jsonToken.Claims.FirstOrDefault(c =>
                c.Type == "name" || c.Type == "given_name" || c.Type == ClaimTypes.Name)?.Value;
            return string.IsNullOrWhiteSpace(name) ? null : name.Trim();
        }
        catch
        {
            return null;
        }
    }

    private string? GetBaseUrl()
    {
        var origin = Request.Headers["Origin"].FirstOrDefault();
        if (!string.IsNullOrEmpty(origin))
            return origin.TrimEnd('/');

        // Lambda/API Gateway: Host is often the API host — prefer configured public app URL for Stripe return URLs.
        var configured =
            Environment.GetEnvironmentVariable("FRONTEND_URL")?.Trim().TrimEnd('/')
            ?? _configuration["FRONTEND_URL"]?.Trim().TrimEnd('/')
            ?? _configuration["Frontend:BaseUrl"]?.Trim().TrimEnd('/');
        if (!string.IsNullOrEmpty(configured))
            return configured;

        var host = Request.Headers["Host"].FirstOrDefault();
        var scheme = Request.Headers["X-Forwarded-Proto"].FirstOrDefault() ?? Request.Scheme;
        if (string.IsNullOrEmpty(host))
            return null;
        if (host.Contains("execute-api", StringComparison.OrdinalIgnoreCase)
            || host.Contains("amazonaws.com", StringComparison.OrdinalIgnoreCase))
            return null;

        return $"{scheme}://{host}".TrimEnd('/');
    }
}

public class ConfirmSessionRequest
{
    public string SessionId { get; set; } = string.Empty;
}

public class ConfirmCreditsPurchaseRequest
{
    public string SessionId { get; set; } = string.Empty;
}

public class CreateCheckoutRequest
{
    public string PlanKey { get; set; } = string.Empty;
    public string PackKey { get; set; } = string.Empty;
    /// <summary>Non-PII acquisition params for Stripe metadata / EXP attribution.</summary>
    public Dictionary<string, string>? Attribution { get; set; }
}

public class CreditPacksResponse
{
    public List<CreditPackDto> Packs { get; set; } = new();
    public string Source { get; set; } = "default";
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
