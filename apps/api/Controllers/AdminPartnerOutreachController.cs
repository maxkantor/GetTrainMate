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
    private readonly IPartnerDiscoveryJobService _jobs;
    private readonly IContactDiscoveryJobService _contactJobs;

    public AdminPartnerOutreachController(
        IPartnerOutreachService svc,
        AutomatedMarketDiscoveryService discovery,
        IPartnerDiscoveryJobService jobs,
        IContactDiscoveryJobService contactJobs)
    {
        _svc = svc;
        _discovery = discovery;
        _jobs = jobs;
        _contactJobs = contactJobs;
    }

    string Actor() =>
        User.FindFirst(ClaimTypes.Email)?.Value
        ?? User.FindFirst("email")?.Value
        ?? "admin";

    [HttpGet("prospects")]
    public async Task<IActionResult> Prospects([FromQuery] string? status)
    {
        var list = await _svc.ListProspectsAsync(status);
        await _svc.AttachWhyNotSentAsync(list);
        return Ok(list);
    }

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

    [HttpPost("prospects/{id}/interested")]
    public async Task<IActionResult> MarkInterested(string id)
    {
        try { return Ok(await _svc.MarkInterestedAsync(id, Actor())); }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    /// <summary>Marks partnership only — does not convert customer status. Frontend should hide until contextual.</summary>
    [HttpPost("prospects/{id}/convert-partner")]
    public async Task<IActionResult> ConvertPartner(string id)
    {
        try { return Ok(await _svc.ConvertToPartnerAsync(id, Actor())); }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpGet("prospects/{id}/detail")]
    public async Task<IActionResult> ProspectDetail(string id)
    {
        try { return Ok(await _svc.GetProspectDetailAsync(id)); }
        catch (KeyNotFoundException) { return NotFound(); }
    }

    [HttpPost("prospects/{id}/manual-contact")]
    public async Task<IActionResult> SetManualContact(string id, [FromBody] ManualContactRequest? req)
    {
        try
        {
            return Ok(await _svc.SetManualContactAsync(id, req ?? new ManualContactRequest(), Actor()));
        }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message, ok = false }); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message, ok = false }); }
    }

    [HttpPost("prospects/{id}/research-contact")]
    public async Task<IActionResult> ResearchContact(string id, [FromBody] ResearchContactRequest? req)
    {
        try { return Ok(await _svc.ResearchContactAsync(id, Actor(), req?.Force ?? false)); }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("prospects/research-contacts")]
    public async Task<IActionResult> ResearchContactsBulk([FromBody] ResearchContactsBulkRequest req)
    {
        try
        {
            return Ok(await _svc.ResearchContactsBulkAsync(
                req.ProspectIds ?? Array.Empty<string>(),
                Actor(),
                req.Max > 0 ? req.Max : 20,
                req.Force));
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    /// <summary>Upgraded discovery for one prospect (confidence-aware, contact forms, dry run).</summary>
    [HttpPost("prospects/{id}/discover-contact")]
    public async Task<IActionResult> DiscoverContact(string id, [FromBody] DiscoverContactRequest? req)
    {
        try
        {
            return Ok(await _svc.DiscoverContactAsync(id, Actor(), req?.Force ?? true, req?.DryRun ?? false));
        }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message, ok = false }); }
    }

    /// <summary>Batch discovery over explicit ids or prospects that still have no contact.</summary>
    [HttpPost("prospects/discover-contacts")]
    public async Task<IActionResult> DiscoverContactsBatch([FromBody] DiscoverContactsBatchRequest? req)
    {
        try
        {
            return Ok(await _svc.DiscoverContactsBatchAsync(req ?? new DiscoverContactsBatchRequest(), Actor()));
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message, ok = false }); }
    }

    /// <summary>Start a durable contact-discovery job (one prospect per advance poll).</summary>
    [HttpPost("prospects/contact-discovery/jobs")]
    public async Task<IActionResult> StartContactDiscoveryJob([FromBody] DiscoverContactsBatchRequest? req)
    {
        try
        {
            var job = await _contactJobs.StartAsync(new ContactDiscoveryJobRequest
            {
                ProspectIds = req?.ProspectIds,
                FilterMissingOnly = req?.FilterMissingOnly ?? true,
                Force = req?.Force ?? true,
                Max = req?.Max,
            }, Actor());
            return Ok(ToContactJobDto(job));
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message, ok = false }); }
    }

    /// <summary>Poll advances one prospect, then returns current job progress.</summary>
    [HttpGet("prospects/contact-discovery/jobs/{jobId}")]
    public async Task<IActionResult> GetOrAdvanceContactDiscoveryJob(string jobId, [FromQuery] bool advance = true)
    {
        try
        {
            var job = advance
                ? await _contactJobs.AdvanceAsync(jobId)
                : await _contactJobs.GetAsync(jobId);
            if (job == null) return NotFound();
            return Ok(ToContactJobDto(job));
        }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message, ok = false }); }
    }

    [HttpGet("prospects/contact-discovery/active")]
    public async Task<IActionResult> ActiveContactDiscoveryJob()
    {
        var job = await _contactJobs.GetActiveAsync();
        return job == null ? Ok(new { active = false }) : Ok(ToContactJobDto(job, active: true));
    }

    [HttpPost("prospects/contact-discovery/jobs/{jobId}/pause")]
    public async Task<IActionResult> PauseContactDiscoveryJob(string jobId)
    {
        try { return Ok(ToContactJobDto(await _contactJobs.PauseAsync(jobId))); }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message, ok = false }); }
    }

    [HttpPost("prospects/contact-discovery/jobs/{jobId}/resume")]
    public async Task<IActionResult> ResumeContactDiscoveryJob(string jobId)
    {
        try { return Ok(ToContactJobDto(await _contactJobs.ResumeAsync(jobId))); }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message, ok = false }); }
    }

    [HttpPost("prospects/contact-discovery/jobs/{jobId}/retry-failed")]
    public async Task<IActionResult> RetryFailedContactDiscoveryJob(string jobId)
    {
        try { return Ok(ToContactJobDto(await _contactJobs.RetryFailedAsync(jobId, Actor()))); }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message, ok = false }); }
    }

    [HttpGet("prospects/pipeline-counters")]
    public async Task<IActionResult> PipelineCounters() =>
        Ok(await _svc.GetPipelineCountersAsync());

    static object ToContactJobDto(PartnerDiscoveryJob job, bool active = false)
    {
        object? stages = null;
        if (!string.IsNullOrWhiteSpace(job.ResearchStagesJson))
        {
            try { stages = System.Text.Json.JsonSerializer.Deserialize<object>(job.ResearchStagesJson); }
            catch { stages = null; }
        }

        var remaining = Math.Max(0, job.Total - job.Processed);
        return new
        {
            active,
            jobId = job.JobId,
            jobKind = job.JobKind,
            status = job.Status,
            stage = job.Stage,
            progressPct = job.ProgressPct,
            total = job.Total,
            processed = job.Processed,
            emailsFound = job.EmailsFound,
            formsFound = job.FormsFound,
            reviewRequired = job.ReviewRequired,
            noContact = job.NoContact,
            errors = job.Errors,
            remaining,
            currentProspectId = job.CurrentProspectId,
            currentProspectName = job.CurrentProspectName,
            researchStages = stages,
            error = job.Error,
            startedAt = job.CreatedAt,
            updatedAt = job.UpdatedAt,
            completedAt = job.CompletedAt,
            reportJson = job.ReportJson,
        };
    }

    [HttpPost("prospects/{id}/pending-contact/accept")]
    public async Task<IActionResult> AcceptPendingContact(string id)
    {
        try { return Ok(await _svc.AcceptPendingContactAsync(id, Actor())); }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message, ok = false }); }
    }

    [HttpPost("prospects/{id}/pending-contact/reject")]
    public async Task<IActionResult> RejectPendingContact(string id)
    {
        try { return Ok(await _svc.RejectPendingContactAsync(id, Actor())); }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message, ok = false }); }
    }

    [HttpPost("research/contact-needed")]
    public async Task<IActionResult> ResearchContactNeeded([FromBody] ResearchContactNeededRequest? req)
    {
        try
        {
            var max = req?.Max;
            if (max is null or <= 0)
            {
                var settings = await _svc.GetOutreachSettingsAsync();
                var prop = settings.GetType().GetProperty("ResearchContactsPerRun");
                max = prop?.GetValue(settings) is int i && i > 0 ? i : 10;
            }
            return Ok(await _svc.ResearchContactNeededBatchAsync(max.Value, Actor()));
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
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

    [HttpPost("queue/{id}/approve-and-send")]
    public async Task<IActionResult> ApproveAndSend(string id, [FromBody] ConfirmRequest req)
    {
        try { return Ok(await _svc.ApproveAndSendAsync(id, Actor(), req.Confirm, req.ConfirmOverride)); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("queue/bulk-approve")]
    public async Task<IActionResult> BulkApprove([FromBody] BulkApproveRequest req)
    {
        try { return Ok(await _svc.BulkApproveAsync(req.QueueIds ?? Array.Empty<string>(), Actor(), req.Confirm)); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("queue/bulk-approve-and-send")]
    public async Task<IActionResult> BulkApproveAndSend([FromBody] BulkApproveRequest req)
    {
        try
        {
            return Ok(await _svc.BulkApproveAndSendAsync(
                req.QueueIds ?? Array.Empty<string>(),
                Actor(),
                req.Confirm,
                req.ConfirmOverride));
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("prospects/rescore-low")]
    public async Task<IActionResult> RescoreLow([FromBody] RescoreLowRequest? req)
    {
        try { return Ok(await _svc.RescoreLowScoreProspectsAsync(req?.Max > 0 ? req.Max : 50)); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("prospects/{id}/rescore")]
    public async Task<IActionResult> RescoreProspect(string id)
    {
        try { return Ok(await _svc.RescoreProspectAsync(id)); }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("queue/{id}/reject")]
    public async Task<IActionResult> Reject(string id, [FromBody] RejectQueueRequest? req)
    {
        try
        {
            if (req?.Confirm == false)
                return BadRequest(new { error = "Explicit confirmation is required." });
            return Ok(await _svc.RejectQueueAsync(id, Actor(), req?.Reason));
        }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("queue/regenerate-obsolete")]
    public async Task<IActionResult> RegenerateObsolete([FromBody] RegenerateObsoleteRequest? req)
    {
        try
        {
            return Ok(await _svc.RegenerateObsoleteUnsentDraftsAsync(Actor(), req?.ForceAllUnsentInitial ?? true));
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPut("queue/{id}")]
    public async Task<IActionResult> UpdateQueue(string id, [FromBody] UpdateQueueDraftRequest req)
    {
        try
        {
            return Ok(await _svc.UpdateQueueDraftAsync(id, req.Subject ?? "", req.BodyText ?? "", req.BodyHtml, Actor()));
        }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpGet("threads")]
    public async Task<IActionResult> Threads() => Ok(await _svc.ListThreadsAsync());

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

    [HttpGet("acquisition/dashboard")]
    public async Task<IActionResult> AcquisitionDashboard() =>
        Ok(await _svc.AcquisitionDashboardAsync());

    [HttpGet("acquisition/customers")]
    public async Task<IActionResult> AcquisitionCustomers() =>
        Ok(await _svc.ListAcquisitionCustomersAsync());

    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings() => Ok(await _svc.GetOutreachSettingsAsync());

    [HttpPut("settings")]
    public async Task<IActionResult> PutSettings([FromBody] PartnerOutreachSettingsPatch body)
    {
        try { return Ok(await _svc.UpdateOutreachSettingsAsync(body)); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpGet("campaigns")]
    public async Task<IActionResult> Campaigns() => Ok(await _svc.ListCampaignsAsync());

    [HttpPost("campaigns/{campaignId}/status")]
    public async Task<IActionResult> CampaignStatus(string campaignId, [FromBody] CampaignStatusRequest req)
    {
        try { return Ok(await _svc.SetCampaignStatusAsync(campaignId, req.Status)); }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpGet("discover/seeds")]
    public IActionResult DiscoverSeeds([FromQuery] string? campaignId)
    {
        var seeds = MarketCampaignCatalog.SeedCatalogForCampaign(campaignId);
        return Ok(seeds.Select(s => new
        {
            partnerCode = s.PartnerCode,
            organizationName = s.OrganizationName,
            website = s.Website,
            campaignId = string.IsNullOrWhiteSpace(campaignId) ? "us_atlanta_train_partners" : campaignId.Trim(),
        }));
    }

    /// <summary>
    /// Sync discovery (22s budget). Prefer POST discovery/jobs for chunked Lambda-safe runs.
    /// seedsOnly or onlyPartnerCode keep requests under API Gateway timeout.
    /// </summary>
    [HttpPost("discover/automated")]
    public async Task<IActionResult> DiscoverAutomated([FromBody] AutomatedDiscoverRequest? req)
    {
        try
        {
            // Prefer jobs for broad runs; keep sync path for seedsOnly / single-org.
            if (!(req?.SeedsOnly ?? false) && string.IsNullOrWhiteSpace(req?.OnlyPartnerCode))
            {
                var job = await _jobs.StartJobAsync(new DiscoveryJobRequest
                {
                    PrepareDrafts = req?.PrepareDrafts ?? true,
                    SeedsOnly = req?.SeedsOnly ?? false,
                    OnlyCampaignId = req?.OnlyCampaignId,
                    MaxProspects = req?.MaxProspects,
                    MaxResearchAttempts = req?.MaxResearchAttempts,
                    MaxDrafts = req?.MaxDrafts,
                }, Actor());
                return Ok(new { jobId = job.JobId, status = job.Status, note = "Use GET discovery/jobs/{jobId} to advance and poll." });
            }

            using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(22));
            var report = await _discovery.RunAsync(
                req?.PrepareDrafts ?? true,
                req?.MaxPerMarket ?? 35,
                req?.SeedsOnly ?? false,
                req?.OnlyCampaignId,
                req?.OnlyPartnerCode,
                timeoutCts.Token);
            return Ok(report);
        }
        catch (OperationCanceledException)
        {
            return StatusCode(503, new
            {
                error = "discovery_timeout",
                message = "Discovery exceeded the API time limit. Use POST discovery/jobs or set onlyPartnerCode / seedsOnly."
            });
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("discovery/jobs")]
    public async Task<IActionResult> StartDiscoveryJob([FromBody] AutomatedDiscoverRequest? req)
    {
        try
        {
            var job = await _jobs.StartJobAsync(new DiscoveryJobRequest
            {
                PrepareDrafts = req?.PrepareDrafts ?? true,
                SeedsOnly = req?.SeedsOnly ?? false,
                OnlyCampaignId = req?.OnlyCampaignId,
                MaxProspects = req?.MaxProspects,
                MaxResearchAttempts = req?.MaxResearchAttempts,
                MaxDrafts = req?.MaxDrafts,
            }, Actor());
            return Ok(job);
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    /// <summary>Poll advances one chunk of work (~15s), then returns the job.</summary>
    [HttpGet("discovery/jobs/{jobId}")]
    public async Task<IActionResult> GetOrAdvanceDiscoveryJob(string jobId)
    {
        try
        {
            var job = await _jobs.AdvanceJobAsync(jobId);
            return Ok(job);
        }
        catch (KeyNotFoundException) { return NotFound(); }
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
            qualifiedOrganizations = prospects.Count(p => p.Status is "prospect" or "draft" or "approved"
                || p.CrmLifecycle == PartnerCrmLifecycle.Qualified),
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

    [HttpPost("automatic-run")]
    public async Task<IActionResult> AutomaticRun([FromBody] AutomaticRunRequest? req)
    {
        try
        {
            return Ok(await _svc.RunAutomaticAcquisitionAsync(
                User?.Identity?.Name ?? "admin",
                req?.DryRun,
                budgetSeconds: 18));
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("bootstrap")]
    public async Task<IActionResult> Bootstrap() =>
        Ok(await _svc.BootstrapProductionCampaignAsync());

    [HttpPost("dedupe")]
    public async Task<IActionResult> Dedupe([FromBody] DedupeRequest? req) =>
        Ok(await _svc.DedupeAsync(req?.DryRun ?? false));
}

public class AutomaticRunRequest
{
    public bool? DryRun { get; set; }
}

public class DraftRequest
{
    public string ProspectId { get; set; } = "";
    public string? CampaignId { get; set; }
}

public class ConfirmRequest
{
    public bool Confirm { get; set; }
    public bool ConfirmOverride { get; set; }
}

public class BulkApproveRequest
{
    public IEnumerable<string>? QueueIds { get; set; }
    public bool Confirm { get; set; }
    public bool ConfirmOverride { get; set; }
}

public class RescoreLowRequest
{
    public int Max { get; set; } = 50;
}

public class RegenerateObsoleteRequest
{
    /// <summary>When true, regenerate every unsent initial draft (not only obsolete markers).</summary>
    public bool ForceAllUnsentInitial { get; set; } = true;
}

public class RejectQueueRequest
{
    public string? Reason { get; set; }
    public bool Confirm { get; set; } = true;
}

public class UpdateQueueDraftRequest
{
    public string Subject { get; set; } = "";
    public string BodyText { get; set; } = "";
    public string? BodyHtml { get; set; }
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
    /// <summary>Admin UI: verify Atlanta seed catalog only (skips slow Overpass OSM queries).</summary>
    public bool SeedsOnly { get; set; }
    /// <summary>Optional filter, e.g. us_atlanta_train_partners.</summary>
    public string? OnlyCampaignId { get; set; }
    /// <summary>Process a single seed-catalog org (keeps each request under API Gateway timeout).</summary>
    public string? OnlyPartnerCode { get; set; }
    public int? MaxProspects { get; set; }
    public int? MaxResearchAttempts { get; set; }
    public int? MaxDrafts { get; set; }
}

public class DedupeRequest
{
    public bool DryRun { get; set; }
}

public class ResearchContactRequest
{
    public bool Force { get; set; }
}

public class ResearchContactsBulkRequest
{
    public IEnumerable<string>? ProspectIds { get; set; }
    public bool Force { get; set; }
    public int Max { get; set; } = 20;
}

public class ResearchContactNeededRequest
{
    public int? Max { get; set; }
}
