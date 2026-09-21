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
    private readonly AutomatedMarketDiscoveryService _discovery;

    public PartnerOutreachInternalController(IPartnerOutreachService svc, AutomatedMarketDiscoveryService discovery)
    {
        _svc = svc;
        _discovery = discovery;
    }

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

    /// <summary>Growth script: limited discovery using settings caps (ProspectsPerRun etc).</summary>
    [HttpPost("discover")]
    public async Task<IActionResult> DiscoverScheduled([FromBody] InternalDiscoverRequest? req)
    {
        if (!Authorized()) return Unauthorized();
        var settingsObj = await _svc.GetOutreachSettingsAsync();
        var type = settingsObj.GetType();
        int ReadInt(string name, int fallback)
        {
            var v = type.GetProperty(name)?.GetValue(settingsObj);
            return v is int i && i > 0 ? i : fallback;
        }

        var maxProspects = req?.MaxProspects ?? ReadInt("ProspectsPerRun", 8);
        var maxResearch = req?.MaxResearchAttempts ?? ReadInt("ResearchAttemptsPerRun", 15);
        var maxDrafts = req?.MaxDrafts ?? ReadInt("DraftsPerRun", 5);

        var report = await _discovery.RunLimitedAsync(
            maxProspects,
            maxResearch,
            maxDrafts,
            req?.OnlyCampaignId,
            req?.SeedsOnly ?? false,
            req?.PrepareDrafts ?? true);
        return Ok(report);
    }

    [HttpGet("metrics")]
    public async Task<IActionResult> Metrics()
    {
        if (!Authorized()) return Unauthorized();
        return Ok(new
        {
            metrics = await _svc.MetricsAsync(),
            dashboard = await _svc.AcquisitionDashboardAsync(),
            settings = await _svc.GetOutreachSettingsAsync(),
        });
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

public class InternalDiscoverRequest
{
    public bool PrepareDrafts { get; set; } = true;
    public bool SeedsOnly { get; set; }
    public string? OnlyCampaignId { get; set; }
    public int? MaxProspects { get; set; }
    public int? MaxResearchAttempts { get; set; }
    public int? MaxDrafts { get; set; }
}
