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

    public AdminPartnerOutreachController(IPartnerOutreachService svc) => _svc = svc;

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
        try { return Ok(await _svc.CreateDraftAndQueuePreviewAsync(req.ProspectId, req.CampaignId ?? "atlanta-default")); }
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
