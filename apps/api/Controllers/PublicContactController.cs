using System.ComponentModel.DataAnnotations;
using System.Net;
using Amazon.DynamoDBv2.DataModel;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using GetTrainMate.Api.Services.ContactForm;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GetTrainMate.Api.Controllers;

/// <summary>Public contact form: validates, guards against bots, saves to CRM, emails admins.</summary>
[ApiController]
[Route("api/public")]
[RequestSizeLimit(ContactFormProtection.MaxRequestBodyBytes)]
public class PublicContactController : ControllerBase
{
    // Shared-IP friendly: 8 submissions / 15 min per gateway IP; 3 / hour per email.
    private static readonly TimeSpan IpRateWindow = TimeSpan.FromMinutes(15);
    private const int IpRateLimit = 8;
    private static readonly TimeSpan EmailRateWindow = TimeSpan.FromHours(1);
    private const int EmailRateLimit = 3;
    private static readonly TimeSpan DedupeTtl = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan CaptchaTokenTtl = TimeSpan.FromMinutes(10);

    private readonly IDynamoDBContext _db;
    private readonly IAdminNotificationService _adminNotify;
    private readonly IContactFormGuardStore _guard;
    private readonly IContactFormBotVerifier _botVerifier;
    private readonly ILogger<PublicContactController> _logger;

    public PublicContactController(
        IDynamoDBContext db,
        IAdminNotificationService adminNotify,
        IContactFormGuardStore guard,
        IContactFormBotVerifier botVerifier,
        ILogger<PublicContactController> logger)
    {
        _db = db;
        _adminNotify = adminNotify;
        _guard = guard;
        _botVerifier = botVerifier;
        _logger = logger;
    }

    [HttpPost("contact")]
    [AllowAnonymous]
    public async Task<IActionResult> SubmitContact([FromBody] PublicContactRequest? request, CancellationToken cancellationToken)
    {
        if (request == null)
        {
            LogReject("null_body", clientIp: null);
            return BadRequest(new { error = "Invalid request.", reason = "null_body" });
        }

        // Prefer gateway-derived RemoteIpAddress (API Gateway sets this). Do not trust client X-Forwarded-For.
        var clientIp = ContactFormProtection.NormalizeClientIp(HttpContext.Connection.RemoteIpAddress?.ToString());

        long? contentLength = null;
        if (Request.ContentLength.HasValue)
            contentLength = Request.ContentLength.Value;

        var validation = ContactFormProtection.Validate(
            request.Name,
            request.Email,
            request.Subject,
            request.Message,
            request.Company,
            contentLength);

        if (!validation.Ok)
        {
            LogReject(validation.ReasonCode, clientIp);
            if (validation.SilentAccept)
            {
                // Honeypot: identical UX, zero CRM/email/lead side effects (accepted=false stops client analytics).
                return Ok(new { ok = true, accepted = false, message = "Thank you. We will get back to you soon." });
            }
            return BadRequest(new { error = validation.Error, reason = validation.ReasonCode });
        }

        var normalized = validation.Normalized!;

        if (_botVerifier.IsEnabled)
        {
            var captcha = await _botVerifier.VerifyAsync(request.CaptchaToken, clientIp, cancellationToken);
            if (!captcha.Ok)
            {
                LogReject(captcha.ReasonCode, clientIp);
                return BadRequest(new { error = "Bot verification failed. Please try again.", reason = captcha.ReasonCode });
            }

            var tokenHash = ContactFormProtection.HashKey(request.CaptchaToken ?? "");
            if (!await _guard.TryClaimTokenAsync(tokenHash, CaptchaTokenTtl, cancellationToken))
            {
                LogReject("captcha_replay", clientIp);
                return BadRequest(new { error = "Bot verification failed. Please try again.", reason = "captcha_replay" });
            }
        }

        if (clientIp != null)
        {
            var ipBucket = $"rate:ip:{ContactFormProtection.HashKey(clientIp)}:{UtcBucket(IpRateWindow)}";
            if (!await _guard.TryIncrementRateAsync(ipBucket, IpRateLimit, IpRateWindow, cancellationToken))
            {
                LogReject("rate_ip", clientIp);
                return StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    error = "Too many requests. Please try again later.",
                    reason = "rate_ip",
                });
            }
        }

        var emailBucket = $"rate:email:{ContactFormProtection.HashKey(normalized.Email)}:{UtcBucket(EmailRateWindow)}";
        if (!await _guard.TryIncrementRateAsync(emailBucket, EmailRateLimit, EmailRateWindow, cancellationToken))
        {
            LogReject("rate_email", clientIp);
            return StatusCode(StatusCodes.Status429TooManyRequests, new
            {
                error = "Too many requests from this email. Please try again later.",
                reason = "rate_email",
            });
        }

        var fingerprint = ContactFormProtection.ContentFingerprint(normalized);
        if (!await _guard.TryClaimDedupeAsync(fingerprint, DedupeTtl, cancellationToken))
        {
            LogReject("duplicate", clientIp);
            // Same content retry: success UX, no second CRM/email.
            return Ok(new { ok = true, accepted = false, message = "Thank you. We will get back to you soon.", reason = "duplicate" });
        }

        var contactId = Guid.NewGuid().ToString();
        try
        {
            var contact = new Contact
            {
                ContactId = contactId,
                Name = normalized.Name,
                Email = normalized.Email,
                Tags = new List<string> { "website", normalized.Subject },
                Notes = normalized.Message,
                Status = "active",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                SoftDeleted = false,
            };
            await _db.SaveAsync(contact, cancellationToken);

            var threadSubject = $"[GetTrainMate] Contact: {normalized.Subject}";
            var threadId = Guid.NewGuid().ToString();
            var now = DateTime.UtcNow;
            var thread = new ContactEmailThread
            {
                ContactId = contactId,
                ThreadId = threadId,
                Subject = threadSubject,
                LastMessageAt = now,
                LastFrom = normalized.Email,
                MessageCount = 1,
                Status = "open",
                Labels = new List<string> { "inbound", "website" },
            };
            await _db.SaveAsync(thread, cancellationToken);

            var inbound = new ContactEmailMessage
            {
                ThreadId = threadId,
                MessageId = $"{now:yyyy-MM-ddTHH:mm:ss.fffZ}#{Guid.NewGuid()}",
                From = $"{normalized.Name} <{normalized.Email}>",
                To = new List<string>(),
                Subject = threadSubject,
                BodyText = normalized.Message,
                BodyHtml = $"<p>{WebUtility.HtmlEncode(normalized.Message).Replace("\n", "<br>", StringComparison.Ordinal)}</p>",
                Direction = "inbound",
                CreatedAt = now,
            };
            await _db.SaveAsync(inbound, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save public contact (reason=persist_error)");
            return StatusCode(500, new { error = "Could not save your message. Please try again later.", reason = "persist_error" });
        }

        try
        {
            await _adminNotify.NotifyContactFormAsync(
                normalized.Name,
                normalized.Email,
                normalized.Subject,
                normalized.Message,
                contactId,
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Contact saved but admin email failed (contactId={ContactId})", contactId);
        }

        _logger.LogInformation(
            "ContactFormAccepted reason=ok hasIp={HasIp} subject={Subject}",
            clientIp != null,
            normalized.Subject);

        return Ok(new
        {
            ok = true,
            accepted = true,
            message = "Thank you. We will get back to you soon.",
            contactId,
        });
    }

    private static string UtcBucket(TimeSpan window)
    {
        var seconds = Math.Max(60, (int)window.TotalSeconds);
        var epoch = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var bucket = epoch / seconds;
        return bucket.ToString();
    }

    private void LogReject(string reason, string? clientIp)
    {
        _logger.LogInformation(
            "ContactFormRejected reason={Reason} hasIp={HasIp}",
            reason,
            clientIp != null);
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

    /// <summary>Honeypot — must stay empty. Maps from JSON "company".</summary>
    public string? Company { get; set; }

    /// <summary>Optional Turnstile / CAPTCHA token when CONTACT_FORM_TURNSTILE_SECRET is set.</summary>
    public string? CaptchaToken { get; set; }
}
