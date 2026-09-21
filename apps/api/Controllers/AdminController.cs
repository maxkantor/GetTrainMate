using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Microsoft.AspNetCore.Http;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize] // Requires JWT authentication
public class AdminController : ControllerBase
{
    private readonly IAdminAuthorizationService _adminAuthService;
    private readonly IAuditLogService _auditLogService;
    private readonly IAdminNotificationService _adminNotify;
    private readonly ILogger<AdminController> _logger;

    public AdminController(
        IAdminAuthorizationService adminAuthService,
        IAuditLogService auditLogService,
        IAdminNotificationService adminNotify,
        ILogger<AdminController> logger)
    {
        _adminAuthService = adminAuthService;
        _auditLogService = auditLogService;
        _adminNotify = adminNotify;
        _logger = logger;
    }

    private AdminIdentity GetAdminIdentity()
    {
        if (HttpContext.Items["AdminIdentity"] is AdminIdentity identity)
        {
            return identity;
        }
        
        // Fallback: extract from claims (shouldn't happen if middleware works)
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
    /// GET /api/admin/me
    /// Get current admin identity
    /// </summary>
    [HttpGet("me")]
    public ActionResult<AdminIdentityResponse> GetCurrentAdmin()
    {
        try
        {
            var identity = GetAdminIdentity();
            return Ok(new AdminIdentityResponse
            {
                Sub = identity.Sub,
                CognitoUsername = identity.CognitoUsername,
                Email = identity.Email
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting current admin");
            return StatusCode(500, new { error = "Failed to get admin identity" });
        }
    }

    /// <summary>
    /// POST /api/admin/notifications/test
    /// Send a test admin alert to SES_ADMIN_EMAIL recipients (signup/purchase/contact plumbing check).
    /// </summary>
    [HttpPost("notifications/test")]
    public async Task<ActionResult> SendTestNotification(CancellationToken cancellationToken)
    {
        try
        {
            var identity = GetAdminIdentity();
            await _adminNotify.NotifyTestAsync(cancellationToken);
            await _auditLogService.LogActionAsync(
                identity,
                "admin.notifications.test",
                "system",
                "ses-admin-email",
                after: new { requestedBy = identity.Email });
            return Ok(new
            {
                ok = true,
                message = "Test notification sent to configured SES admin recipients (check spam if missing).",
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending admin test notification");
            return StatusCode(500, new { error = "Failed to send test notification" });
        }
    }
}

// Response models
public class AdminIdentityResponse
{
    public string Sub { get; set; } = string.Empty;
    public string? CognitoUsername { get; set; }
    public string? Email { get; set; }
}
