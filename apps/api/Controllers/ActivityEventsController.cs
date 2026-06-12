using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/activity")]
[AllowAnonymous]
public class ActivityEventsController : ControllerBase
{
    private readonly IActivityAnalyticsService _analytics;
    private readonly ILogger<ActivityEventsController> _logger;

    public ActivityEventsController(
        IActivityAnalyticsService analytics,
        ILogger<ActivityEventsController> logger)
    {
        _analytics = analytics;
        _logger = logger;
    }

    /// <summary>
    /// POST /api/activity/events — lightweight client beacon (GA4 companion). No PII in body.
    /// Optional Bearer token links event to authenticated user.
    /// </summary>
    [HttpPost("events")]
    public async Task<IActionResult> RecordEvent(
        [FromBody] RecordActivityEventRequest? body,
        CancellationToken cancellationToken)
    {
        if (body == null || string.IsNullOrWhiteSpace(body.EventType))
            return BadRequest(new { error = "eventType is required" });

        var userId = TryGetUserIdFromBearer();
        await _analytics.RecordEventAsync(
            body.EventType,
            body.Path,
            userId,
            body.SessionId,
            body.Params,
            cancellationToken);

        return Ok(new { ok = true });
    }

    private string? TryGetUserIdFromBearer()
    {
        try
        {
            var authHeader = Request.Headers.Authorization.FirstOrDefault();
            if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                return null;

            var token = authHeader["Bearer ".Length..].Trim();
            var handler = new JwtSecurityTokenHandler();
            if (!handler.CanReadToken(token)) return null;

            var jwt = handler.ReadJwtToken(token);
            return jwt.Claims.FirstOrDefault(c =>
                    c.Type == ClaimTypes.NameIdentifier || c.Type == "sub")
                ?.Value;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Could not parse bearer for activity event");
            return null;
        }
    }
}
