using Microsoft.AspNetCore.Http;

namespace GetTrainMate.Api.Middleware;

/// <summary>
/// Enables request body buffering before auth middleware so the raw POST bytes for
/// <c>/stripe/webhook</c> are still available for signature verification (Stripe signs exact body).
/// </summary>
public class StripeWebhookBufferingMiddleware
{
    private readonly RequestDelegate _next;

    public StripeWebhookBufferingMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? "";
        if (HttpMethods.IsPost(context.Request.Method)
            && path.EndsWith("/stripe/webhook", StringComparison.OrdinalIgnoreCase))
        {
            context.Request.EnableBuffering();
        }

        await _next(context);
    }
}
