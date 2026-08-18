using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using GetTrainMate.Api.Services.PartnerOutreach;
using System.Security.Claims;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin/partner-outreach")]
[Authorize]
public class AdminPartnerOutreachController : ControllerBase
{
    private readonly IPartnerOutreachService _svc;
    private readonly AutomatedMarketDiscoveryService _discovery;

    public AdminPartnerOutreachController(IPartnerOutreachService svc, AutomatedMarketDiscoveryService discovery)
    {
        _svc = svc;
        _discovery = discovery;
    }

    string Actor() =>
        User.FindFirst(ClaimTypes.Email)?.Value
        ?? User.FindFirst("email")?.Value
        ?? "admin";

    [HttpGet("prospects")]
    public async Task<IActionResult> Prospects([FromQuery] string? status) =>
        Ok(await _svc.ListProspectsAsync(status));

    [HttpPost("prospects")]
    public async Task<IActionResult> CreateProspect([FromBody] PartnerProspect body)
    {
        try { return Ok(await _svc.CreateProspectAsync(body, Actor())); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPut("prospects/{id}")]
    public async Task<IActionResult> UpdateProspect(string id, [FromBody] PartnerProspect body)
    {
        try { return Ok(await _svc.UpdateProspectAsync(id, body)); }
        catch (KeyNotFoundException) { return NotFound(); }
    }

    [HttpPost("drafts")]
    public async Task<IActionResult> Draft([FromBody] DraftRequest req)
    {
        try { return Ok(await _svc.CreateDraftAndQueuePreviewAsync(req.ProspectId, req.CampaignId ?? "")); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpGet("queue")]
    public async Task<IActionResult> Queue([FromQuery] string? status) =>
        Ok(await _svc.ListQueueAsync(status));

    [HttpPost("queue/{queueId}/approve")]
    public async Task<IActionResult> Approve(string queueId, [FromBody] ConfirmRequest req)
    {
        try { return Ok(await _svc.ApproveAsync(queueId, Actor(), req.Confirm)); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpGet("threads/{threadId}")]
    public async Task<IActionResult> Thread(string threadId)
    {
        var t = await _svc.GetThreadAsync(threadId);
        if (t == null) return NotFound();
        var msgs = await _svc.ListMessagesAsync(threadId);
        return Ok(new { thread = t, messages = msgs });
    }

    [HttpPost("threads/{threadId}/reply")]
    public async Task<IActionResult> Reply(string threadId, [FromBody] CrmReplyRequest req)
    {
        try { return Ok(await _svc.SendCrmReplyAsync(threadId, req.BodyText, Actor(), req.ConfirmSend)); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpGet("metrics")]
    public async Task<IActionResult> Metrics() => Ok(await _svc.MetricsAsync());

    [HttpGet("campaigns")]
    public async Task<IActionResult> Campaigns() => Ok(await _svc.ListCampaignsAsync());

    [HttpPost("campaigns/{campaignId}/status")]
    public async Task<IActionResult> CampaignStatus(string campaignId, [FromBody] CampaignStatusRequest req)
    {
        try { return Ok(await _svc.SetCampaignStatusAsync(campaignId, req.Status)); }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("discover/automated")]
    public async Task<IActionResult> DiscoverAutomated([FromBody] AutomatedDiscoverRequest? req)
    {
        try
        {
            var report = await _discovery.RunAsync(req?.PrepareDrafts ?? true, req?.MaxPerMarket ?? 35);
            return Ok(report);
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpGet("discovery/summary")]
    public async Task<IActionResult> DiscoverySummary()
    {
        var prospects = await _svc.ListProspectsAsync(null);
        var queue = await _svc.ListQueueAsync(null);
        return Ok(new
        {
            organizationsDiscovered = prospects.Count,
            qualifiedOrganizations = prospects.Count(p => p.Status is "prospect" or "draft" or "approved"),
            verifiedPublicContacts = prospects.Count(p => p.EmailVerificationStatus == "verified_public" || (!string.IsNullOrWhiteSpace(p.Email) && p.Email.Contains('@'))),
            contactsUnavailable = prospects.Count(p => p.Status == "no_verified_public_email"),
            languageTemplateUnavailable = prospects.Count(p => p.Status == "qualified_language_unavailable"),
            inviteCodesGenerated = prospects.Count(p => !string.IsNullOrWhiteSpace(p.PartnerCode)),
            draftsGenerated = queue.Count(q => q.Status == "draft"),
            approvalReadyRecipients = queue.Count(q => q.Status == "draft"),
        });
    }

    [HttpPost("discover")]
    public async Task<IActionResult> Discover([FromBody] DiscoverRequest req)
    {
        try { return Ok(await _svc.DiscoverAsync(req.Country, req.Market, req.Language, req.Mode)); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("dispatch")]
    public async Task<IActionResult> Dispatch() =>
        Ok(await _svc.DispatchDueAsync(scheduledCursorAutomation: false));
}

public class DraftRequest
{
    public string ProspectId { get; set; } = "";
    public string? CampaignId { get; set; }
}

public class ConfirmRequest
{
    public bool Confirm { get; set; }
}

public class CrmReplyRequest
{
    public string BodyText { get; set; } = "";
    public bool ConfirmSend { get; set; }
}

public class CampaignStatusRequest
{
    public string Status { get; set; } = "";
}

public class DiscoverRequest
{
    public string? Country { get; set; }
    public string? Market { get; set; }
    public string? Language { get; set; }
    public string? Mode { get; set; }
}

public class AutomatedDiscoverRequest
{
    public bool PrepareDrafts { get; set; } = true;
    public int MaxPerMarket { get; set; } = 35;
}
