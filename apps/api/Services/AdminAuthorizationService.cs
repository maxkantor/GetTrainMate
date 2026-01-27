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
        // Extract JWT claims from authenticated user
        if (!context.User.Identity?.IsAuthenticated ?? true)
        {
            _logger.LogWarning("User not authenticated for admin route");
            throw new UnauthorizedAccessException("Authentication required");
        }

        // Extract claims
        var sub = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
            ?? context.User.FindFirst("sub")?.Value;
        var cognitoUsername = context.User.FindFirst("cognito:username")?.Value;
        var email = context.User.FindFirst(ClaimTypes.Email)?.Value 
            ?? context.User.FindFirst("email")?.Value;

        if (string.IsNullOrEmpty(sub))
        {
            _logger.LogWarning("JWT missing 'sub' claim");
            throw new UnauthorizedAccessException("Invalid JWT: missing 'sub' claim");
        }

        // Check allowlist
        if (!IsInAllowlist(sub, cognitoUsername, email))
        {
            _logger.LogWarning(
                "User not in admin allowlist - Sub: {Sub}, Username: {Username}, Email: {Email}",
                sub, cognitoUsername, email);
            return null;
        }

        // Return admin identity for audit logging
        return new AdminIdentity
        {
            Sub = sub,
            CognitoUsername = cognitoUsername,
            Email = email
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
