using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin/discover")]
[Authorize]
public class AdminDiscoverController : ControllerBase
{
    private readonly IMatchService _matchService;
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<AdminDiscoverController> _logger;

    public AdminDiscoverController(
        IMatchService matchService,
        IAuditLogService auditLogService,
        ILogger<AdminDiscoverController> logger)
    {
        _matchService = matchService;
        _auditLogService = auditLogService;
        _logger = logger;
    }

    private AdminIdentity GetAdminIdentity()
    {
        if (HttpContext.Items["AdminIdentity"] is AdminIdentity identity)
            return identity;

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

    [HttpGet("controls")]
    public async Task<ActionResult<AdminDiscoverControls>> GetControls()
    {
        var controls = await _matchService.GetAdminDiscoverControlsAsync();
        return Ok(controls);
    }

    [HttpPut("controls")]
    public async Task<ActionResult<AdminDiscoverControls>> SetControls([FromBody] AdminDiscoverControls request)
    {
        var admin = GetAdminIdentity();
        var updated = await _matchService.SetAdminDiscoverControlsAsync(request.IgnoreSkippedProfilesInDiscoverForAdmin);
        await _auditLogService.LogActionAsync(
            admin,
            "discover.controls.update",
            "discover",
            "controls",
            after: updated
        );
        return Ok(updated);
    }

    [HttpGet("profiles")]
    public async Task<ActionResult<List<AdminDiscoverProfileRow>>> ListProfiles(
        [FromQuery] string filter = "all",
        [FromQuery] int limit = 200)
    {
        var rows = await _matchService.ListAdminDiscoverProfilesAsync(filter, limit);
        return Ok(rows);
    }

    [HttpPost("profiles/{profileUserId}/restore")]
    public async Task<ActionResult<object>> RestoreProfile(string profileUserId)
    {
        return await SetProfileStatus(profileUserId, "active", "discover.profile.restore");
    }

    [HttpPost("profiles/{profileUserId}/skip")]
    public async Task<ActionResult<object>> SkipProfile(string profileUserId)
    {
        return await SetProfileStatus(profileUserId, "skipped", "discover.profile.skip");
    }

    [HttpPost("profiles/{profileUserId}/hide")]
    public async Task<ActionResult<object>> HideProfile(string profileUserId)
    {
        return await SetProfileStatus(profileUserId, "hidden", "discover.profile.hide");
    }

    [HttpPost("profiles/{profileUserId}/reset")]
    public async Task<ActionResult<object>> ResetInteractionState(string profileUserId)
    {
        var admin = GetAdminIdentity();
        var ok = await _matchService.AdminResetProfileInteractionStateAsync(profileUserId);
        if (!ok) return StatusCode(500, new { message = "Failed to reset discover interaction state" });
        await _auditLogService.LogActionAsync(
            admin,
            "discover.profile.reset_interactions",
            "discover_profile",
            profileUserId
        );
        return Ok(new { success = true });
    }

    private async Task<ActionResult<object>> SetProfileStatus(string profileUserId, string status, string auditAction)
    {
        try
        {
            var admin = GetAdminIdentity();
            var ok = await _matchService.AdminSetProfileDiscoverStatusAsync(profileUserId, status, admin.Sub);
            if (!ok) return BadRequest(new { message = "Invalid discover status" });
            await _auditLogService.LogActionAsync(
                admin,
                auditAction,
                "discover_profile",
                profileUserId,
                after: new { status }
            );
            return Ok(new { success = true, status });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed updating discover status for profile {ProfileUserId}", profileUserId);
            return StatusCode(500, new { message = "Failed updating discover status" });
        }
    }
}
