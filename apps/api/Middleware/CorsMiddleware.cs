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
            // Set CORS headers
            if (!context.Response.Headers.ContainsKey("Access-Control-Allow-Origin"))
            {
                context.Response.Headers.Append("Access-Control-Allow-Origin", "*");
            }
            if (!context.Response.Headers.ContainsKey("Access-Control-Allow-Methods"))
            {
                context.Response.Headers.Append("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
            }
            if (!context.Response.Headers.ContainsKey("Access-Control-Allow-Headers"))
            {
                context.Response.Headers.Append("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers");
            }
            if (!context.Response.Headers.ContainsKey("Access-Control-Max-Age"))
            {
                context.Response.Headers.Append("Access-Control-Max-Age", "86400");
            }
            
            // Return 200 OK for OPTIONS
            context.Response.StatusCode = 200;
            context.Response.ContentType = "text/plain";
            await context.Response.WriteAsync(string.Empty);
            return;
        }

        // Add CORS headers to all responses
        if (!context.Response.Headers.ContainsKey("Access-Control-Allow-Origin"))
        {
            context.Response.Headers.Append("Access-Control-Allow-Origin", "*");
        }

        await _next(context);
    }
}
