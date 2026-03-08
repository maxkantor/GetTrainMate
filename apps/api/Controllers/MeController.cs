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
    private readonly ILogger<MeController> _logger;

    public MeController(
        IProfileService profileService,
        ICreditsService creditsService,
        ILogger<MeController> logger)
    {
        _profileService = profileService;
        _creditsService = creditsService;
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
    public bool IsProfileComplete { get; set; }
    public bool IsAdmin { get; set; }
}

public class MeUserDto
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}
