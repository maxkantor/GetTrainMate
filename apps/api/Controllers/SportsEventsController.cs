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
    private readonly IProfileService _profileService;

    public SportsEventsController(
        ISportsEventLayerService sportsEventLayerService,
        IEventHubService eventHubService,
        IProfileService profileService)
    {
        _sportsEventLayerService = sportsEventLayerService;
        _eventHubService = eventHubService;
        _profileService = profileService;
    }

    /// <summary>App profile name first — the JWT "name" claim is often missing or a generic "User".</summary>
    private async Task<string?> ResolveDisplayNameAsync(string userId)
    {
        try
        {
            var profile = await _profileService.GetProfileAsync(userId);
            if (!string.IsNullOrWhiteSpace(profile?.Name)) return profile.Name;
        }
        catch { /* fall back to claims */ }
        return User.FindFirst("name")?.Value ?? User.Identity?.Name;
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

    [HttpGet("{eventId}/stats/live")]
    public async Task<ActionResult<EventHubLiveStats>> GetLiveStats(string eventId)
    {
        if (!await IsHubAccessible(eventId)) return NotFound();
        return Ok(await _eventHubService.GetLiveStatsAsync(eventId));
    }

    [HttpGet("{eventId}/stats/pulse")]
    public async Task<ActionResult<CommunityPulse>> GetCommunityPulse(string eventId)
    {
        if (!await IsHubAccessible(eventId)) return NotFound();
        return Ok(await _eventHubService.GetCommunityPulseAsync(eventId));
    }

    [HttpGet("{eventId}/matches/{matchId}/prediction-breakdown")]
    public async Task<ActionResult<MatchPredictionBreakdown>> GetPredictionBreakdown(string eventId, string matchId)
    {
        if (!await IsHubAccessible(eventId)) return NotFound();
        return Ok(await _eventHubService.GetMatchPredictionBreakdownAsync(eventId, matchId));
    }

    [HttpGet("{eventId}/matches/{matchId}/intelligence")]
    public async Task<ActionResult<MatchIntelligence>> GetMatchIntelligence(string eventId, string matchId)
    {
        if (!await IsHubAccessible(eventId)) return NotFound();
        return Ok(await _eventHubService.GetMatchIntelligenceAsync(eventId, matchId));
    }

    [HttpGet("{eventId}/predictions/feed")]
    public async Task<ActionResult<List<PublicFanPick>>> GetFanPicksFeed(
        string eventId,
        [FromQuery] string? matchId = null,
        [FromQuery] string sort = "recent",
        [FromQuery] int limit = 50)
    {
        if (!await IsHubAccessible(eventId)) return NotFound();
        return Ok(await _eventHubService.GetFanPicksFeedAsync(eventId, matchId, sort, limit));
    }

    [HttpGet("{eventId}/matches/{matchId}/predictions")]
    public async Task<ActionResult<List<PublicFanPick>>> GetMatchFanPicks(
        string eventId, string matchId, [FromQuery] string sort = "recent", [FromQuery] int limit = 30)
    {
        if (!await IsHubAccessible(eventId)) return NotFound();
        return Ok(await _eventHubService.GetFanPicksFeedAsync(eventId, matchId, sort, limit));
    }

    [HttpGet("{eventId}/teams/stats")]
    public async Task<ActionResult<List<TeamExplorerStats>>> GetTeamStats(string eventId)
    {
        if (!await IsHubAccessible(eventId)) return NotFound();
        return Ok(await _eventHubService.GetTeamExplorerStatsAsync(eventId));
    }

    [HttpGet("{eventId}/comments/trending")]
    public async Task<ActionResult<List<EventComment>>> GetTrendingComments(string eventId, [FromQuery] string sort = "trending")
    {
        if (!await IsHubAccessible(eventId)) return NotFound();
        return Ok(await _eventHubService.GetTrendingCommentsAsync(eventId, sort));
    }

    [HttpPost("{eventId}/comments/{commentKey}/like")]
    public async Task<ActionResult> LikeComment(string eventId, string commentKey)
    {
        var userId = GetUserId();
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        if (!await IsHubAccessible(eventId)) return NotFound();
        await _eventHubService.LikeCommentAsync(eventId, commentKey);
        return Ok(new { liked = true });
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

    [HttpGet("{eventId}/predictions/mine/summary")]
    public async Task<ActionResult<UserPicksSummary>> GetMyPicksSummary(string eventId)
    {
        var userId = GetUserId();
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        if (!await IsHubAccessible(eventId)) return NotFound();
        return Ok(await _eventHubService.GetUserPicksSummaryAsync(eventId, userId));
    }

    [HttpPost("{eventId}/predictions")]
    public async Task<ActionResult<EventPrediction>> CreatePrediction(string eventId, [FromBody] CreatePredictionRequest request)
    {
        var userId = GetUserId();
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        if (!await IsHubAccessible(eventId)) return NotFound();

        try
        {
            var displayName = await ResolveDisplayNameAsync(userId);
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
            var displayName = await ResolveDisplayNameAsync(userId);
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
