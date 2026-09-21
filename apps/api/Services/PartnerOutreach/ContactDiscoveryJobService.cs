using System.Text.Json;
using Amazon.DynamoDBv2.DataModel;
using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services.PartnerOutreach;

public interface IContactDiscoveryJobService
{
    Task<PartnerDiscoveryJob> StartAsync(ContactDiscoveryJobRequest request, string actor);
    Task<PartnerDiscoveryJob> AdvanceAsync(string jobId);
    Task<PartnerDiscoveryJob?> GetAsync(string jobId);
    Task<PartnerDiscoveryJob?> GetActiveAsync();
    Task<PartnerDiscoveryJob> PauseAsync(string jobId);
    Task<PartnerDiscoveryJob> ResumeAsync(string jobId);
    Task<PartnerDiscoveryJob> RetryFailedAsync(string jobId, string actor);
}

public sealed class ContactDiscoveryJobRequest
{
    public IEnumerable<string>? ProspectIds { get; set; }
    public bool FilterMissingOnly { get; set; } = true;
    public bool Force { get; set; } = true;
    public int? Max { get; set; }
}

public sealed class ContactDiscoveryCheckpoint
{
    public List<string> Queue { get; set; } = new();
    public List<string> FailedIds { get; set; } = new();
    public int Index { get; set; }
    public bool Finished { get; set; }
}

/// <summary>
/// Durable contact-discovery runner. One GET/advance processes a single prospect so
/// progress survives Lambda timeouts, browser refresh, and admin tab switches.
/// </summary>
public sealed class ContactDiscoveryJobService : IContactDiscoveryJobService
{
    public const string JobKind = "contact_discovery";
    static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    readonly IDynamoDBContext _db;
    readonly IPartnerOutreachService _outreach;
    readonly ILogger<ContactDiscoveryJobService> _log;

    public ContactDiscoveryJobService(
        IDynamoDBContext db,
        IPartnerOutreachService outreach,
        ILogger<ContactDiscoveryJobService> log)
    {
        _db = db;
        _outreach = outreach;
        _log = log;
    }

    public async Task<PartnerDiscoveryJob> StartAsync(ContactDiscoveryJobRequest request, string actor)
    {
        request ??= new ContactDiscoveryJobRequest();
        var active = await FindActiveAsync();
        if (active != null)
            return active;

        var candidates = await _outreach.ListContactDiscoveryCandidateIdsAsync(
            request.ProspectIds,
            request.FilterMissingOnly,
            request.Force,
            request.Max);

        var job = new PartnerDiscoveryJob
        {
            JobKind = JobKind,
            Status = candidates.Count == 0 ? "complete" : "running",
            Stage = candidates.Count == 0 ? "complete" : "queued",
            ProgressPct = candidates.Count == 0 ? 100 : 0,
            Actor = actor,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CompletedAt = candidates.Count == 0 ? DateTime.UtcNow : null,
            Total = candidates.Count,
            Processed = 0,
            EmailsFound = 0,
            FormsFound = 0,
            ReviewRequired = 0,
            NoContact = 0,
            Errors = 0,
            RequestJson = JsonSerializer.Serialize(new
            {
                request.FilterMissingOnly,
                request.Force,
                max = request.Max,
                prospectIds = request.ProspectIds,
            }, JsonOpts),
            CheckpointJson = JsonSerializer.Serialize(new ContactDiscoveryCheckpoint
            {
                Queue = candidates,
                Index = 0,
            }, JsonOpts),
            ResearchStagesJson = JsonSerializer.Serialize(ContactDiscoveryStages.Initial(), JsonOpts),
        };

        if (candidates.Count > 0)
        {
            var first = await _db.LoadAsync<PartnerProspect>(candidates[0]);
            job.CurrentProspectId = first?.ProspectId;
            job.CurrentProspectName = first?.OrganizationName;
            job.Stage = "researching";
        }

        await _db.SaveAsync(job);
        await SetActiveJobIdAsync(job.JobId);
        return job;
    }

    public async Task<PartnerDiscoveryJob?> GetAsync(string jobId) =>
        await _db.LoadAsync<PartnerDiscoveryJob>(jobId);

    public async Task<PartnerDiscoveryJob?> GetActiveAsync() => await FindActiveAsync();

    public async Task<PartnerDiscoveryJob> PauseAsync(string jobId)
    {
        var job = await RequireContactJobAsync(jobId);
        if (job.Status is "complete" or "failed")
            return job;
        job.Status = "paused";
        job.Stage = "paused";
        job.UpdatedAt = DateTime.UtcNow;
        await _db.SaveAsync(job);
        return job;
    }

    public async Task<PartnerDiscoveryJob> ResumeAsync(string jobId)
    {
        var job = await RequireContactJobAsync(jobId);
        if (job.Status is "complete" or "failed")
            return job;
        var checkpoint = ParseCheckpoint(job.CheckpointJson);
        if (checkpoint.Finished || checkpoint.Index >= checkpoint.Queue.Count)
        {
            job.Status = "complete";
            job.Stage = "complete";
            job.ProgressPct = 100;
            job.CompletedAt ??= DateTime.UtcNow;
            job.CurrentProspectId = null;
            job.CurrentProspectName = null;
            job.UpdatedAt = DateTime.UtcNow;
            await _db.SaveAsync(job);
            await ClearActiveJobIdIfMatchesAsync(job.JobId);
            return job;
        }

        job.Status = "running";
        job.Stage = "researching";
        job.UpdatedAt = DateTime.UtcNow;
        await PrefillCurrentAsync(job, checkpoint);
        await _db.SaveAsync(job);
        await SetActiveJobIdAsync(job.JobId);
        return job;
    }

    public async Task<PartnerDiscoveryJob> RetryFailedAsync(string jobId, string actor)
    {
        var job = await RequireContactJobAsync(jobId);
        var checkpoint = ParseCheckpoint(job.CheckpointJson);
        if (checkpoint.FailedIds.Count == 0)
            return job;

        var retryQueue = checkpoint.FailedIds.Distinct(StringComparer.Ordinal).ToList();
        checkpoint.Queue = retryQueue;
        checkpoint.FailedIds = new List<string>();
        checkpoint.Index = 0;
        checkpoint.Finished = false;

        job.Status = "running";
        job.Stage = "researching";
        job.Total = retryQueue.Count;
        job.Processed = 0;
        job.EmailsFound = 0;
        job.FormsFound = 0;
        job.ReviewRequired = 0;
        job.NoContact = 0;
        job.Errors = 0;
        job.ProgressPct = 0;
        job.CompletedAt = null;
        job.Error = null;
        job.Actor = actor;
        job.CheckpointJson = JsonSerializer.Serialize(checkpoint, JsonOpts);
        job.ResearchStagesJson = JsonSerializer.Serialize(ContactDiscoveryStages.Initial(), JsonOpts);
        job.UpdatedAt = DateTime.UtcNow;
        await PrefillCurrentAsync(job, checkpoint);
        await _db.SaveAsync(job);
        await SetActiveJobIdAsync(job.JobId);
        return job;
    }

    public async Task<PartnerDiscoveryJob> AdvanceAsync(string jobId)
    {
        var job = await RequireContactJobAsync(jobId);
        if (job.Status is "complete" or "failed" or "paused")
            return job;

        var checkpoint = ParseCheckpoint(job.CheckpointJson);
        if (checkpoint.Finished || checkpoint.Index >= checkpoint.Queue.Count)
            return await CompleteAsync(job, checkpoint);

        var prospectId = checkpoint.Queue[checkpoint.Index];
        PartnerProspect? prospect = null;
        try
        {
            prospect = await _db.LoadAsync<PartnerProspect>(prospectId);
        }
        catch (Exception ex)
        {
            _log.LogDebug(ex, "Failed loading prospect {Id} for contact job", prospectId);
        }

        job.Status = "running";
        job.Stage = "researching";
        job.CurrentProspectId = prospectId;
        job.CurrentProspectName = prospect?.OrganizationName ?? prospectId;
        job.ResearchStagesJson = JsonSerializer.Serialize(ContactDiscoveryStages.Initial(), JsonOpts);
        job.UpdatedAt = DateTime.UtcNow;
        await _db.SaveAsync(job);

        var force = ParseForce(job.RequestJson);
        ContactDiscoveryResult? result = null;
        try
        {
            result = await _outreach.DiscoverContactForJobAsync(prospectId, job.Actor ?? "admin", force);
            ApplyResultCounters(job, result);
            if (result.Ok == false && !string.IsNullOrWhiteSpace(result.Error) && !result.Skipped)
                checkpoint.FailedIds.Add(prospectId);
        }
        catch (Exception ex)
        {
            job.Errors++;
            checkpoint.FailedIds.Add(prospectId);
            job.Error = ex.Message;
            _log.LogWarning(ex, "Contact discovery job step failed for {Id}", prospectId);
            result = new ContactDiscoveryResult
            {
                Ok = false,
                ProspectId = prospectId,
                OrganizationName = job.CurrentProspectName ?? prospectId,
                Error = ex.Message,
                Message = ex.Message,
            };
        }

        checkpoint.Index++;
        job.Processed = checkpoint.Index;
        job.ProgressPct = job.Total <= 0
            ? 100
            : (int)Math.Clamp(Math.Round(100.0 * job.Processed / job.Total), 0, 100);
        job.ResearchStagesJson = JsonSerializer.Serialize(
            ContactDiscoveryStages.FromPages(result?.PagesChecked), JsonOpts);
        job.ReportJson = AppendLastResult(job.ReportJson, result);
        job.UpdatedAt = DateTime.UtcNow;

        if (checkpoint.Index >= checkpoint.Queue.Count)
            return await CompleteAsync(job, checkpoint);

        await PrefillCurrentAsync(job, checkpoint);
        job.CheckpointJson = JsonSerializer.Serialize(checkpoint, JsonOpts);
        await _db.SaveAsync(job);
        return job;
    }

    async Task<PartnerDiscoveryJob> CompleteAsync(PartnerDiscoveryJob job, ContactDiscoveryCheckpoint checkpoint)
    {
        checkpoint.Finished = true;
        job.CheckpointJson = JsonSerializer.Serialize(checkpoint, JsonOpts);
        job.Status = job.Errors > 0 && job.Processed > 0 ? "partial" : "complete";
        job.Stage = job.Status;
        job.ProgressPct = 100;
        job.CompletedAt ??= DateTime.UtcNow;
        job.CurrentProspectId = null;
        job.CurrentProspectName = null;
        job.UpdatedAt = DateTime.UtcNow;
        await _db.SaveAsync(job);
        await ClearActiveJobIdIfMatchesAsync(job.JobId);
        return job;
    }

    static void ApplyResultCounters(PartnerDiscoveryJob job, ContactDiscoveryResult result)
    {
        if (result.Found && result.Status == ContactDiscoveryRules.DiscoveryEmailFound)
            job.EmailsFound++;
        else if (result.Status == ContactDiscoveryRules.DiscoveryReviewRequired)
            job.ReviewRequired++;
        else if (result.Status == ContactDiscoveryRules.DiscoveryContactFormFound)
            job.FormsFound++;
        else if (result.Status == ContactDiscoveryRules.DiscoveryNoPublicContact)
            job.NoContact++;
        else if (result.Ok == false && !result.Skipped)
            job.Errors++;
        else if (!result.Found && !result.Skipped)
            job.NoContact++;
    }

    static string AppendLastResult(string? reportJson, ContactDiscoveryResult? result)
    {
        if (result == null) return reportJson ?? "";
        var payload = new
        {
            last = new
            {
                result.ProspectId,
                result.OrganizationName,
                result.Status,
                result.FoundEmail,
                result.ContactFormUrl,
                result.Confidence,
                result.Error,
                result.Message,
                result.PagesChecked,
            },
        };
        return JsonSerializer.Serialize(payload, JsonOpts);
    }

    async Task PrefillCurrentAsync(PartnerDiscoveryJob job, ContactDiscoveryCheckpoint checkpoint)
    {
        if (checkpoint.Index >= checkpoint.Queue.Count)
        {
            job.CurrentProspectId = null;
            job.CurrentProspectName = null;
            return;
        }

        var nextId = checkpoint.Queue[checkpoint.Index];
        job.CurrentProspectId = nextId;
        try
        {
            var next = await _db.LoadAsync<PartnerProspect>(nextId);
            job.CurrentProspectName = next?.OrganizationName ?? nextId;
        }
        catch
        {
            job.CurrentProspectName = nextId;
        }
        job.ResearchStagesJson = JsonSerializer.Serialize(ContactDiscoveryStages.Initial(), JsonOpts);
    }

    async Task<PartnerDiscoveryJob> RequireContactJobAsync(string jobId)
    {
        var job = await _db.LoadAsync<PartnerDiscoveryJob>(jobId)
            ?? throw new KeyNotFoundException("Contact discovery job not found");
        if (!string.IsNullOrWhiteSpace(job.JobKind) && job.JobKind != JobKind)
            throw new InvalidOperationException("Not a contact discovery job");
        return job;
    }

    async Task<PartnerDiscoveryJob?> FindActiveAsync()
    {
        try
        {
            var settings = await _db.LoadAsync<PartnerOutreachSettingsRow>("default");
            var activeId = settings?.ActiveContactDiscoveryJobId;
            if (!string.IsNullOrWhiteSpace(activeId))
            {
                var job = await _db.LoadAsync<PartnerDiscoveryJob>(activeId);
                if (job != null && job.JobKind == JobKind && job.Status is "running" or "paused" or "starting" or "queued")
                    return job;
            }
        }
        catch (Exception ex)
        {
            _log.LogDebug(ex, "Active contact discovery job lookup failed");
        }
        return null;
    }

    async Task SetActiveJobIdAsync(string jobId)
    {
        try
        {
            var settings = await _db.LoadAsync<PartnerOutreachSettingsRow>("default")
                ?? new PartnerOutreachSettingsRow();
            settings.ActiveContactDiscoveryJobId = jobId;
            await _db.SaveAsync(settings);
        }
        catch (Exception ex)
        {
            _log.LogDebug(ex, "Could not persist active contact discovery job id");
        }
    }

    async Task ClearActiveJobIdIfMatchesAsync(string jobId)
    {
        try
        {
            var settings = await _db.LoadAsync<PartnerOutreachSettingsRow>("default");
            if (settings == null) return;
            if (!string.Equals(settings.ActiveContactDiscoveryJobId, jobId, StringComparison.Ordinal))
                return;
            settings.ActiveContactDiscoveryJobId = null;
            await _db.SaveAsync(settings);
        }
        catch (Exception ex)
        {
            _log.LogDebug(ex, "Could not clear active contact discovery job id");
        }
    }

    static ContactDiscoveryCheckpoint ParseCheckpoint(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new ContactDiscoveryCheckpoint();
        try
        {
            return JsonSerializer.Deserialize<ContactDiscoveryCheckpoint>(json, JsonOpts)
                ?? new ContactDiscoveryCheckpoint();
        }
        catch
        {
            return new ContactDiscoveryCheckpoint();
        }
    }

    static bool ParseForce(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return true;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("force", out var force))
                return force.ValueKind != JsonValueKind.False;
        }
        catch
        {
            // default force
        }
        return true;
    }
}

/// <summary>Checklist stages shown while researching a single prospect.</summary>
public static class ContactDiscoveryStages
{
    public static List<object> Initial() => new()
    {
        new { key = "website", label = "Official website", state = "active" },
        new { key = "contact", label = "Contact page", state = "pending" },
        new { key = "about", label = "About / staff pages", state = "pending" },
        new { key = "listings", label = "Public business listings", state = "pending" },
        new { key = "social", label = "Social profile links", state = "pending" },
    };

    public static List<object> FromPages(IReadOnlyList<string>? pages)
    {
        var list = pages ?? Array.Empty<string>();
        var hasHome = list.Any(p => IsPath(p, "/") || IsPath(p, ""));
        var hasContact = list.Any(p => PathContains(p, "contact"));
        var hasAbout = list.Any(p => PathContains(p, "about") || PathContains(p, "team")
            || PathContains(p, "staff") || PathContains(p, "coach"));
        var hasSocial = list.Any(p =>
            p.Contains("facebook.", StringComparison.OrdinalIgnoreCase)
            || p.Contains("instagram.", StringComparison.OrdinalIgnoreCase)
            || p.Contains("linkedin.", StringComparison.OrdinalIgnoreCase));
        var hasListings = list.Count > 3 || list.Any(p =>
            PathContains(p, "location") || PathContains(p, "membership"));

        string State(bool done, bool active) => done ? "done" : active ? "active" : "pending";

        return new List<object>
        {
            new { key = "website", label = "Official website", state = State(hasHome || list.Count > 0, list.Count == 0) },
            new { key = "contact", label = "Contact page", state = State(hasContact, hasHome && !hasContact) },
            new { key = "about", label = "About / staff pages", state = State(hasAbout, hasContact && !hasAbout) },
            new { key = "listings", label = "Public business listings", state = State(hasListings, hasAbout && !hasListings) },
            new { key = "social", label = "Social profile links", state = State(hasSocial, hasListings && !hasSocial) },
        };
    }

    static bool IsPath(string url, string path)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) return false;
        var p = uri.AbsolutePath.TrimEnd('/');
        if (string.IsNullOrEmpty(p)) p = "/";
        return string.Equals(p, path == "" ? "/" : path, StringComparison.OrdinalIgnoreCase);
    }

    static bool PathContains(string url, string fragment)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
            return url.Contains(fragment, StringComparison.OrdinalIgnoreCase);
        return uri.AbsolutePath.Contains(fragment, StringComparison.OrdinalIgnoreCase);
    }
}
