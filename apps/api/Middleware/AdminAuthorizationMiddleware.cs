using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using GetTrainMate.Api.Services;

namespace GetTrainMate.Api.Middleware;

/// <summary>
/// Middleware to enforce admin authorization based on allowlist
/// Checks JWT claims (sub, cognito:username, email) against ADMIN_ALLOWLIST
/// </summary>
public class AdminAuthorizationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<AdminAuthorizationMiddleware> _logger;

    public AdminAuthorizationMiddleware(RequestDelegate next, ILogger<AdminAuthorizationMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, IAdminAuthorizationService adminAuthService)
    {
        // Skip OPTIONS — ASP.NET Core CORS handles preflight before auth.
        if (context.Request.Method == "OPTIONS")
        {
            await _next(context);
            return;
        }

        // Only check admin routes
        if (!context.Request.Path.StartsWithSegments("/api/admin"))
        {
            await _next(context);
            return;
        }

        // Anonymous: password login + validate-session under /api/admin/login
        if (context.Request.Path.StartsWithSegments("/api/admin/login"))
        {
            await _next(context);
            return;
        }

        try
        {
            // Verify JWT and check allowlist
            var adminIdentity = await adminAuthService.RequireAdminAsync(context);
            
            if (adminIdentity == null)
            {
                _logger.LogWarning("Admin authorization failed for path: {Path}", context.Request.Path);
                context.Response.StatusCode = 403;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync(JsonSerializer.Serialize(new
                {
                    error = "Forbidden",
                    message = "Admin access denied"
                }));
                return;
            }

            // Add admin identity to context for audit logging
            context.Items["AdminIdentity"] = adminIdentity;
            
            await _next(context);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized admin access attempt");
            context.Response.StatusCode = 401;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(JsonSerializer.Serialize(new
            {
                error = "Unauthorized",
                message = ex.Message
            }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in admin authorization middleware");
            context.Response.StatusCode = 500;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(JsonSerializer.Serialize(new
            {
                error = "Internal server error",
                message = "Authorization check failed"
            }));
        }
    }
}
