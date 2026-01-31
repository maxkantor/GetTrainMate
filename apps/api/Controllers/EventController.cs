using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EventController : ControllerBase
{
    private readonly IEventService _eventService;
    private readonly ILogger<EventController> _logger;

    public EventController(
        IEventService eventService,
        ILogger<EventController> logger)
    {
        _eventService = eventService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<EventResponse>>> GetEvents([FromQuery] int limit = 50)
    {
        try
        {
            var userId = GetUserIdFromToken();
            var events = await _eventService.GetEventsAsync(limit);
            
            var response = events.Select(e => new EventResponse
            {
                EventId = e.EventId,
                Title = e.Title,
                Description = e.Description,
                Sport = e.Sport,
                City = e.City,
                EventDate = e.EventDate,
                SkillLevel = e.SkillLevel,
                MaxParticipants = e.MaxParticipants,
                ParticipantCount = e.ParticipantIds.Count,
                IsJoined = !string.IsNullOrEmpty(userId) && e.ParticipantIds.Contains(userId),
                OrganizerName = e.OrganizerName
            }).ToList();

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting events");
            return StatusCode(500, new { message = "Error retrieving events" });
        }
    }

    [HttpGet("{eventId}")]
    public async Task<ActionResult<EventResponse>> GetEvent(string eventId)
    {
        try
        {
            var userId = GetUserIdFromToken();
            var evt = await _eventService.GetEventAsync(eventId);
            
            if (evt == null)
                return NotFound(new { message = "Event not found" });

            return Ok(new EventResponse
            {
                EventId = evt.EventId,
                Title = evt.Title,
                Description = evt.Description,
                Sport = evt.Sport,
                City = evt.City,
                EventDate = evt.EventDate,
                SkillLevel = evt.SkillLevel,
                MaxParticipants = evt.MaxParticipants,
                ParticipantCount = evt.ParticipantIds.Count,
                IsJoined = !string.IsNullOrEmpty(userId) && evt.ParticipantIds.Contains(userId),
                OrganizerName = evt.OrganizerName
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting event");
            return StatusCode(500, new { message = "Error retrieving event" });
        }
    }

    [HttpPost]
    public async Task<ActionResult<EventResponse>> CreateEvent([FromBody] CreateEventRequest request)
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });

            var userName = GetNameFromToken() ?? "User";
            var evt = await _eventService.CreateEventAsync(request, userId, userName);

            return Ok(new EventResponse
            {
                EventId = evt.EventId,
                Title = evt.Title,
                Description = evt.Description,
                Sport = evt.Sport,
                City = evt.City,
                EventDate = evt.EventDate,
                SkillLevel = evt.SkillLevel,
                MaxParticipants = evt.MaxParticipants,
                ParticipantCount = evt.ParticipantIds.Count,
                IsJoined = true,
                OrganizerName = evt.OrganizerName
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating event");
            return StatusCode(500, new { message = "Error creating event" });
        }
    }

    [HttpPost("{eventId}/join")]
    public async Task<ActionResult<EventResponse>> JoinEvent(string eventId)
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });

            var success = await _eventService.JoinEventAsync(eventId, userId);
            if (!success)
                return BadRequest(new { message = "Could not join event" });

            var evt = await _eventService.GetEventAsync(eventId);
            if (evt == null)
                return NotFound(new { message = "Event not found" });

            return Ok(new EventResponse
            {
                EventId = evt.EventId,
                Title = evt.Title,
                Description = evt.Description,
                Sport = evt.Sport,
                City = evt.City,
                EventDate = evt.EventDate,
                SkillLevel = evt.SkillLevel,
                MaxParticipants = evt.MaxParticipants,
                ParticipantCount = evt.ParticipantIds.Count,
                IsJoined = true,
                OrganizerName = evt.OrganizerName
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error joining event");
            return StatusCode(500, new { message = "Error joining event" });
        }
    }

    [HttpPost("{eventId}/leave")]
    public async Task<ActionResult> LeaveEvent(string eventId)
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });

            var success = await _eventService.LeaveEventAsync(eventId, userId);
            if (!success)
                return BadRequest(new { message = "Could not leave event" });

            return Ok(new { message = "Left event successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error leaving event");
            return StatusCode(500, new { message = "Error leaving event" });
        }
    }

    [HttpGet("my-events")]
    public async Task<ActionResult<List<EventResponse>>> GetMyEvents()
    {
        try
        {
            var userId = GetUserIdFromToken();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Invalid token" });

            var events = await _eventService.GetUserEventsAsync(userId);
            
            var response = events.Select(e => new EventResponse
            {
                EventId = e.EventId,
                Title = e.Title,
                Description = e.Description,
                Sport = e.Sport,
                City = e.City,
                EventDate = e.EventDate,
                SkillLevel = e.SkillLevel,
                MaxParticipants = e.MaxParticipants,
                ParticipantCount = e.ParticipantIds.Count,
                IsJoined = true,
                OrganizerName = e.OrganizerName
            }).ToList();

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting user events");
            return StatusCode(500, new { message = "Error retrieving events" });
        }
    }

    private string? GetUserIdFromToken()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;

        if (string.IsNullOrEmpty(userId))
        {
            var authHeader = Request.Headers["Authorization"].FirstOrDefault();
            if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer "))
            {
                var token = authHeader.Substring("Bearer ".Length).Trim();
                try
                {
                    var handler = new JwtSecurityTokenHandler();
                    var jsonToken = handler.ReadJwtToken(token);
                    userId = jsonToken.Claims.FirstOrDefault(c => c.Type == "sub" || c.Type == ClaimTypes.NameIdentifier)?.Value;
                }
                catch { /* ignore parse errors */ }
            }
        }

        return userId;
    }

    private string? GetNameFromToken()
    {
        return User.FindFirst(ClaimTypes.Name)?.Value 
            ?? User.FindFirst("name")?.Value;
    }
}
