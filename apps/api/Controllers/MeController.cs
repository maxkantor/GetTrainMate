using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;

namespace GetTrainMate.Api.Controllers;

/// <summary>App shell / gate: current user, profile, credits, and profile completion.</summary>
[ApiController]
[Route("api")]
public class MeController : ControllerBase
{
    private readonly IProfileService _profileService;
    private readonly ICreditsService _creditsService;
    private readonly IUserActivityService _userActivityService;
    private readonly ILogger<MeController> _logger;

    public MeController(
        IProfileService profileService,
        ICreditsService creditsService,
        IUserActivityService userActivityService,
        ILogger<MeController> logger)
    {
        _profileService = profileService;
        _creditsService = creditsService;
        _userActivityService = userActivityService;
        _logger = logger;
    }

    [HttpGet("me")]
    public async Task<ActionResult<MeResponse>> GetMe()
    {
        var userId = GetUserIdFromToken();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { code = "NOT_AUTHENTICATED", message = "Invalid token" });

        try
        {
            var profile = await _profileService.GetProfileAsync(userId);
            var credits = await _creditsService.GetCreditsBalanceAsync(userId);
            var email = profile?.Email ?? GetEmailFromToken() ?? "";
            var isAdmin = IsAdminEmail(email);
            if (profile != null && string.IsNullOrWhiteSpace(profile.Name))
            {
                var nameFromToken = GetNameFromToken();
                if (!string.IsNullOrWhiteSpace(nameFromToken))
                    profile.Name = nameFromToken;
            }

            return Ok(new MeResponse
            {
                User = new MeUserDto { Id = userId, Email = email },
                Profile = profile,
                Credits = credits.Balance,
                LifetimeEarned = credits.LifetimeEarned,
                UnlimitedDiscovery = credits.UnlimitedDiscovery,
                BoostExpiresAtUtc = credits.BoostExpiresAtUtc,
                RevealLikesUnlocked = credits.RevealLikesUnlocked,
                IsProfileComplete = profile?.IsComplete ?? false,
                IsAdmin = isAdmin,
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting /me for user {UserId}", userId);
            return StatusCode(500, new { code = "ERROR", message = "Error loading account" });
        }
    }

    /// <summary>
    /// Heartbeat: marks user active (suppresses chat notification emails when recently seen).
    /// Optional <see cref="ActivityHeartbeatRequest.ActiveThreadId"/> when the user is viewing that chat thread.
    /// </summary>
    [HttpPost("me/activity")]
    public async Task<IActionResult> RecordActivity([FromBody] ActivityHeartbeatRequest? body, CancellationToken cancellationToken)
    {
        var userId = GetUserIdFromToken();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { code = "NOT_AUTHENTICATED", message = "Invalid token" });
        var thread = string.IsNullOrWhiteSpace(body?.ActiveThreadId) ? null : body!.ActiveThreadId.Trim();
        await _userActivityService.RecordHeartbeatAsync(userId, thread, cancellationToken);
        return Ok(new { ok = true });
    }

    private string? GetUserIdFromToken()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            var authHeader = Request.Headers["Authorization"].FirstOrDefault();
            if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer "))
            {
                var token = authHeader.Substring("Bearer ".Length).Trim();
                try
                {
                    var handler = new JwtSecurityTokenHandler();
                    var jsonToken = handler.ReadJwtToken(token);
                    userId = jsonToken.Claims.FirstOrDefault(c => c.Type == "sub" || c.Type == ClaimTypes.NameIdentifier)?.Value;
                }
                catch { /* ignore */ }
            }
        }
        return userId;
    }

    private string? GetEmailFromToken()
    {
        var email = User.FindFirst(ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value;
        if (string.IsNullOrEmpty(email))
        {
            var authHeader = Request.Headers["Authorization"].FirstOrDefault();
            if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer "))
            {
                var token = authHeader.Substring("Bearer ".Length).Trim();
                try
                {
                    var handler = new JwtSecurityTokenHandler();
                    var jsonToken = handler.ReadJwtToken(token);
                    email = jsonToken.Claims.FirstOrDefault(c => c.Type == "email" || c.Type == ClaimTypes.Email)?.Value;
                }
                catch { /* ignore */ }
            }
        }
        return email;
    }

    private string? GetNameFromToken()
    {
        var name = User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? User.FindFirst("given_name")?.Value;
        if (!string.IsNullOrWhiteSpace(name)) return name.Trim();
        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ")) return null;
        try
        {
            var token = authHeader["Bearer ".Length..].Trim();
            var handler = new JwtSecurityTokenHandler();
            var jsonToken = handler.ReadJwtToken(token);
            name = jsonToken.Claims.FirstOrDefault(c => c.Type == "name" || c.Type == "given_name" || c.Type == ClaimTypes.Name)?.Value;
            return string.IsNullOrWhiteSpace(name) ? null : name.Trim();
        }
        catch { return null; }
    }

    private bool IsAdminEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email)) return false;
        var adminEmails = (Environment.GetEnvironmentVariable("ADMIN_EMAILS") ?? "").Trim();
        if (string.IsNullOrEmpty(adminEmails)) return false;
        var list = adminEmails.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return list.Any(e => string.Equals(e, email.Trim(), StringComparison.OrdinalIgnoreCase));
    }
}

public class MeResponse
{
    public MeUserDto User { get; set; } = new();
    public UserProfile? Profile { get; set; }
    public int Credits { get; set; }
    /// <summary>Total credits ever earned (for X/Y display: current / total).</summary>
    public int LifetimeEarned { get; set; }
    /// <summary>Browse/deck entitlement from user-credits; does not waive per-like costs when balance &gt; 0.</summary>
    public bool UnlimitedDiscovery { get; set; }
    public DateTime? BoostExpiresAtUtc { get; set; }
    public bool RevealLikesUnlocked { get; set; }
    public bool IsProfileComplete { get; set; }
    public bool IsAdmin { get; set; }
}

public class MeUserDto
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}
