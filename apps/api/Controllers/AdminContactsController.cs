using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Amazon.DynamoDBv2.DataModel;
using System.Net;
using System.Security.Claims;
using System.Text.Json;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin/contacts")]
[Authorize]
public class AdminContactsController : ControllerBase
{
    private readonly IDynamoDBContext _context;
    private readonly IEmailService _emailService;
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<AdminContactsController> _logger;

    public AdminContactsController(
        IDynamoDBContext context,
        IEmailService emailService,
        IAuditLogService auditLogService,
        ILogger<AdminContactsController> logger)
    {
        _context = context;
        _emailService = emailService;
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
    /// GET /api/admin/contacts?search=&status=&tag=&page=&pageSize=
    /// List contacts with pagination and filtering
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<PagedResponse<ContactListItem>>> GetContacts(
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? tag = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        try
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 200);

            var scan = _context.ScanAsync<Contact>(new List<ScanCondition>());
            var all = await scan.GetRemainingAsync();
            var active = all.Where(c => !c.SoftDeleted).ToList();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var q = search.Trim();
                active = active.Where(c =>
                    c.Name.Contains(q, StringComparison.OrdinalIgnoreCase)
                    || c.Email.Contains(q, StringComparison.OrdinalIgnoreCase)
                    || (!string.IsNullOrEmpty(c.Phone) && c.Phone.Contains(q, StringComparison.OrdinalIgnoreCase))).ToList();
            }

            if (!string.IsNullOrWhiteSpace(status))
            {
                active = active.Where(c =>
                    string.Equals(c.Status, status.Trim(), StringComparison.OrdinalIgnoreCase)).ToList();
            }

            if (!string.IsNullOrWhiteSpace(tag))
            {
                var t = tag.Trim();
                active = active.Where(c => c.Tags != null && c.Tags.Contains(t, StringComparer.OrdinalIgnoreCase)).ToList();
            }

            var totalCount = active.Count;
            var paged = active
                .OrderByDescending(c => c.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(c => new ContactListItem
                {
                    ContactId = c.ContactId,
                    Name = c.Name,
                    Email = c.Email,
                    Phone = c.Phone,
                    Status = c.Status,
                    Tags = c.Tags ?? new List<string>(),
                    CreatedAt = c.CreatedAt
                })
                .ToList();

            return Ok(new PagedResponse<ContactListItem>
            {
                Items = paged,
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize))
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing contacts");
            return StatusCode(500, new { error = "Failed to list contacts" });
        }
    }

    /// <summary>
    /// GET /api/admin/contacts/{contactId}
    /// Get contact details
    /// </summary>
    [HttpGet("{contactId}")]
    public async Task<ActionResult<Contact>> GetContact(string contactId)
    {
        try
        {
            var contact = await _context.LoadAsync<Contact>(contactId);
            if (contact == null || contact.SoftDeleted)
            {
                return NotFound(new { error = "Contact not found" });
            }

            return Ok(contact);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting contact {ContactId}", contactId);
            return StatusCode(500, new { error = "Failed to get contact" });
        }
    }

    /// <summary>
    /// POST /api/admin/contacts
    /// Create a new contact
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<Contact>> CreateContact([FromBody] CreateContactRequest request)
    {
        try
        {
            var admin = GetAdminIdentity();
            
            var contact = new Contact
            {
                ContactId = Guid.NewGuid().ToString(),
                Name = request.Name,
                Email = request.Email.ToLowerInvariant(),
                Phone = request.Phone,
                Tags = request.Tags ?? new List<string>(),
                Notes = request.Notes,
                Status = "active",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _context.SaveAsync(contact);

            await _auditLogService.LogActionAsync(
                admin,
                "contact.create",
                "contact",
                contact.ContactId,
                after: contact);

            return CreatedAtAction(nameof(GetContact), new { contactId = contact.ContactId }, contact);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating contact");
            return StatusCode(500, new { error = "Failed to create contact" });
        }
    }

    /// <summary>
    /// PUT /api/admin/contacts/{contactId}
    /// Update a contact
    /// </summary>
    [HttpPut("{contactId}")]
    public async Task<ActionResult<Contact>> UpdateContact(string contactId, [FromBody] UpdateContactRequest request)
    {
        try
        {
            var admin = GetAdminIdentity();
            
            var contact = await _context.LoadAsync<Contact>(contactId);
            if (contact == null || contact.SoftDeleted)
            {
                return NotFound(new { error = "Contact not found" });
            }

            var before = JsonSerializer.Serialize(contact);

            // Update fields
            if (!string.IsNullOrEmpty(request.Name)) contact.Name = request.Name;
            if (!string.IsNullOrEmpty(request.Email)) contact.Email = request.Email.ToLowerInvariant();
            if (request.Phone != null) contact.Phone = request.Phone;
            if (request.Tags != null) contact.Tags = request.Tags;
            if (request.Status != null) contact.Status = request.Status;
            if (request.Notes != null) contact.Notes = request.Notes;
            contact.UpdatedAt = DateTime.UtcNow;

            await _context.SaveAsync(contact);

            await _auditLogService.LogActionAsync(
                admin,
                "contact.update",
                "contact",
                contactId,
                before: JsonSerializer.Deserialize<object>(before),
                after: contact);

            return Ok(contact);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating contact {ContactId}", contactId);
            return StatusCode(500, new { error = "Failed to update contact" });
        }
    }

    /// <summary>
    /// DELETE /api/admin/contacts/{contactId}
    /// Soft delete a contact
    /// </summary>
    [HttpDelete("{contactId}")]
    public async Task<ActionResult> DeleteContact(string contactId)
    {
        try
        {
            var admin = GetAdminIdentity();
            
            var contact = await _context.LoadAsync<Contact>(contactId);
            if (contact == null || contact.SoftDeleted)
            {
                return NotFound(new { error = "Contact not found" });
            }

            var before = JsonSerializer.Serialize(contact);
            contact.SoftDeleted = true;
            contact.UpdatedAt = DateTime.UtcNow;

            await _context.SaveAsync(contact);

            await _auditLogService.LogActionAsync(
                admin,
                "contact.delete",
                "contact",
                contactId,
                before: JsonSerializer.Deserialize<object>(before),
                after: contact);

            return Ok(new { message = "Contact deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting contact {ContactId}", contactId);
            return StatusCode(500, new { error = "Failed to delete contact" });
        }
    }

    /// <summary>
    /// GET /api/admin/contacts/{contactId}/threads
    /// Get email threads for a contact
    /// </summary>
    [HttpGet("{contactId}/threads")]
    public async Task<ActionResult<List<ContactEmailThread>>> GetThreads(string contactId)
    {
        try
        {
            var threads = (await _context.QueryAsync<ContactEmailThread>(contactId)
                .GetRemainingAsync()).ToList();

            if (threads.Count == 0)
            {
                var backfilled = await TryBackfillInboundThreadAsync(contactId);
                if (backfilled != null)
                    threads.Add(backfilled);
            }

            return Ok(threads.OrderByDescending(t => t.LastMessageAt).ToList());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting threads for contact {ContactId}", contactId);
            return StatusCode(500, new { error = "Failed to get threads" });
        }
    }

    /// <summary>Legacy contact-form rows stored message in Notes only — create a thread on first read.</summary>
    private async Task<ContactEmailThread?> TryBackfillInboundThreadAsync(string contactId)
    {
        var contact = await _context.LoadAsync<Contact>(contactId);
        if (contact == null || contact.SoftDeleted || string.IsNullOrWhiteSpace(contact.Notes))
            return null;

        var topic = contact.Tags?
            .FirstOrDefault(t => !string.Equals(t, "website", StringComparison.OrdinalIgnoreCase))
            ?? "general";
        var threadSubject = $"[GetTrainMate] Contact: {topic}";
        var threadId = Guid.NewGuid().ToString();
        var created = contact.CreatedAt == default ? DateTime.UtcNow : contact.CreatedAt;

        var thread = new ContactEmailThread
        {
            ContactId = contactId,
            ThreadId = threadId,
            Subject = threadSubject,
            LastMessageAt = created,
            LastFrom = contact.Email,
            MessageCount = 1,
            Status = "open",
            Labels = new List<string> { "inbound", "website", "backfill" },
        };

        var inbound = new ContactEmailMessage
        {
            ThreadId = threadId,
            MessageId = $"{created:yyyy-MM-ddTHH:mm:ss.fffZ}#{Guid.NewGuid()}",
            From = $"{contact.Name} <{contact.Email}>",
            To = new List<string>(),
            Subject = threadSubject,
            BodyText = contact.Notes.Trim(),
            BodyHtml = $"<p>{WebUtility.HtmlEncode(contact.Notes.Trim()).Replace("\n", "<br>", StringComparison.Ordinal)}</p>",
            Direction = "inbound",
            CreatedAt = created,
        };

        await _context.SaveAsync(thread);
        await _context.SaveAsync(inbound);
        return thread;
    }

    /// <summary>
    /// GET /api/admin/contacts/{contactId}/threads/{threadId}
    /// Get messages in a thread
    /// </summary>
    [HttpGet("{contactId}/threads/{threadId}")]
    public async Task<ActionResult<List<ContactEmailMessage>>> GetThreadMessages(string contactId, string threadId)
    {
        try
        {
            var messages = await _context.QueryAsync<ContactEmailMessage>(threadId)
                .GetRemainingAsync();
            
            return Ok(messages.OrderBy(m => m.CreatedAt).ToList());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting messages for thread {ThreadId}", threadId);
            return StatusCode(500, new { error = "Failed to get messages" });
        }
    }

    /// <summary>
    /// POST /api/admin/contacts/{contactId}/email/reply
    /// Send email reply to a contact
    /// </summary>
    [HttpPost("{contactId}/email/reply")]
    public async Task<ActionResult<SendEmailResponse>> SendReply(string contactId, [FromBody] SendReplyRequest request)
    {
        try
        {
            var admin = GetAdminIdentity();
            
            var contact = await _context.LoadAsync<Contact>(contactId);
            if (contact == null || contact.SoftDeleted)
            {
                return NotFound(new { error = "Contact not found" });
            }

            // Get or create thread
            ContactEmailThread? thread = null;
            if (!string.IsNullOrEmpty(request.ThreadId))
            {
                thread = await _context.LoadAsync<ContactEmailThread>(contactId, request.ThreadId);
            }

            if (thread == null)
            {
                // Create new thread
                thread = new ContactEmailThread
                {
                    ContactId = contactId,
                    ThreadId = Guid.NewGuid().ToString(),
                    Subject = request.Subject,
                    LastMessageAt = DateTime.UtcNow,
                    LastFrom = admin.Email,
                    MessageCount = 0,
                    Status = "open"
                };
            }

            var adminMail = (admin.Email ?? "").Trim();
            IReadOnlyList<string>? replyTo =
                string.IsNullOrEmpty(adminMail) || !adminMail.Contains('@', StringComparison.Ordinal)
                    ? null
                    : new[] { adminMail };

            // Send email via SES (Reply-To admin so the contact can reply in a normal mail client)
            var messageId = await _emailService.SendEmailAsync(
                to: request.To,
                subject: request.Subject,
                bodyText: request.BodyText,
                bodyHtml: request.BodyHtml,
                cc: request.Cc,
                bcc: request.Bcc,
                attachments: request.Attachments?.Select(a => new EmailAttachment
                {
                    FileName = a.FileName,
                    ContentType = a.ContentType,
                    Content = Convert.FromBase64String(a.ContentBase64)
                }).ToList(),
                threadId: thread.ThreadId,
                replyToAddresses: replyTo);

            // Store message in database
            var message = new ContactEmailMessage
            {
                ThreadId = thread.ThreadId,
                MessageId = $"{DateTime.UtcNow:yyyy-MM-ddTHH:mm:ss.fffZ}#{Guid.NewGuid()}",
                From = admin.Email ?? "",
                To = new List<string> { request.To },
                Cc = request.Cc ?? new List<string>(),
                Bcc = request.Bcc ?? new List<string>(),
                Subject = request.Subject,
                BodyText = request.BodyText,
                BodyHtml = request.BodyHtml,
                SesMessageId = messageId,
                Direction = "outbound",
                CreatedAt = DateTime.UtcNow
            };

            await _context.SaveAsync(message);

            // Update thread
            thread.LastMessageAt = DateTime.UtcNow;
            thread.LastFrom = admin.Email;
            thread.MessageCount++;
            await _context.SaveAsync(thread);

            // Log audit
            await _auditLogService.LogActionAsync(
                admin,
                "contact.email.send",
                "contact",
                contactId,
                after: new { threadId = thread.ThreadId, messageId, subject = request.Subject });

            return Ok(new SendEmailResponse
            {
                MessageId = messageId,
                ThreadId = thread.ThreadId
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending email reply to contact {ContactId}", contactId);
            return StatusCode(500, new { error = "Failed to send email" });
        }
    }
}

// Request/Response models
public class ContactListItem
{
    public string ContactId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string Status { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = new();
    public DateTime CreatedAt { get; set; }
}

public class CreateContactRequest
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public List<string>? Tags { get; set; }
    public string? Notes { get; set; }
}

public class UpdateContactRequest
{
    public string? Name { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public List<string>? Tags { get; set; }
    public string? Status { get; set; }
    public string? Notes { get; set; }
}

public class SendReplyRequest
{
    public string? ThreadId { get; set; }
    public string To { get; set; } = string.Empty;
    public List<string>? Cc { get; set; }
    public List<string>? Bcc { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string BodyText { get; set; } = string.Empty;
    public string? BodyHtml { get; set; }
    public List<EmailAttachmentRequest>? Attachments { get; set; }
}

public class EmailAttachmentRequest
{
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public string ContentBase64 { get; set; } = string.Empty;
}

public class SendEmailResponse
{
    public string MessageId { get; set; } = string.Empty;
    public string ThreadId { get; set; } = string.Empty;
}
