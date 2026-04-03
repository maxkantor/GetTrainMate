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
