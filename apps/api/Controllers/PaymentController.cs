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

    public PaymentController(IPaymentService paymentService, ILogger<PaymentController> logger)
    {
        _paymentService = paymentService;
        _logger = logger;
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
        try
        {
            var userId = GetUserId();
            var (sessionId, checkoutUrl) = await _paymentService.CreateCheckoutSessionAsync(userId, request.PlanType);

            _logger.LogInformation($"Created checkout session for user {userId}");
            return Ok(new CheckoutSessionResponse { SessionId = sessionId, CheckoutUrl = checkoutUrl });
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning($"Invalid plan type: {ex.Message}");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error creating checkout session: {ex.Message}");
            return StatusCode(500, new { error = "Failed to create checkout session" });
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
            var stripeEvent = EventUtility.ParseEvent(json);

            _logger.LogInformation($"Received Stripe webhook: {stripeEvent.Type}");

            // Handle payment success
            if (stripeEvent.Type == Events.CheckoutSessionCompleted)
            {
                var session = stripeEvent.Data.Object as Stripe.Checkout.Session;
                if (session?.PaymentStatus == "paid")
                {
                    var metadata = session.Metadata;
                    var planType = metadata["planType"];
                    var paymentIntentId = session.PaymentIntentId;

                    await _paymentService.CompletePaymentAsync(session.Id, paymentIntentId);
                    _logger.LogInformation($"Payment completed for session {session.Id}");
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
        try
        {
            var userId = GetUserId();
            var payment = await _paymentService.GetPaymentAsync(paymentId);

            // Only allow users to refund their own payments
            if (payment.UserId != userId)
                return Forbid();

            var success = await _paymentService.RefundPaymentAsync(paymentId);
            return success ? Ok(new { message = "Refund processed successfully" }) : BadRequest();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Payment not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error processing refund: {ex.Message}");
            return StatusCode(500, new { error = "Failed to process refund" });
        }
    }
}
