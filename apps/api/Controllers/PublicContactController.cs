using System.ComponentModel.DataAnnotations;
using System.Net;
using Amazon.DynamoDBv2.DataModel;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GetTrainMate.Api.Controllers;

/// <summary>Public contact form: saves to CRM contacts table and emails admins (SES / SSM).</summary>
[ApiController]
[Route("api/public")]
public class PublicContactController : ControllerBase
{
    private const int MaxNameLen = 120;
    private const int MaxEmailLen = 254;
    private const int MaxSubjectLen = 64;
    private const int MaxMessageLen = 8000;

    private readonly IDynamoDBContext _db;
    private readonly IAdminNotificationService _adminNotify;
    private readonly ILogger<PublicContactController> _logger;

    public PublicContactController(
        IDynamoDBContext db,
        IAdminNotificationService adminNotify,
        ILogger<PublicContactController> logger)
    {
        _db = db;
        _adminNotify = adminNotify;
        _logger = logger;
    }

    [HttpPost("contact")]
    [AllowAnonymous]
    public async Task<IActionResult> SubmitContact([FromBody] PublicContactRequest request, CancellationToken cancellationToken)
    {
        if (request == null)
            return BadRequest(new { error = "Invalid request." });

        var name = (request.Name ?? "").Trim();
        var email = (request.Email ?? "").Trim().ToLowerInvariant();
        var subject = (request.Subject ?? "general").Trim();
        var message = (request.Message ?? "").Trim();

        if (name.Length == 0 || name.Length > MaxNameLen)
            return BadRequest(new { error = "Name is required (max 120 characters)." });
        if (email.Length == 0 || email.Length > MaxEmailLen || !email.Contains('@', StringComparison.Ordinal))
            return BadRequest(new { error = "A valid email is required." });
        if (subject.Length > MaxSubjectLen)
            return BadRequest(new { error = "Subject is too long." });
        if (message.Length == 0 || message.Length > MaxMessageLen)
            return BadRequest(new { error = "Message is required (max 8000 characters)." });

        var contactId = Guid.NewGuid().ToString();
        try
        {
            var contact = new Contact
            {
                ContactId = contactId,
                Name = name,
                Email = email,
                Tags = new List<string> { "website", subject },
                Notes = message,
                Status = "active",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                SoftDeleted = false,
            };
            await _db.SaveAsync(contact, cancellationToken);

            var threadSubject = $"[GetTrainMate] Contact: {subject}";
            var threadId = Guid.NewGuid().ToString();
            var now = DateTime.UtcNow;
            var thread = new ContactEmailThread
            {
                ContactId = contactId,
                ThreadId = threadId,
                Subject = threadSubject,
                LastMessageAt = now,
                LastFrom = email,
                MessageCount = 1,
                Status = "open",
                Labels = new List<string> { "inbound", "website" },
            };
            await _db.SaveAsync(thread, cancellationToken);

            var inbound = new ContactEmailMessage
            {
                ThreadId = threadId,
                MessageId = $"{now:yyyy-MM-ddTHH:mm:ss.fffZ}#{Guid.NewGuid()}",
                From = $"{name} <{email}>",
                To = new List<string>(),
                Subject = threadSubject,
                BodyText = message,
                BodyHtml = $"<p>{WebUtility.HtmlEncode(message).Replace("\n", "<br>", StringComparison.Ordinal)}</p>",
                Direction = "inbound",
                CreatedAt = now,
            };
            await _db.SaveAsync(inbound, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save public contact for {Email}", email);
            return StatusCode(500, new { error = "Could not save your message. Please try again later." });
        }

        try
        {
            await _adminNotify.NotifyContactFormAsync(name, email, subject, message, contactId, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Contact saved but admin email failed for {Email}", email);
        }

        return Ok(new { ok = true, message = "Thank you. We will get back to you soon." });
    }
}

public class PublicContactRequest
{
    [Required]
    public string Name { get; set; } = "";

    [Required]
    public string Email { get; set; } = "";

    public string? Subject { get; set; }

    [Required]
    public string Message { get; set; } = "";
}
