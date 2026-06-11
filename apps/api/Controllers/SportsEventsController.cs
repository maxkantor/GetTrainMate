using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/events")]
public class SportsEventsController : ControllerBase
{
    private readonly ISportsEventLayerService _sportsEventLayerService;
    private readonly IEventHubService _eventHubService;

    public SportsEventsController(
        ISportsEventLayerService sportsEventLayerService,
        IEventHubService eventHubService)
    {
        _sportsEventLayerService = sportsEventLayerService;
        _eventHubService = eventHubService;
    }

    [HttpGet("active")]
    public async Task<ActionResult<List<EventConfig>>> GetActiveEvents()
    {
        try
        {
            var active = await _sportsEventLayerService.GetActiveEventConfigsAsync();
            var filtered = active.Where(e => _eventHubService.IsEventEffectivelyEnabled(e)).ToList();
            return Ok(filtered ?? new List<EventConfig>());
        }
        catch
        {
            return Ok(new List<EventConfig>());
        }
    }

    [HttpGet("{eventId}")]
    public async Task<ActionResult<EventConfig>> GetEvent(string eventId)
    {
        var evt = await _sportsEventLayerService.GetEventConfigAsync(eventId);
        if (evt == null) return NotFound();

        var isAdmin = HttpContext.Items.ContainsKey("AdminIdentity");
        if (!isAdmin && (!_eventHubService.IsEventEffectivelyEnabled(evt) || !evt.Enabled))
        {
            if (IsProd()) return NotFound();
        }
        return Ok(evt);
    }

    [HttpGet("{eventId}/hub")]
    public async Task<ActionResult<EventHubSnapshot>> GetHub(string eventId)
    {
        var isAdmin = HttpContext.Items.ContainsKey("AdminIdentity");
        var snapshot = await _eventHubService.GetHubSnapshotAsync(eventId, allowDisabledForAdmin: isAdmin);
        if (snapshot == null) return NotFound();
        return Ok(snapshot);
    }

    [HttpGet("{eventId}/groups")]
    public async Task<ActionResult<List<EventGroup>>> GetGroups(string eventId)
    {
        if (!await IsHubAccessible(eventId)) return NotFound();
        return Ok(await _eventHubService.GetGroupsAsync(eventId));
    }

    [HttpGet("{eventId}/teams")]
    public async Task<ActionResult<List<EventTeam>>> GetTeams(string eventId, [FromQuery] string? groupId = null)
    {
        if (!await IsHubAccessible(eventId)) return NotFound();
        return Ok(await _eventHubService.GetTeamsAsync(eventId, groupId));
    }

    [HttpGet("{eventId}/matches")]
    public async Task<ActionResult<List<EventMatch>>> GetMatches(string eventId, [FromQuery] string? date = null)
    {
        if (!await IsHubAccessible(eventId)) return NotFound();
        return Ok(await _eventHubService.GetMatchesAsync(eventId, date));
    }

    [HttpGet("{eventId}/leaderboard")]
    public async Task<ActionResult<List<EventLeaderboardEntry>>> GetLeaderboard(string eventId, [FromQuery] string type = "predictors")
    {
        if (!await IsHubAccessible(eventId)) return NotFound();
        return Ok(await _eventHubService.GetLeaderboardAsync(eventId, type));
    }

    [HttpGet("{eventId}/comments/{threadId}")]
    public async Task<ActionResult<List<EventComment>>> GetComments(string eventId, string threadId)
    {
        if (!await IsHubAccessible(eventId)) return NotFound();
        return Ok(await _eventHubService.GetCommentsAsync(eventId, threadId));
    }

    [HttpGet("{eventId}/predictions/{matchId}/mine")]
    public async Task<ActionResult<EventPrediction>> GetMyPrediction(string eventId, string matchId)
    {
        var userId = GetUserId();
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        if (!await IsHubAccessible(eventId)) return NotFound();

        var pred = await _eventHubService.GetUserPredictionAsync(eventId, matchId, userId);
        if (pred == null) return NotFound();
        return Ok(pred);
    }

    [HttpPost("{eventId}/predictions")]
    public async Task<ActionResult<EventPrediction>> CreatePrediction(string eventId, [FromBody] CreatePredictionRequest request)
    {
        var userId = GetUserId();
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        if (!await IsHubAccessible(eventId)) return NotFound();

        try
        {
            var displayName = User.FindFirst("name")?.Value ?? User.Identity?.Name;
            var pred = await _eventHubService.CreateOrUpdatePredictionAsync(eventId, userId, displayName, request);
            return Ok(pred);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{eventId}/predictions/{matchId}/share")]
    public async Task<ActionResult> SharePrediction(string eventId, string matchId)
    {
        var userId = GetUserId();
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        if (!await IsHubAccessible(eventId)) return NotFound();

        await _eventHubService.IncrementPredictionShareAsync(eventId, matchId, userId);
        return Ok(new { shared = true });
    }

    [HttpPost("{eventId}/comments")]
    public async Task<ActionResult<EventComment>> CreateComment(string eventId, [FromBody] CreateCommentRequest request)
    {
        var userId = GetUserId();
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        if (!await IsHubAccessible(eventId)) return NotFound();

        try
        {
            var displayName = User.FindFirst("name")?.Value ?? User.Identity?.Name;
            var comment = await _eventHubService.CreateCommentAsync(eventId, userId, displayName, request);
            return Ok(comment);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("{eventId}/meetups")]
    public async Task<ActionResult<List<EventMeetup>>> GetMeetups(string eventId)
    {
        if (!await IsHubAccessible(eventId)) return NotFound();
        var meetups = await _sportsEventLayerService.GetMeetupsForEventAsync(eventId);
        return Ok(meetups);
    }

    [HttpPost("{eventId}/meetups")]
    public async Task<ActionResult<EventMeetup>> CreateMeetup(string eventId, [FromBody] EventMeetup request)
    {
        var userId = GetUserId();
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        if (!await IsHubAccessible(eventId)) return NotFound();

        request.EventId = eventId;
        request.CreatedByUserId = userId;
        var meetup = await _sportsEventLayerService.CreateMeetupAsync(request);
        return Ok(meetup);
    }

    private async Task<bool> IsHubAccessible(string eventId)
    {
        var config = await _sportsEventLayerService.GetEventConfigAsync(eventId);
        if (config == null) return false;
        var isAdmin = HttpContext.Items.ContainsKey("AdminIdentity");
        if (isAdmin) return true;
        return config.Enabled && _eventHubService.IsEventEffectivelyEnabled(config);
    }

    private string? GetUserId() =>
        User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;

    private bool IsProd()
    {
        var asp = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";
        return !string.Equals(asp, "Development", StringComparison.OrdinalIgnoreCase);
    }
}
