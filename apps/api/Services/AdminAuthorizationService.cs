using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace GetTrainMate.Api.Services;

public class AdminAuthorizationService : IAdminAuthorizationService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<AdminAuthorizationService> _logger;
    private readonly HashSet<string> _allowlist;

    public AdminAuthorizationService(IConfiguration configuration, ILogger<AdminAuthorizationService> logger)
    {
        _configuration = configuration;
        _logger = logger;
        
        // Load allowlist from environment variable
        var allowlistEnv = Environment.GetEnvironmentVariable("ADMIN_ALLOWLIST") 
            ?? _configuration["Admin:Allowlist"] 
            ?? "mykantor@bellsouth.net";
        
        _allowlist = new HashSet<string>(
            allowlistEnv.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(x => x.Trim().ToLowerInvariant()),
            StringComparer.OrdinalIgnoreCase
        );
        
        _logger.LogInformation("Admin allowlist loaded with {Count} entries", _allowlist.Count);
    }

    public async Task<AdminIdentity?> RequireAdminAsync(HttpContext context)
    {
        // Password-based admin portal (X-Admin-Token → ClaimsIdentity AuthenticationType AdminToken)
        if (string.Equals(context.User.Identity?.AuthenticationType, "AdminToken", StringComparison.Ordinal))
        {
            var sub = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? context.User.FindFirst("sub")?.Value;
            var email = context.User.FindFirst(ClaimTypes.Email)?.Value
                ?? context.User.FindFirst("email")?.Value;
            if (string.IsNullOrEmpty(sub))
            {
                _logger.LogWarning("Admin token identity missing sub");
                throw new UnauthorizedAccessException("Invalid admin session");
            }
            return new AdminIdentity
            {
                Sub = sub,
                CognitoUsername = null,
                Email = email
            };
        }

        // Scoped growth metro reader (X-Growth-Metro-Token) — metro aggregate endpoint only.
        if (string.Equals(context.User.Identity?.AuthenticationType, "GrowthMetroToken", StringComparison.Ordinal))
        {
            if (!context.Request.Path.StartsWithSegments("/api/admin/metrics/metro"))
            {
                _logger.LogWarning("Growth metro token used outside metro endpoint");
                return null;
            }
            return new AdminIdentity
            {
                Sub = "growth-metro-reader",
                CognitoUsername = null,
                Email = null
            };
        }

        // Cognito access token + allowlist (legacy / staff-only access)
        if (!context.User.Identity?.IsAuthenticated ?? true)
        {
            _logger.LogWarning("User not authenticated for admin route");
            throw new UnauthorizedAccessException("Authentication required");
        }

        var sub2 = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
            ?? context.User.FindFirst("sub")?.Value;
        var cognitoUsername = context.User.FindFirst("cognito:username")?.Value;
        var email2 = context.User.FindFirst(ClaimTypes.Email)?.Value 
            ?? context.User.FindFirst("email")?.Value;

        if (string.IsNullOrEmpty(sub2))
        {
            _logger.LogWarning("JWT missing 'sub' claim");
            throw new UnauthorizedAccessException("Invalid JWT: missing 'sub' claim");
        }

        if (!IsInAllowlist(sub2, cognitoUsername, email2))
        {
            _logger.LogWarning(
                "User not in admin allowlist - Sub: {Sub}, Username: {Username}, Email: {Email}",
                sub2, cognitoUsername, email2);
            return null;
        }

        return new AdminIdentity
        {
            Sub = sub2,
            CognitoUsername = cognitoUsername,
            Email = email2
        };
    }

    public bool IsInAllowlist(string? sub, string? cognitoUsername, string? email)
    {
        if (_allowlist.Count == 0)
        {
            _logger.LogWarning("Admin allowlist is empty - denying all access");
            return false;
        }

        // Check if ANY claim matches ANY allowlist entry
        var checks = new[]
        {
            sub?.ToLowerInvariant(),
            cognitoUsername?.ToLowerInvariant(),
            email?.ToLowerInvariant()
        }.Where(x => !string.IsNullOrEmpty(x));

        foreach (var check in checks)
        {
            if (_allowlist.Contains(check!))
            {
                _logger.LogDebug("User matched allowlist entry: {Entry}", check);
                return true;
            }
        }

        return false;
    }
}
