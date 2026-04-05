using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using System.Security.Claims;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin/events")]
[Authorize]
public class AdminEventsController : ControllerBase
{
    private readonly IEventService _eventService;
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<AdminEventsController> _logger;

    public AdminEventsController(
        IEventService eventService,
        IAuditLogService auditLogService,
        ILogger<AdminEventsController> logger)
    {
        _eventService = eventService;
        _auditLogService = auditLogService;
        _logger = logger;
    }

    private AdminIdentity GetAdminIdentity()
    {
        if (HttpContext.Items["AdminIdentity"] is AdminIdentity identity)
            return identity;

        var sub = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value
            ?? throw new UnauthorizedAccessException("Admin identity not found");

        return new AdminIdentity
        {
            Sub = sub,
            CognitoUsername = User.FindFirst("cognito:username")?.Value,
            Email = User.FindFirst(ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value
        };
    }

    /// <summary>
    /// GET /api/admin/events?page=&pageSize=
    /// List events with pagination
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<PagedResponse<EventListItem>>> GetEvents(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        try
        {
            var events = await _eventService.ListAllEventsForAdminAsync();
            var paged = events
                .OrderByDescending(e => e.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(e => new EventListItem
                {
                    EventId = e.EventId,
                    Name = e.Title,
                    Date = e.EventDate,
                    Location = e.City,
                    AttendeeCount = e.ParticipantIds?.Count ?? 0,
                    CreatedAt = e.CreatedAt
                })
                .ToList();

            return Ok(new PagedResponse<EventListItem>
            {
                Items = paged,
                Page = page,
                PageSize = pageSize,
                TotalCount = events.Count,
                TotalPages = (int)Math.Ceiling(events.Count / (double)pageSize)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing events");
            return StatusCode(500, new { error = "Failed to list events" });
        }
    }

    /// <summary>
    /// POST /api/admin/events
    /// Create a new event
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<Event>> CreateEvent([FromBody] AdminCreateEventRequest request)
    {
        try
        {
            var admin = GetAdminIdentity();

            var createReq = new CreateEventRequest
            {
                Title = request.Name,
                Description = request.Description ?? string.Empty,
                EventDate = request.Date,
                City = request.Location,
                Sport = request.SportTags?.FirstOrDefault() ?? "general",
                SkillLevel = string.Empty,
                MaxParticipants = 10
            };

            var evt = await _eventService.CreateEventAsync(
                createReq,
                admin.Sub,
                admin.Email ?? admin.CognitoUsername ?? "admin");

            await _auditLogService.LogActionAsync(
                admin,
                "event.create",
                "event",
                evt.EventId,
                after: evt);

            return CreatedAtAction(nameof(GetEvent), new { eventId = evt.EventId }, evt);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating event");
            return StatusCode(500, new { error = "Failed to create event" });
        }
    }

    /// <summary>
    /// GET /api/admin/events/{eventId}
    /// Get event details
    /// </summary>
    [HttpGet("{eventId}")]
    public async Task<ActionResult<Event>> GetEvent(string eventId)
    {
        try
        {
            var evt = await _eventService.GetEventAsync(eventId);
            if (evt == null)
                return NotFound(new { error = "Event not found" });

            return Ok(evt);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting event {EventId}", eventId);
            return StatusCode(500, new { error = "Failed to get event" });
        }
    }

    /// <summary>
    /// PUT /api/admin/events/{eventId}
    /// Update an event
    /// </summary>
    [HttpPut("{eventId}")]
    public async Task<ActionResult<Event>> UpdateEvent(string eventId, [FromBody] AdminUpdateEventRequest request)
    {
        try
        {
            var admin = GetAdminIdentity();

            var evt = await _eventService.GetEventAsync(eventId);
            if (evt == null)
                return NotFound(new { error = "Event not found" });

            var before = System.Text.Json.JsonSerializer.Serialize(evt);

            if (!string.IsNullOrEmpty(request.Name)) evt.Title = request.Name;
            if (!string.IsNullOrEmpty(request.Description)) evt.Description = request.Description;
            if (request.Date.HasValue) evt.EventDate = request.Date.Value;
            if (!string.IsNullOrEmpty(request.Location)) evt.City = request.Location;
            if (request.SportTags != null && request.SportTags.Any()) evt.Sport = request.SportTags.First();
            evt.UpdatedAt = DateTime.UtcNow;

            await _eventService.PutEventAsync(evt);

            await _auditLogService.LogActionAsync(
                admin,
                "event.update",
                "event",
                eventId,
                before: System.Text.Json.JsonSerializer.Deserialize<object>(before),
                after: evt);

            return Ok(evt);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating event {EventId}", eventId);
            return StatusCode(500, new { error = "Failed to update event" });
        }
    }

    /// <summary>
    /// DELETE /api/admin/events/{eventId}
    /// Delete an event
    /// </summary>
    [HttpDelete("{eventId}")]
    public async Task<ActionResult> DeleteEvent(string eventId)
    {
        try
        {
            var admin = GetAdminIdentity();

            var evt = await _eventService.GetEventAsync(eventId);
            if (evt == null)
                return NotFound(new { error = "Event not found" });

            var before = System.Text.Json.JsonSerializer.Serialize(evt);
            var ok = await _eventService.DeleteEventByIdAsync(eventId);
            if (!ok)
                return StatusCode(500, new { error = "Failed to delete event" });

            await _auditLogService.LogActionAsync(
                admin,
                "event.delete",
                "event",
                eventId,
                before: System.Text.Json.JsonSerializer.Deserialize<object>(before));

            return Ok(new { message = "Event deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting event {EventId}", eventId);
            return StatusCode(500, new { error = "Failed to delete event" });
        }
    }
}

// Request/Response models
public class EventListItem
{
    public string EventId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public string Location { get; set; } = string.Empty;
    public int AttendeeCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AdminCreateEventRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime Date { get; set; }
    public string Location { get; set; } = string.Empty;
    public List<string>? SportTags { get; set; }
}

public class AdminUpdateEventRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public DateTime? Date { get; set; }
    public string? Location { get; set; }
    public List<string>? SportTags { get; set; }
}
