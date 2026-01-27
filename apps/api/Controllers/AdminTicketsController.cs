using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Amazon.DynamoDBv2.DataModel;
using Amazon.DynamoDBv2.DocumentModel;
using System.Security.Claims;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin/tickets")]
[Authorize]
public class AdminTicketsController : ControllerBase
{
    private readonly IDynamoDBContext _context;
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<AdminTicketsController> _logger;

    public AdminTicketsController(
        IDynamoDBContext context,
        IAuditLogService auditLogService,
        ILogger<AdminTicketsController> logger)
    {
        _context = context;
        _auditLogService = auditLogService;
        _logger = logger;
    }

    private AdminIdentity GetAdminIdentity()
    {
        if (HttpContext.Items["AdminIdentity"] is AdminIdentity identity)
        {
            return identity;
        }
        
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
    /// GET /api/admin/tickets?status=&page=&pageSize=
    /// List support tickets with pagination
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<PagedResponse<SupportTicketListItem>>> GetTickets(
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        try
        {
            var conditions = new List<ScanCondition>();
            if (!string.IsNullOrEmpty(status))
            {
                conditions.Add(new ScanCondition(nameof(SupportTicket.Status), ScanOperator.Equal, status));
            }

            var tickets = await _context.ScanAsync<SupportTicket>(conditions)
                .GetRemainingAsync();

            var paged = tickets
                .OrderByDescending(t => t.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(t => new SupportTicketListItem
                {
                    TicketId = t.TicketId,
                    Subject = t.Subject,
                    Status = t.Status,
                    Priority = t.Priority,
                    UserId = t.UserId,
                    CreatedAt = t.CreatedAt,
                    UpdatedAt = t.UpdatedAt
                })
                .ToList();

            return Ok(new PagedResponse<SupportTicketListItem>
            {
                Items = paged,
                Page = page,
                PageSize = pageSize,
                TotalCount = tickets.Count,
                TotalPages = (int)Math.Ceiling(tickets.Count / (double)pageSize)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing tickets");
            return StatusCode(500, new { error = "Failed to list tickets" });
        }
    }

    /// <summary>
    /// GET /api/admin/tickets/{ticketId}
    /// Get ticket details
    /// </summary>
    [HttpGet("{ticketId}")]
    public async Task<ActionResult<SupportTicket>> GetTicket(string ticketId)
    {
        try
        {
            var ticket = await _context.LoadAsync<SupportTicket>(ticketId);
            if (ticket == null)
            {
                return NotFound(new { error = "Ticket not found" });
            }

            return Ok(ticket);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting ticket {TicketId}", ticketId);
            return StatusCode(500, new { error = "Failed to get ticket" });
        }
    }

    /// <summary>
    /// POST /api/admin/tickets
    /// Create a new support ticket
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<SupportTicket>> CreateTicket([FromBody] CreateTicketRequest request)
    {
        try
        {
            var admin = GetAdminIdentity();
            
            var ticket = new SupportTicket
            {
                TicketId = Guid.NewGuid().ToString(),
                Subject = request.Subject,
                Description = request.Description,
                UserId = request.UserId,
                Status = "open",
                Priority = request.Priority ?? "medium",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _context.SaveAsync(ticket);

            await _auditLogService.LogActionAsync(
                admin,
                "ticket.create",
                "ticket",
                ticket.TicketId,
                after: ticket);

            return CreatedAtAction(nameof(GetTicket), new { ticketId = ticket.TicketId }, ticket);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating ticket");
            return StatusCode(500, new { error = "Failed to create ticket" });
        }
    }

    /// <summary>
    /// PUT /api/admin/tickets/{ticketId}
    /// Update a support ticket
    /// </summary>
    [HttpPut("{ticketId}")]
    public async Task<ActionResult<SupportTicket>> UpdateTicket(string ticketId, [FromBody] UpdateTicketRequest request)
    {
        try
        {
            var admin = GetAdminIdentity();
            
            var ticket = await _context.LoadAsync<SupportTicket>(ticketId);
            if (ticket == null)
            {
                return NotFound(new { error = "Ticket not found" });
            }

            var before = System.Text.Json.JsonSerializer.Serialize(ticket);

            // Update fields
            if (!string.IsNullOrEmpty(request.Status)) ticket.Status = request.Status;
            if (!string.IsNullOrEmpty(request.Priority)) ticket.Priority = request.Priority;
            if (!string.IsNullOrEmpty(request.AdminNotes)) 
            {
                ticket.AdminNotes = ticket.AdminNotes ?? new List<string>();
                ticket.AdminNotes.Add($"[{DateTime.UtcNow:yyyy-MM-dd HH:mm}] {admin.Email}: {request.AdminNotes}");
            }
            ticket.UpdatedAt = DateTime.UtcNow;

            await _context.SaveAsync(ticket);

            await _auditLogService.LogActionAsync(
                admin,
                "ticket.update",
                "ticket",
                ticketId,
                before: System.Text.Json.JsonSerializer.Deserialize<object>(before),
                after: ticket);

            return Ok(ticket);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating ticket {TicketId}", ticketId);
            return StatusCode(500, new { error = "Failed to update ticket" });
        }
    }
}

// Request/Response models
public class SupportTicketListItem
{
    public string TicketId { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public string? UserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateTicketRequest
{
    public string Subject { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? UserId { get; set; }
    public string? Priority { get; set; }
}

public class UpdateTicketRequest
{
    public string? Status { get; set; }
    public string? Priority { get; set; }
    public string? AdminNotes { get; set; }
}
