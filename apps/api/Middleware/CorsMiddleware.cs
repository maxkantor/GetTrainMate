using Microsoft.AspNetCore.Http;

namespace GetTrainMate.Api.Middleware;

/// <summary>
/// Middleware to handle CORS preflight OPTIONS requests
/// </summary>
public class CorsMiddleware
{
    private readonly RequestDelegate _next;

    public CorsMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Handle preflight OPTIONS requests
        if (context.Request.Method == "OPTIONS")
        {
            context.Response.Headers.Append("Access-Control-Allow-Origin", "*");
            context.Response.Headers.Append("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
            context.Response.Headers.Append("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
            context.Response.Headers.Append("Access-Control-Max-Age", "86400");
            context.Response.StatusCode = 200;
            await context.Response.WriteAsync(string.Empty);
            return;
        }

        await _next(context);
    }
}
