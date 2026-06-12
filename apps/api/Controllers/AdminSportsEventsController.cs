using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin/sports-events")]
[Authorize]
public class AdminSportsEventsController : ControllerBase
{
    private readonly ISportsEventLayerService _sportsEventLayerService;
    private readonly IEventHubService _eventHubService;
    private readonly IAuditLogService _auditLog;

    public AdminSportsEventsController(
        ISportsEventLayerService sportsEventLayerService,
        IEventHubService eventHubService,
        IAuditLogService auditLog)
    {
        _sportsEventLayerService = sportsEventLayerService;
        _eventHubService = eventHubService;
        _auditLog = auditLog;
    }

    [HttpGet("flags")]
    public async Task<ActionResult<Dictionary<string, bool>>> GetFlags()
    {
        var env = ResolveEnvironment();
        var flags = await _sportsEventLayerService.GetFeatureFlagsAsync(env, allowLocalOverrides: true);
        return Ok(flags);
    }

    [HttpPut("flags/{flagKey}")]
    public async Task<ActionResult<FeatureFlag>> SetFlag(string flagKey, [FromBody] FeatureFlag flag)
    {
        flag.FlagKey = flagKey;
        if (string.IsNullOrWhiteSpace(flag.Environment)) flag.Environment = ResolveEnvironment();
        var saved = await _sportsEventLayerService.UpsertFeatureFlagAsync(flag);
        await _auditLog.LogActionAsync(GetAdminIdentity(), "sports_event.set_flag", "feature_flag", flagKey, after: flag);
        return Ok(saved);
    }

    [HttpGet]
    public async Task<ActionResult<List<EventConfig>>> GetAll()
    {
        return Ok(await _sportsEventLayerService.GetAllEventConfigsAsync());
    }

    [HttpPut("{eventId}")]
    public async Task<ActionResult<EventConfig>> UpsertEvent(string eventId, [FromBody] EventConfig config)
    {
        if (string.IsNullOrWhiteSpace(eventId)) return BadRequest("Event ID is required.");
        if (string.IsNullOrWhiteSpace(config.Label) || string.IsNullOrWhiteSpace(config.Sport))
            return BadRequest("Label and sport are required.");
        if (!DateTime.TryParse(config.StartDate, out var start) || !DateTime.TryParse(config.EndDate, out var end))
            return BadRequest("StartDate and EndDate must be valid ISO date/time values.");
        if (start >= end) return BadRequest("StartDate must be before EndDate.");

        config.EventId = eventId;
        var saved = await _sportsEventLayerService.UpsertEventConfigAsync(config);
        await _auditLog.LogActionAsync(GetAdminIdentity(), "sports_event.upsert_config", "event_config", eventId, after: saved);
        return Ok(saved);
    }

    [HttpGet("{eventId}/hub")]
    public async Task<ActionResult<EventHubSnapshot>> GetHub(string eventId)
    {
        var snapshot = await _eventHubService.GetHubSnapshotAsync(eventId, allowDisabledForAdmin: true);
        if (snapshot == null) return NotFound();
        return Ok(snapshot);
    }

    [HttpGet("{eventId}/analytics")]
    public async Task<ActionResult<EventHubAnalytics>> GetAnalytics(string eventId)
    {
        return Ok(await _eventHubService.GetAnalyticsAsync(eventId));
    }

    [HttpGet("{eventId}/predictions/export")]
    public async Task<ActionResult<List<PredictionExportRow>>> ExportPredictions(string eventId)
    {
        return Ok(await _eventHubService.ExportPredictionsAsync(eventId));
    }

    [HttpPut("{eventId}/groups")]
    public async Task<ActionResult<EventGroup>> UpsertGroup(string eventId, [FromBody] EventGroup group)
    {
        group.EventId = eventId;
        var saved = await _eventHubService.UpsertGroupAsync(group);
        await _auditLog.LogActionAsync(GetAdminIdentity(), "sports_event.upsert_group", "event_group", group.GroupId, after: saved);
        return Ok(saved);
    }

    [HttpDelete("{eventId}/groups/{groupId}")]
    public async Task<ActionResult> DeleteGroup(string eventId, string groupId)
    {
        await _eventHubService.DeleteGroupAsync(eventId, groupId);
        await _auditLog.LogActionAsync(GetAdminIdentity(), "sports_event.delete_group", "event_group", groupId);
        return NoContent();
    }

    [HttpPut("{eventId}/teams")]
    public async Task<ActionResult<EventTeam>> UpsertTeam(string eventId, [FromBody] EventTeam team)
    {
        team.EventId = eventId;
        var saved = await _eventHubService.UpsertTeamAsync(team);
        await _auditLog.LogActionAsync(GetAdminIdentity(), "sports_event.upsert_team", "event_team", team.TeamId, after: saved);
        return Ok(saved);
    }

    [HttpDelete("{eventId}/teams/{teamId}")]
    public async Task<ActionResult> DeleteTeam(string eventId, string teamId)
    {
        await _eventHubService.DeleteTeamAsync(eventId, teamId);
        await _auditLog.LogActionAsync(GetAdminIdentity(), "sports_event.delete_team", "event_team", teamId);
        return NoContent();
    }

    [HttpPut("{eventId}/matches")]
    public async Task<ActionResult<EventMatch>> UpsertMatch(string eventId, [FromBody] EventMatch match)
    {
        match.EventId = eventId;
        try
        {
            var saved = await _eventHubService.UpsertMatchAsync(match);
            await _auditLog.LogActionAsync(GetAdminIdentity(), "sports_event.upsert_match", "event_match", match.MatchId, after: saved);
            return Ok(saved);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{eventId}/matches/{matchId}")]
    public async Task<ActionResult> DeleteMatch(string eventId, string matchId)
    {
        await _eventHubService.DeleteMatchAsync(eventId, matchId);
        await _auditLog.LogActionAsync(GetAdminIdentity(), "sports_event.delete_match", "event_match", matchId);
        return NoContent();
    }

    [HttpGet("{eventId}/comments")]
    public async Task<ActionResult<List<EventComment>>> GetAllComments(string eventId)
    {
        var matches = await _eventHubService.GetMatchesAsync(eventId);
        var all = new List<EventComment>();
        foreach (var m in matches)
        {
            var comments = await _eventHubService.GetCommentsAsync(eventId, m.MatchId);
            all.AddRange(comments);
        }
        var teams = await _eventHubService.GetTeamsAsync(eventId);
        foreach (var t in teams)
        {
            var comments = await _eventHubService.GetCommentsAsync(eventId, t.TeamId);
            all.AddRange(comments);
        }
        return Ok(all.OrderByDescending(c => c.CreatedAt).ToList());
    }

    [HttpPost("{eventId}/comments/{commentKey}/hide")]
    public async Task<ActionResult> HideComment(string eventId, string commentKey)
    {
        await _eventHubService.HideCommentAsync(eventId, commentKey);
        await _auditLog.LogActionAsync(GetAdminIdentity(), "sports_event.hide_comment", "event_comment", commentKey);
        return Ok(new { hidden = true });
    }

    [HttpDelete("{eventId}/comments/{commentKey}")]
    public async Task<ActionResult> DeleteComment(string eventId, string commentKey)
    {
        await _eventHubService.DeleteCommentAsync(eventId, commentKey);
        await _auditLog.LogActionAsync(GetAdminIdentity(), "sports_event.delete_comment", "event_comment", commentKey);
        return NoContent();
    }

    [HttpPost("{eventId}/bans/{userId}")]
    public async Task<ActionResult> BanUser(string eventId, string userId, [FromBody] EventBanUserRequest? request)
    {
        var adminId = User.Identity?.Name ?? "admin";
        await _eventHubService.BanUserAsync(eventId, userId, request?.Reason, adminId);
        await _auditLog.LogActionAsync(GetAdminIdentity(), "sports_event.ban_user", "event_ban", userId, after: request);
        return Ok(new { banned = true });
    }

    private AdminIdentity GetAdminIdentity()
    {
        if (HttpContext.Items["AdminIdentity"] is AdminIdentity identity) return identity;
        var sub = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value
            ?? "admin";
        return new AdminIdentity
        {
            Sub = sub,
            CognitoUsername = User.FindFirst("cognito:username")?.Value,
            Email = User.FindFirst(ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value,
        };
    }

    private string ResolveEnvironment()
    {
        var asp = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";
        return string.Equals(asp, "Development", StringComparison.OrdinalIgnoreCase) ? "dev" : "prod";
    }
}

public sealed class EventBanUserRequest
{
    public string? Reason { get; set; }
}
