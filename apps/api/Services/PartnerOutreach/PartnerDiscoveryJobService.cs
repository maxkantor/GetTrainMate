using System.Diagnostics;
using System.Text.Json;
using Amazon.DynamoDBv2.DataModel;
using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services.PartnerOutreach;

public interface IPartnerDiscoveryJobService
{
    Task<PartnerDiscoveryJob> StartJobAsync(DiscoveryJobRequest request, string actor);
    Task<PartnerDiscoveryJob> AdvanceJobAsync(string jobId);
    Task<PartnerDiscoveryJob?> GetJobAsync(string jobId);
}

public sealed class DiscoveryJobRequest
{
    public bool PrepareDrafts { get; set; } = true;
    public bool SeedsOnly { get; set; }
    public string? OnlyCampaignId { get; set; }
    public int? MaxProspects { get; set; }
    public int? MaxResearchAttempts { get; set; }
    public int? MaxDrafts { get; set; }
}

public sealed class DiscoveryJobCheckpoint
{
    public int ChunkIndex { get; set; }
    public bool Finished { get; set; }
}

public sealed class PartnerDiscoveryJobService : IPartnerDiscoveryJobService
{
    static readonly TimeSpan ChunkBudget = TimeSpan.FromSeconds(15);
    static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    readonly IDynamoDBContext _db;
    readonly AutomatedMarketDiscoveryService _discovery;
    readonly ILogger<PartnerDiscoveryJobService> _log;

    public PartnerDiscoveryJobService(
        IDynamoDBContext db,
        AutomatedMarketDiscoveryService discovery,
        ILogger<PartnerDiscoveryJobService> log)
    {
        _db = db;
        _discovery = discovery;
        _log = log;
    }

    public async Task<PartnerDiscoveryJob> StartJobAsync(DiscoveryJobRequest request, string actor)
    {
        var settings = await LoadSettingsFallbackAsync();

        var job = new PartnerDiscoveryJob
        {
            Status = "starting",
            Stage = "starting",
            ProgressPct = 0,
            Actor = actor,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            RequestJson = JsonSerializer.Serialize(new
            {
                request.PrepareDrafts,
                request.SeedsOnly,
                request.OnlyCampaignId,
                maxProspects = request.MaxProspects ?? settings.ProspectsPerRun,
                maxResearchAttempts = request.MaxResearchAttempts ?? settings.ResearchAttemptsPerRun,
                maxDrafts = request.MaxDrafts ?? settings.DraftsPerRun,
            }, JsonOpts),
            CheckpointJson = JsonSerializer.Serialize(new DiscoveryJobCheckpoint(), JsonOpts),
        };
        await _db.SaveAsync(job);
        return job;
    }

    public async Task<PartnerDiscoveryJob?> GetJobAsync(string jobId) =>
        await _db.LoadAsync<PartnerDiscoveryJob>(jobId);

    public async Task<PartnerDiscoveryJob> AdvanceJobAsync(string jobId)
    {
        var job = await _db.LoadAsync<PartnerDiscoveryJob>(jobId)
            ?? throw new KeyNotFoundException("Discovery job not found");

        if (job.Status is "complete" or "failed")
            return job;

        var request = ParseRequest(job.RequestJson);
        var checkpoint = ParseCheckpoint(job.CheckpointJson);
        if (checkpoint.Finished)
        {
            job.Status = "complete";
            job.Stage = "complete";
            job.ProgressPct = 100;
            job.CompletedAt ??= DateTime.UtcNow;
            job.UpdatedAt = DateTime.UtcNow;
            await _db.SaveAsync(job);
            return job;
        }

        var settings = await LoadSettingsFallbackAsync();
        var maxProspects = request.MaxProspects ?? settings.ProspectsPerRun;
        var maxResearch = request.MaxResearchAttempts ?? settings.ResearchAttemptsPerRun;
        var maxDrafts = request.MaxDrafts ?? settings.DraftsPerRun;

        var remainingProspects = Math.Max(0, maxProspects - job.ProspectsFound);
        var remainingDrafts = Math.Max(0, maxDrafts - job.DraftsCreated);
        if (remainingProspects <= 0)
        {
            checkpoint.Finished = true;
            job.CheckpointJson = JsonSerializer.Serialize(checkpoint, JsonOpts);
            job.Status = "complete";
            job.Stage = "complete";
            job.ProgressPct = 100;
            job.CompletedAt ??= DateTime.UtcNow;
            job.UpdatedAt = DateTime.UtcNow;
            await _db.SaveAsync(job);
            return job;
        }

        job.Status = "discovering";
        job.Stage = "discovering";
        job.UpdatedAt = DateTime.UtcNow;
        await _db.SaveAsync(job);

        using var cts = new CancellationTokenSource(ChunkBudget);
        var sw = Stopwatch.StartNew();
        try
        {
            job.Stage = "researching";
            job.ProgressPct = Math.Min(90, 10 + checkpoint.ChunkIndex * 20);
            await _db.SaveAsync(job);

            var report = await _discovery.RunLimitedAsync(
                remainingProspects,
                maxResearch,
                Math.Max(remainingDrafts, request.PrepareDrafts ? 1 : 0),
                request.OnlyCampaignId,
                request.SeedsOnly,
                request.PrepareDrafts,
                cts.Token);

            job.ProspectsFound += report.OrganizationsDiscovered;
            job.DraftsCreated += report.DraftsGenerated;
            job.ContactsFound += report.VerifiedPublicContacts;
            job.ReportJson = JsonSerializer.Serialize(report, JsonOpts);
            checkpoint.ChunkIndex++;
            checkpoint.Finished = true;
            job.CheckpointJson = JsonSerializer.Serialize(checkpoint, JsonOpts);
            job.Status = "complete";
            job.Stage = "complete";
            job.ProgressPct = 100;
            job.CompletedAt = DateTime.UtcNow;
            job.UpdatedAt = DateTime.UtcNow;
            await _db.SaveAsync(job);
            return job;
        }
        catch (OperationCanceledException)
        {
            // Never delete discovered rows; mark partial if any found.
            job.Error = "chunk_timeout";
            job.Status = "partial";
            job.Stage = "partial";
            job.ProgressPct = Math.Min(95, 20 + checkpoint.ChunkIndex * 15);
            checkpoint.ChunkIndex++;
            // Allow another AdvanceJobAsync poll to continue with a fresh limited run
            // (duplicates are skipped by CreateProspectAsync / dedupe).
            job.CheckpointJson = JsonSerializer.Serialize(checkpoint, JsonOpts);
            job.UpdatedAt = DateTime.UtcNow;
            await _db.SaveAsync(job);
            _log.LogInformation("Discovery job {JobId} chunk timed out after {Ms}ms; status={Status}",
                job.JobId, sw.ElapsedMilliseconds, job.Status);
            return job;
        }
        catch (Exception ex)
        {
            job.Error = ex.Message;
            job.Status = job.ProspectsFound > 0 ? "partial" : "failed";
            job.Stage = job.Status;
            job.CompletedAt = job.Status == "failed" ? DateTime.UtcNow : null;
            job.UpdatedAt = DateTime.UtcNow;
            await _db.SaveAsync(job);
            _log.LogError(ex, "Discovery job {JobId} failed", job.JobId);
            return job;
        }
    }

    static DiscoveryJobRequest ParseRequest(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new DiscoveryJobRequest();
        try
        {
            return JsonSerializer.Deserialize<DiscoveryJobRequest>(json, JsonOpts) ?? new DiscoveryJobRequest();
        }
        catch
        {
            return new DiscoveryJobRequest();
        }
    }

    static DiscoveryJobCheckpoint ParseCheckpoint(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new DiscoveryJobCheckpoint();
        try
        {
            return JsonSerializer.Deserialize<DiscoveryJobCheckpoint>(json, JsonOpts) ?? new DiscoveryJobCheckpoint();
        }
        catch
        {
            return new DiscoveryJobCheckpoint();
        }
    }

    async Task<PartnerOutreachSettingsRow> LoadSettingsFallbackAsync()
    {
        try
        {
            var row = await _db.LoadAsync<PartnerOutreachSettingsRow>("default");
            if (row != null)
            {
                if (row.ProspectsPerRun <= 0) row.ProspectsPerRun = 8;
                if (row.ResearchAttemptsPerRun <= 0) row.ResearchAttemptsPerRun = 15;
                if (row.ResearchContactsPerRun <= 0) row.ResearchContactsPerRun = 10;
                if (row.DraftsPerRun <= 0) row.DraftsPerRun = 5;
                if (string.IsNullOrWhiteSpace(row.OutreachMode)) row.OutreachMode = "off";
                return row;
            }
        }
        catch { /* defaults */ }
        return new PartnerOutreachSettingsRow();
    }
}
