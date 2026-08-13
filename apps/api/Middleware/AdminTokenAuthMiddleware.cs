using System.Security.Claims;
using GetTrainMate.Api.Services;
using Microsoft.AspNetCore.Http;

namespace GetTrainMate.Api.Middleware;

/// <summary>
/// After Cognito, authenticates <c>X-Admin-Token</c> for <c>/api/admin/*</c> (except <c>/api/admin/login</c>*).
/// Sets <see cref="HttpContext.User"/> so <c>[Authorize]</c> succeeds without a Cognito session.
/// </summary>
public class AdminTokenAuthMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<AdminTokenAuthMiddleware> _logger;

    public AdminTokenAuthMiddleware(RequestDelegate next, ILogger<AdminTokenAuthMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, IAdminService adminService)
    {
        if (context.Request.Method == "OPTIONS")
        {
            await _next(context);
            return;
        }

        var path = context.Request.Path;
        if (!path.StartsWithSegments("/api/admin"))
        {
            await _next(context);
            return;
        }

        // Login + validate-session stay anonymous (handled by AdminAuthorizationMiddleware skip)
        if (path.StartsWithSegments("/api/admin/login"))
        {
            await _next(context);
            return;
        }

        var token = context.Request.Headers["X-Admin-Token"].FirstOrDefault();
        // Scoped growth metro read token (separate from SES IAM / DynamoDB). Only metro endpoint.
        if (string.IsNullOrWhiteSpace(token)
            && HttpMethods.IsGet(context.Request.Method)
            && path.StartsWithSegments("/api/admin/metrics/metro"))
        {
            var growthToken = context.Request.Headers["X-Growth-Metro-Token"].FirstOrDefault()
                ?? context.Request.Headers["X-Admin-Token"].FirstOrDefault();
            var expected = Environment.GetEnvironmentVariable("GROWTH_METRO_READ_TOKEN");
            if (!string.IsNullOrWhiteSpace(expected)
                && !string.IsNullOrWhiteSpace(growthToken)
                && string.Equals(expected.Trim(), growthToken.Trim(), StringComparison.Ordinal))
            {
                var identity = new ClaimsIdentity(
                    new[]
                    {
                        new Claim(ClaimTypes.NameIdentifier, "growth-metro-reader"),
                        new Claim("sub", "growth-metro-reader"),
                        new Claim(ClaimTypes.Role, "growth_metro_read"),
                    },
                    "GrowthMetroToken");
                context.User = new ClaimsPrincipal(identity);
                await _next(context);
                return;
            }
        }
        // <img src> cannot send custom headers — photo stream accepts the same token in query (short TTL risk: treat like URL with secret).
        if (string.IsNullOrWhiteSpace(token)
            && HttpMethods.IsGet(context.Request.Method)
            && path.Value?.Contains("/photos/stream", StringComparison.OrdinalIgnoreCase) == true)
        {
            token = context.Request.Query["adminToken"].FirstOrDefault()
                    ?? context.Request.Query["x-admin-token"].FirstOrDefault();
        }

        if (string.IsNullOrWhiteSpace(token))
        {
            await _next(context);
            return;
        }

        try
        {
            var admin = await adminService.ValidateAdminTokenAsync(token);
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, admin.AdminId),
                new("sub", admin.AdminId),
                new(ClaimTypes.Email, admin.Email ?? string.Empty),
                new("email", admin.Email ?? string.Empty),
            };
            var identity = new ClaimsIdentity(claims, "AdminToken");
            context.User = new ClaimsPrincipal(identity);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "X-Admin-Token rejected for {Path}", path);
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync("{\"error\":\"Invalid or expired admin token\"}");
            return;
        }

        await _next(context);
    }
}
