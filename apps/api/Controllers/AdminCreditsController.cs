using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Services;
using System.Linq;
using System.Text.Json.Serialization;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin/credits")]
[AllowAnonymous]
public class AdminCreditsController : ControllerBase
{
    private readonly ICreditsService _creditsService;
    private readonly IAdminService _adminService;
    private readonly ILogger<AdminCreditsController> _logger;

    public AdminCreditsController(
        ICreditsService creditsService,
        IAdminService adminService,
        ILogger<AdminCreditsController> logger)
    {
        _creditsService = creditsService;
        _adminService = adminService;
        _logger = logger;
    }

    private async Task ValidateAdminAsync()
    {
        var token = Request.Headers["X-Admin-Token"].FirstOrDefault()
            ?? (Request.Headers["Authorization"].FirstOrDefault()?.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) == true
                ? Request.Headers["Authorization"].FirstOrDefault()!.Substring("Bearer ".Length).Trim()
                : null);

        if (string.IsNullOrWhiteSpace(token))
            throw new UnauthorizedAccessException("Missing admin token");

        await _adminService.ValidateAdminTokenAsync(token);
    }

    /// <summary>Grant credits to a user (refund, compensation, etc.).</summary>
    [HttpPost("grant")]
    public async Task<ActionResult> Grant([FromBody] GrantCreditsRequest request)
    {
        try
        {
            await ValidateAdminAsync();
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }

        if (request == null || string.IsNullOrWhiteSpace(request.UserId) || request.Amount <= 0)
            return BadRequest(new { error = "userId (required) and amount (positive) required" });

        try
        {
            await _creditsService.GrantCreditsAsync(
                request.UserId,
                request.Amount,
                request.Reason ?? "ADMIN_GRANT");
            var balance = await _creditsService.GetCreditsBalanceAsync(request.UserId);
            return Ok(new { message = $"Granted {request.Amount} credits.", balance = balance.Balance });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error granting credits to {UserId}", request.UserId);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    /// <summary>Admin: toggle unlimited discovery browsing (stored on user-credits row).</summary>
    [HttpPut("users/{userId}/unlimited-discovery")]
    public async Task<ActionResult<object>> SetUnlimitedDiscovery(string userId, [FromBody] SetUnlimitedDiscoveryRequest? body)
    {
        try
        {
            await ValidateAdminAsync();
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }

        if (string.IsNullOrWhiteSpace(userId))
            return BadRequest(new { error = "userId required" });

        try
        {
            await _creditsService.SetUnlimitedDiscoveryAsync(userId.Trim(), body?.Enabled ?? false);
            var balance = await _creditsService.GetCreditsBalanceAsync(userId.Trim());
            return Ok(new { unlimitedDiscovery = balance.UnlimitedDiscovery, balance = balance.Balance });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error setting unlimited discovery for {UserId}", userId);
            return StatusCode(500, new { error = ex.Message });
        }
    }
}

public class SetUnlimitedDiscoveryRequest
{
    [JsonPropertyName("enabled")]
    public bool Enabled { get; set; }
}

public class GrantCreditsRequest
{
    [System.Text.Json.Serialization.JsonPropertyName("userId")]
    public string UserId { get; set; } = "";

    [System.Text.Json.Serialization.JsonPropertyName("amount")]
    public int Amount { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("reason")]
    public string? Reason { get; set; }
}
