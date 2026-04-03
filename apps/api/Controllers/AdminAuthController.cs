using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Services;

namespace GetTrainMate.Api.Controllers;

/// <summary>Session probe and logout (stateless; client clears token).</summary>
[ApiController]
[Route("api/admin/auth")]
[Authorize]
public class AdminAuthController : ControllerBase
{
    private readonly IAuditLogService _auditLogService;

    public AdminAuthController(IAuditLogService auditLogService)
    {
        _auditLogService = auditLogService;
    }

    /// <summary>GET /api/admin/auth/session — requires X-Admin-Token or Cognito allowlist.</summary>
    [HttpGet("session")]
    public ActionResult<AdminSessionDto> GetSession()
    {
        if (HttpContext.Items["AdminIdentity"] is AdminIdentity id)
        {
            return Ok(new AdminSessionDto
            {
                Authenticated = true,
                Email = id.Email,
                Sub = id.Sub
            });
        }

        var sub = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        var email = User.FindFirst(ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value;
        if (string.IsNullOrEmpty(sub))
            return Unauthorized(new { error = "Not authenticated" });
        return Ok(new AdminSessionDto { Authenticated = true, Email = email, Sub = sub });
    }

    /// <summary>POST /api/admin/auth/logout — no server state; client clears storage.</summary>
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        if (HttpContext.Items["AdminIdentity"] is AdminIdentity id)
            await _auditLogService.LogActionAsync(id, "admin.auth.logout", "admin", id.Sub);
        return Ok(new { success = true });
    }
}

public class AdminSessionDto
{
    public bool Authenticated { get; set; }
    public string? Email { get; set; }
    public string? Sub { get; set; }
}
