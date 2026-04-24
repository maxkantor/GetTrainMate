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

    public SportsEventsController(ISportsEventLayerService sportsEventLayerService)
    {
        _sportsEventLayerService = sportsEventLayerService;
    }

    [HttpGet("active")]
    public async Task<ActionResult<List<EventConfig>>> GetActiveEvents()
    {
        var active = await _sportsEventLayerService.GetActiveEventConfigsAsync();
        return Ok(active);
    }

    [HttpGet("{eventId}")]
    public async Task<ActionResult<EventConfig>> GetEvent(string eventId)
    {
        var evt = await _sportsEventLayerService.GetEventConfigAsync(eventId);
        if (evt == null) return NotFound();

        var isAdmin = HttpContext.Items.ContainsKey("AdminIdentity");
        if (!evt.Enabled && !isAdmin && IsProd())
        {
            return NotFound();
        }
        return Ok(evt);
    }

    [HttpGet("{eventId}/meetups")]
    public async Task<ActionResult<List<EventMeetup>>> GetMeetups(string eventId)
    {
        var meetups = await _sportsEventLayerService.GetMeetupsForEventAsync(eventId);
        return Ok(meetups);
    }

    [HttpPost("{eventId}/meetups")]
    public async Task<ActionResult<EventMeetup>> CreateMeetup(string eventId, [FromBody] EventMeetup request)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

        request.EventId = eventId;
        request.CreatedByUserId = userId;
        var meetup = await _sportsEventLayerService.CreateMeetupAsync(request);
        return Ok(meetup);
    }

    private bool IsProd()
    {
        var asp = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";
        return !string.Equals(asp, "Development", StringComparison.OrdinalIgnoreCase);
    }
}
