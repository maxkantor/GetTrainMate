using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Stripe;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/payment")]
[Authorize]
public class PaymentController : ControllerBase
{
    private readonly IPaymentService _paymentService;
    private readonly ILogger<PaymentController> _logger;
    private readonly StripeWebhookSecret _webhookSecret;

    public PaymentController(
        IPaymentService paymentService,
        ILogger<PaymentController> logger,
        StripeWebhookSecret webhookSecret)
    {
        _paymentService = paymentService;
        _logger = logger;
        _webhookSecret = webhookSecret;
    }

    private string GetUserId()
    {
        return User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
            ?? User.FindFirst("sub")?.Value 
            ?? throw new UnauthorizedAccessException("User ID not found");
    }

    [HttpPost("checkout")]
    public async Task<ActionResult<CheckoutSessionResponse>> CreateCheckoutSession(
        [FromBody] CreateCheckoutSessionRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.PlanType))
        {
            _logger.LogWarning("Checkout request missing PlanType");
            return BadRequest(new { error = "Plan type is required. Use { planType: \"pro\" } or { planType: \"elite\" }." });
        }

        try
        {
            var userId = GetUserId();
            _logger.LogInformation("Checkout request: plan={Plan}, userId={UserId}", request.PlanType, userId);

            var (sessionId, checkoutUrl) = await _paymentService.CreateCheckoutSessionAsync(userId, request.PlanType);

            _logger.LogInformation("Checkout session created for user {UserId}, redirecting to Stripe", userId);
            return Ok(new CheckoutSessionResponse { SessionId = sessionId, CheckoutUrl = checkoutUrl });
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning("Invalid plan type: {Message}", ex.Message);
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogError("Checkout config error: {Message}", ex.Message);
            return StatusCode(500, new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Checkout failed: {Message}", ex.Message);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("subscription-status")]
    public async Task<ActionResult<SubscriptionStatus>> GetSubscriptionStatus()
    {
        try
        {
            var userId = GetUserId();
            var status = await _paymentService.GetSubscriptionStatusAsync(userId);
            return Ok(status);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error retrieving subscription status: {ex.Message}");
            return StatusCode(500, new { error = "Failed to retrieve subscription status" });
        }
    }

    [HttpGet("payments")]
    public async Task<ActionResult<List<Payment>>> GetUserPayments([FromQuery] int limit = 20)
    {
        try
        {
            var userId = GetUserId();
            var payments = await _paymentService.GetUserPaymentsAsync(userId, limit);
            return Ok(payments);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error retrieving payments: {ex.Message}");
            return StatusCode(500, new { error = "Failed to retrieve payments" });
        }
    }

    [HttpGet("payment/{paymentId}")]
    public async Task<ActionResult<Payment>> GetPayment(string paymentId)
    {
        try
        {
            var payment = await _paymentService.GetPaymentAsync(paymentId);
            var userId = GetUserId();

            // Only allow users to view their own payments
            if (payment.UserId != userId)
                return Forbid();

            return Ok(payment);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Payment not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error retrieving payment: {ex.Message}");
            return StatusCode(500, new { error = "Failed to retrieve payment" });
        }
    }

    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<ActionResult> HandleWebhook()
    {
        try
        {
            var json = await new StreamReader(HttpContext.Request.Body).ReadToEndAsync();
            var signature = Request.Headers["Stripe-Signature"].FirstOrDefault();

            Stripe.Event stripeEvent;
            if (!string.IsNullOrEmpty(_webhookSecret.Value) && !string.IsNullOrEmpty(signature))
            {
                stripeEvent = EventUtility.ConstructEvent(json, signature, _webhookSecret.Value);
            }
            else
            {
                _logger.LogWarning("Webhook secret not configured; skipping signature verification");
                stripeEvent = EventUtility.ParseEvent(json);
            }

            _logger.LogInformation("Received Stripe webhook: {Type}", stripeEvent.Type);

            // Handle payment success
            if (stripeEvent.Type == Events.CheckoutSessionCompleted)
            {
                var session = stripeEvent.Data.Object as Stripe.Checkout.Session;
                if (session?.PaymentStatus == "paid" && session.Metadata != null)
                {
                    if (!session.Metadata.TryGetValue("paymentId", out var paymentId) ||
                        !session.Metadata.TryGetValue("userId", out var userId))
                    {
                        _logger.LogWarning("Checkout session missing paymentId or userId in metadata");
                        return BadRequest(new { error = "Invalid session metadata" });
                    }
                    var paymentIntentId = session.PaymentIntentId ?? string.Empty;
                    await _paymentService.CompletePaymentAsync(paymentId, userId, paymentIntentId);
                    _logger.LogInformation("Payment completed for paymentId {PaymentId}", paymentId);
                }
            }

            return Ok();
        }
        catch (StripeException ex)
        {
            _logger.LogError($"Stripe webhook error: {ex.Message}");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Webhook processing error: {ex.Message}");
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("refund/{paymentId}")]
    public async Task<ActionResult> RefundPayment(string paymentId)
    {
        // Refunds are not available via API; admins should process refunds in Stripe Dashboard
        return StatusCode(403, new { error = "Refunds must be processed in the Stripe Dashboard. Contact support for assistance." });
    }
}
