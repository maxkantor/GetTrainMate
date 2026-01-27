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
    private readonly ILogger<AdminController> _logger;

    public AdminController(
        IAdminAuthorizationService adminAuthService,
        IAuditLogService auditLogService,
        ILogger<AdminController> logger)
    {
        _adminAuthService = adminAuthService;
        _auditLogService = auditLogService;
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
}

// Response models
public class AdminIdentityResponse
{
    public string Sub { get; set; } = string.Empty;
    public string? CognitoUsername { get; set; }
    public string? Email { get; set; }
}
