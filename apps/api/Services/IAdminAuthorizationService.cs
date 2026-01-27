using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace GetTrainMate.Api.Services;

/// <summary>
/// Admin identity extracted from JWT for audit logging
/// </summary>
public class AdminIdentity
{
    public string Sub { get; set; } = string.Empty;
    public string? CognitoUsername { get; set; }
    public string? Email { get; set; }
}

public interface IAdminAuthorizationService
{
    /// <summary>
    /// Verifies Cognito JWT and checks if user is in admin allowlist
    /// Returns AdminIdentity if authorized, null if not in allowlist
    /// Throws UnauthorizedAccessException if JWT is invalid
    /// </summary>
    Task<AdminIdentity?> RequireAdminAsync(HttpContext context);
    
    /// <summary>
    /// Checks if a user (by claims) is in the admin allowlist
    /// </summary>
    bool IsInAllowlist(string? sub, string? cognitoUsername, string? email);
}
