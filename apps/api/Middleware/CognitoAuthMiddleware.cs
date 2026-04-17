using System.Security.Claims;
using Amazon.CognitoIdentityProvider;
using Amazon.CognitoIdentityProvider.Model;
using Microsoft.AspNetCore.Http;

namespace GetTrainMate.Api.Middleware;

/// <summary>
/// Validates Bearer token via Cognito GetUser API. No JWT library - Cognito validates server-side.
/// Requires ACCESS token (not ID token). Sets context.User on success.
/// </summary>
public class CognitoAuthMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<CognitoAuthMiddleware> _logger;

    public CognitoAuthMiddleware(RequestDelegate next, ILogger<CognitoAuthMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, IAmazonCognitoIdentityProvider cognito)
    {
        if (context.Request.Method == "OPTIONS")
        {
            await _next(context);
            return;
        }

        var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
        var token = !string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
            ? authHeader["Bearer ".Length..].Trim()
            : context.Request.Query["access_token"].FirstOrDefault();

        if (!string.IsNullOrEmpty(token))
        {
            try
            {
                var request = new GetUserRequest { AccessToken = token };
                var response = await cognito.GetUserAsync(request);

                var claims = new List<Claim>
                {
                    new(ClaimTypes.NameIdentifier, GetAttr(response.UserAttributes, "sub") ?? response.Username),
                    new("sub", GetAttr(response.UserAttributes, "sub") ?? response.Username),
                    new("cognito:username", response.Username),
                };

                var email = GetAttr(response.UserAttributes, "email");
                if (!string.IsNullOrEmpty(email))
                {
                    claims.Add(new Claim(ClaimTypes.Email, email));
                    claims.Add(new Claim("email", email));
                }

                var name = GetAttr(response.UserAttributes, "name") ?? GetAttr(response.UserAttributes, "given_name");
                if (!string.IsNullOrEmpty(name))
                {
                    claims.Add(new Claim(ClaimTypes.Name, name));
                    claims.Add(new Claim("name", name));
                }

                var identity = new ClaimsIdentity(claims, "Cognito");
                context.User = new ClaimsPrincipal(identity);
            }
            catch (NotAuthorizedException)
            {
                _logger.LogInformation(
                    "CognitoAuth trace: GetUser NotAuthorized (token invalid/expired or user removed) {Method} {Path}",
                    context.Request.Method,
                    context.Request.Path.Value ?? "");
                if (!context.Response.HasStarted)
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    await context.Response.WriteAsJsonAsync(new
                    {
                        code = "NOT_AUTHORIZED",
                        message = "Session expired or this account is no longer available.",
                    });
                }
                return;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "CognitoAuth trace: GetUser threw; continuing without claims (downstream may parse JWT) {Method} {Path}",
                    context.Request.Method,
                    context.Request.Path.Value ?? "");
            }
        }
        else if (context.Request.Path.StartsWithSegments("/api/me"))
        {
            _logger.LogInformation(
                "CognitoAuth trace: no Bearer token on {Method} {Path}",
                context.Request.Method,
                context.Request.Path.Value ?? "");
        }

        await _next(context);
    }

    private static string? GetAttr(List<AttributeType>? attrs, string name)
    {
        if (attrs == null) return null;
        var a = attrs.FirstOrDefault(x => string.Equals(x.Name, name, StringComparison.OrdinalIgnoreCase));
        return a?.Value?.Trim();
    }
}
