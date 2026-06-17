using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Microsoft.Extensions.Configuration;
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
    private readonly string _profilesTableResolved;

    public MeController(
        IProfileService profileService,
        ICreditsService creditsService,
        IUserActivityService userActivityService,
        IConfiguration configuration,
        ILogger<MeController> logger)
    {
        _profileService = profileService;
        _creditsService = creditsService;
        _userActivityService = userActivityService;
        _logger = logger;
        var prefix = configuration["DYNAMODB_TABLE_PREFIX"] ?? "gettrainmate-";
        _profilesTableResolved = configuration["DYNAMODB_TABLE_PROFILES"] ?? $"{prefix}profiles";
    }

    [HttpGet("me")]
    public async Task<ActionResult<MeResponse>> GetMe()
    {
        var userId = GetUserIdFromToken();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { code = "NOT_AUTHENTICATED", message = "Invalid token" });

        try
        {
            var principalAuthenticated = User?.Identity?.IsAuthenticated == true;
            var profile = await _profileService.GetProfileAsync(userId);
            var accountClosed = await _profileService.IsAccountClosedAsync(userId);

            _logger.LogInformation(
                "GetMe trace: user={User} principalAuthenticated={PrincipalAuth} profilePresent={ProfilePresent} accountClosed={AccountClosed} profilesTable={ProfilesTable}",
                ShortUserIdForMeLog(userId),
                principalAuthenticated,
                profile != null,
                accountClosed,
                _profilesTableResolved);

            if (profile == null && accountClosed)
            {
                _logger.LogWarning(
                    "GetMe outcome: 410 ACCOUNT_CLOSED user={User}",
                    ShortUserIdForMeLog(userId));
                return StatusCode(StatusCodes.Status410Gone, new
                {
                    code = "ACCOUNT_CLOSED",
                    message = "This account is no longer available.",
                });
            }

            if (profile == null && !accountClosed)
            {
                _logger.LogWarning(
                    "GetMe outcome: 200 with null profile user={User} profilesTable={ProfilesTable}. No Dynamo item or no accountClosed tombstone — 410 only after soft-delete. Fix: PutItem userId=sub, accountClosed=true, or re-delete via CRM.",
                    ShortUserIdForMeLog(userId),
                    _profilesTableResolved);
            }

            var credits = await _creditsService.GetCreditsBalanceAsync(userId);
            var email = profile?.Email ?? GetEmailFromToken() ?? "";

            if (credits.Balance == 0 && credits.LifetimeEarned == 0)
            {
                var grant = await _creditsService.GrantFreeSignupCreditsAsync(userId, email, GetNameFromToken());
                if (grant.Success && !grant.AlreadyGranted)
                    credits = await _creditsService.GetCreditsBalanceAsync(userId);
            }
            var isAdmin = IsAdminEmail(email);
            if (profile != null && string.IsNullOrWhiteSpace(profile.Name))
            {
                var nameFromToken = GetNameFromToken();
                if (!string.IsNullOrWhiteSpace(nameFromToken))
                    profile.Name = nameFromToken;
            }

            _logger.LogDebug(
                "GetMe outcome: 200 OK user={User} credits={Credits} profileComplete={Complete}",
                ShortUserIdForMeLog(userId),
                credits.Balance,
                profile?.IsComplete ?? false);

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
        var path = string.IsNullOrWhiteSpace(body?.Path) ? null : body.Path.Trim();
        await _userActivityService.RecordHeartbeatAsync(userId, thread, path, cancellationToken);
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

    private static string ShortUserIdForMeLog(string? userId)
    {
        if (string.IsNullOrEmpty(userId)) return "(empty)";
        return userId.Length <= 14 ? userId : $"{userId[..8]}…{userId[^4..]}";
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
