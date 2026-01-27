using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Amazon.DynamoDBv2.DataModel;
using System.Security.Claims;
using Stripe;
using SubscriptionModel = GetTrainMate.Api.Models.Subscription;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin/stripe")]
[Authorize]
public class AdminStripeController : ControllerBase
{
    private readonly IDynamoDBContext _context;
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<AdminStripeController> _logger;

    public AdminStripeController(
        IDynamoDBContext context,
        IAuditLogService auditLogService,
        ILogger<AdminStripeController> logger)
    {
        _context = context;
        _auditLogService = auditLogService;
        _logger = logger;
    }

    private AdminIdentity GetAdminIdentity()
    {
        if (HttpContext.Items["AdminIdentity"] is AdminIdentity identity)
        {
            return identity;
        }
        
        var sub = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
            ?? User.FindFirst("sub")?.Value 
            ?? throw new UnauthorizedAccessException("Admin identity not found");
        
        return new AdminIdentity
        {
            Sub = sub,
            CognitoUsername = User.FindFirst("cognito:username")?.Value,
            Email = User.FindFirst(ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value
        };
    }

    /// <summary>
    /// GET /api/admin/subscriptions?page=&pageSize=
    /// List Stripe subscriptions
    /// </summary>
    [HttpGet("subscriptions")]
    public async Task<ActionResult<PagedResponse<SubscriptionListItem>>> GetSubscriptions(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        try
        {
            // Query subscriptions table
            var subscriptions = await _context.ScanAsync<SubscriptionModel>(new List<ScanCondition>())
                .GetRemainingAsync();

            var paged = subscriptions
                .OrderByDescending(s => s.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(s => new SubscriptionListItem
                {
                    SubscriptionId = s.SubscriptionId,
                    UserId = s.UserId,
                    Status = s.Status,
                    PlanType = s.PlanType,
                    CreatedAt = s.CreatedAt,
                    ExpiresAt = s.ExpiresAt
                })
                .ToList();

            return Ok(new PagedResponse<SubscriptionListItem>
            {
                Items = paged,
                Page = page,
                PageSize = pageSize,
                TotalCount = subscriptions.Count,
                TotalPages = (int)Math.Ceiling(subscriptions.Count / (double)pageSize)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing subscriptions");
            return StatusCode(500, new { error = "Failed to list subscriptions" });
        }
    }

    /// <summary>
    /// POST /api/admin/stripe/sync
    /// Sync Stripe data with local database
    /// </summary>
    [HttpPost("sync")]
    public async Task<ActionResult<SyncResponse>> SyncStripe()
    {
        try
        {
            var admin = GetAdminIdentity();
            
            var service = new SubscriptionService();
            var options = new SubscriptionListOptions { Limit = 100 };
            var subscriptions = await service.ListAsync(options);

            int synced = 0;
            int errors = 0;

            foreach (var stripeSubscription in subscriptions)
            {
                try
                {
                    // Find or create subscription record
                    var subscription = await _context.LoadAsync<SubscriptionModel>(stripeSubscription.Id);
                    if (subscription == null)
                    {
                        subscription = new SubscriptionModel
                        {
                            SubscriptionId = stripeSubscription.Id,
                            StripeCustomerId = stripeSubscription.CustomerId,
                            Status = stripeSubscription.Status,
                            PlanType = stripeSubscription.Items.Data.FirstOrDefault()?.Price?.Nickname ?? "unknown",
                            CreatedAt = stripeSubscription.Created,
                            ExpiresAt = stripeSubscription.CurrentPeriodEnd
                        };
                    }
                    else
                    {
                        subscription.Status = stripeSubscription.Status;
                        subscription.ExpiresAt = stripeSubscription.CurrentPeriodEnd;
                    }

                    await _context.SaveAsync(subscription);
                    synced++;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error syncing subscription {SubscriptionId}", stripeSubscription.Id);
                    errors++;
                }
            }

            await _auditLogService.LogActionAsync(
                admin,
                "stripe.sync",
                "stripe",
                null,
                after: new { synced, errors, timestamp = DateTime.UtcNow });

            return Ok(new SyncResponse
            {
                Synced = synced,
                Errors = errors,
                Message = $"Synced {synced} subscriptions, {errors} errors"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing Stripe data");
            return StatusCode(500, new { error = "Failed to sync Stripe data" });
        }
    }
}

// Request/Response models
public class SubscriptionListItem
{
    public string SubscriptionId { get; set; } = string.Empty;
    public string? UserId { get; set; }
    public string Status { get; set; } = string.Empty;
    public string PlanType { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
}

public class SyncResponse
{
    public int Synced { get; set; }
    public int Errors { get; set; }
    public string Message { get; set; } = string.Empty;
}
