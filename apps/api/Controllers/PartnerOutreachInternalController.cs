using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Services.PartnerOutreach;

namespace GetTrainMate.Api.Controllers;

/// <summary>
/// SES inbound / event / scheduler callbacks. Not public Admin CRM.
/// Authenticated with X-Partner-Email-Token (separate from Cursor SES IAM).
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/internal/partner-outreach")]
public class PartnerOutreachInternalController : ControllerBase
{
    private readonly IPartnerOutreachService _svc;

    public PartnerOutreachInternalController(IPartnerOutreachService svc) => _svc = svc;

    bool Authorized()
    {
        var expected = Environment.GetEnvironmentVariable("PARTNER_EMAIL_INTERNAL_TOKEN")?.Trim();
        if (string.IsNullOrWhiteSpace(expected)) return false;
        var got = Request.Headers["X-Partner-Email-Token"].FirstOrDefault()?.Trim();
        return string.Equals(expected, got, StringComparison.Ordinal);
    }

    [HttpPost("inbound")]
    public async Task<IActionResult> Inbound([FromBody] InboundPayload body)
    {
        if (!Authorized()) return Unauthorized();
        if (string.IsNullOrWhiteSpace(body.RawMime) || string.IsNullOrWhiteSpace(body.DedupeKey))
            return BadRequest();
        return Ok(await _svc.IngestInboundAsync(body.RawMime, body.DedupeKey));
    }

    [HttpPost("events")]
    public async Task<IActionResult> Events([FromBody] SesEventPayload body)
    {
        if (!Authorized()) return Unauthorized();
        if (string.IsNullOrWhiteSpace(body.InternalMessageId) || string.IsNullOrWhiteSpace(body.EventType))
            return BadRequest();
        await _svc.ApplySesEventAsync(body.InternalMessageId, body.EventType);
        return Ok(new { ok = true });
    }

    [HttpPost("dispatch")]
    public async Task<IActionResult> Dispatch()
    {
        if (!Authorized()) return Unauthorized();
        return Ok(await _svc.DispatchDueAsync(scheduledCursorAutomation: false));
    }
}

public class InboundPayload
{
    public string RawMime { get; set; } = "";
    public string DedupeKey { get; set; } = "";
}

public class SesEventPayload
{
    public string InternalMessageId { get; set; } = "";
    public string EventType { get; set; } = "";
}
