using Amazon.DynamoDBv2.DataModel;
using GetTrainMate.Api.Models;
using Microsoft.Extensions.Configuration;

namespace GetTrainMate.Api.Services.PartnerOutreach;

public interface IPartnerOutreachService
{
    Task<PartnerProspect> CreateProspectAsync(PartnerProspect prospect, string actor);
    Task<List<PartnerProspect>> ListProspectsAsync(string? status);
    Task<PartnerProspect> UpdateProspectAsync(string id, PartnerProspect patch);
    Task<PartnerQueueItem> CreateDraftAndQueuePreviewAsync(string prospectId, string campaignId);
    Task<PartnerApproval> ApproveAsync(string queueId, string approver, bool confirm);
    Task<PartnerQueueItem?> GetQueueAsync(string queueId);
    Task<List<PartnerQueueItem>> ListQueueAsync(string? status);
    Task<object> DispatchDueAsync(bool scheduledCursorAutomation);
    Task<object> SendCrmReplyAsync(string threadId, string bodyText, string actor, bool confirmSend);
    Task<object> IngestInboundAsync(string rawMime, string dedupeKey);
    Task ApplySesEventAsync(string internalMessageId, string eventType);
    Task UnsubscribeAsync(string recipientId);
    Task<object> MetricsAsync();
    Task<PartnerThread?> GetThreadAsync(string threadId);
    Task<List<PartnerMessage>> ListMessagesAsync(string threadId);
    Task<List<PartnerCampaign>> ListCampaignsAsync();
    Task<PartnerCampaign> SetCampaignStatusAsync(string campaignId, string status);
    Task<object> DiscoverAsync(string? country, string? market, string? language, string? mode);
    Task<object> DedupeAsync(bool dryRun = false);

    Task<object> AcquisitionDashboardAsync();
    Task<object> BulkApproveAsync(IEnumerable<string> queueIds, string actor, bool confirm);
    Task<object> RejectQueueAsync(string queueId, string actor, string? reason);
    Task<PartnerQueueItem> UpdateQueueDraftAsync(string queueId, string subject, string bodyText, string? bodyHtml, string actor);
    Task<object> GetOutreachSettingsAsync();
    Task<object> UpdateOutreachSettingsAsync(PartnerOutreachSettingsRow patch);
    Task<List<PartnerThread>> ListThreadsAsync();
    Task<object> ConvertToPartnerAsync(string prospectId, string actor);
    Task<object> MarkInterestedAsync(string prospectId, string actor);
    Task<object> ApproveAndSendAsync(string queueId, string actor, bool confirm);
    Task<object> SendQueueItemByIdAsync(string queueId);
    Task<object> ResearchContactAsync(string prospectId, string actor, bool force = false);
    Task<object> ResearchContactsBulkAsync(IEnumerable<string> prospectIds, string actor, int max = 20);
    Task<object> ResearchContactNeededBatchAsync(int max, string actor);
    /// <summary>
    /// Increment attribution counters on a prospect matched by PartnerCode.
    /// eventType: signup | activated | paid
    /// Active user = Discover started (discover_started) after partner referral signup.
    /// </summary>
    Task<object> RecordPartnerAttributionAsync(string partnerOrRefCode, string eventType, long? revenueCents = null);
}

public sealed class PartnerOutreachService : IPartnerOutreachService
{
    private readonly IDynamoDBContext _db;
    private readonly IEmailService _email;
    private readonly IConfiguration _cfg;
    private readonly ILogger<PartnerOutreachService> _log;
    private readonly IAuditLogService? _audit;
    private readonly PublicBusinessContactVerifier _contactVerifier;

    public PartnerOutreachService(
        IDynamoDBContext db,
        IEmailService email,
        IConfiguration cfg,
        ILogger<PartnerOutreachService> log,
        PublicBusinessContactVerifier contactVerifier,
        IAuditLogService? audit = null)
    {
        _db = db;
        _email = email;
        _cfg = cfg;
        _log = log;
        _contactVerifier = contactVerifier;
        _audit = audit;
    }

    bool SendEnabled => string.Equals(Env("PARTNER_OUTREACH_SEND_ENABLED"), "true", StringComparison.OrdinalIgnoreCase);
    string FromEmail => First(Env("PARTNER_FROM_EMAIL"), PartnerOutreachRules.PartnerFromEmail);
    string ReplyTo => First(Env("PARTNER_REPLY_TO_EMAIL"), PartnerOutreachRules.PartnerFromEmail);
    string Postal => Env("GETTRAINMATE_BUSINESS_POSTAL_ADDRESS");
    string Frontend => First(Env("FRONTEND_URL"), _cfg["Frontend:BaseUrl"], "https://gettrainmate.com").TrimEnd('/');
    string UnsubSecret => First(Env("PARTNER_UNSUBSCRIBE_SIGNING_SECRET"), Env("GETTRAINMATE_UNSUBSCRIBE_SECRET"));
    int DailyLimit => int.TryParse(Env("PARTNER_DAILY_SEND_LIMIT"), out var n) && n > 0 ? n : PartnerOutreachRules.DefaultDailyLimit;

    static string Env(string name) => Environment.GetEnvironmentVariable(name)?.Trim() ?? "";
    static string First(params string?[] xs)
    {
        foreach (var x in xs)
            if (!string.IsNullOrWhiteSpace(x)) return x.Trim();
        return "";
    }

    public async Task<PartnerProspect> CreateProspectAsync(PartnerProspect prospect, string actor)
    {
        prospect.Country = MarketCampaignCatalog.Slug(prospect.Country);
        prospect.City = (prospect.City ?? "").Trim();
        prospect.Metro = string.IsNullOrWhiteSpace(prospect.Metro) ? prospect.City : prospect.Metro.Trim();
        if (string.IsNullOrWhiteSpace(prospect.Country) || string.IsNullOrWhiteSpace(prospect.Metro))
            throw new InvalidOperationException("Country and city/metro are required. Non-Atlanta markets are valid.");
        prospect.Mode = string.IsNullOrWhiteSpace(prospect.Mode) ? "TRAIN" : prospect.Mode.Trim().ToUpperInvariant();
        prospect.CampaignLanguage = string.IsNullOrWhiteSpace(prospect.CampaignLanguage) ? "en" : prospect.CampaignLanguage.Trim().ToLowerInvariant();
        prospect.PrimaryLanguage = string.IsNullOrWhiteSpace(prospect.PrimaryLanguage) ? prospect.CampaignLanguage : prospect.PrimaryLanguage.Trim().ToLowerInvariant();
        prospect.CampaignId = string.IsNullOrWhiteSpace(prospect.CampaignId)
            ? MarketCampaignCatalog.CampaignId(prospect.Country, prospect.Metro, prospect.Mode)
            : prospect.CampaignId.Trim();
        if (string.IsNullOrWhiteSpace(prospect.LandingUrl) && !string.IsNullOrWhiteSpace(prospect.PartnerCode))
            prospect.LandingUrl = "https://gettrainmate.com" + MarketCampaignCatalog.PartnerPath(prospect.Country, prospect.Metro, prospect.PartnerCode);
        if (string.IsNullOrWhiteSpace(prospect.ProspectType))
            prospect.ProspectType = "organization";

        var email = (prospect.Email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email))
        {
            prospect.Email = "";
            if (string.Equals(prospect.EmailVerificationStatus, "no_verified_public_email", StringComparison.OrdinalIgnoreCase))
                prospect.Status = "no_verified_public_email";
            else if (string.IsNullOrWhiteSpace(prospect.Status) || prospect.Status == "prospect")
                prospect.Status = "discovered";
        }
        else
        {
            if (!email.Contains('@'))
                throw new InvalidOperationException("Public business email is required; never guess addresses.");
            var allowed = new[] { "public_listing", "owner_supplied", "prior_engagement" };
            if (!allowed.Contains(prospect.EmailSource))
                throw new InvalidOperationException("Email source must be public_listing, owner_supplied, or prior_engagement.");
            if (prospect.EmailSource == "public_listing" && string.IsNullOrWhiteSpace(prospect.SourceUrl))
                throw new InvalidOperationException("Source URL is required when the email comes from a public listing.");
            prospect.Email = email;
            prospect.Status = string.IsNullOrWhiteSpace(prospect.Status) || prospect.Status == "discovered"
                ? "prospect"
                : prospect.Status;
            if (string.IsNullOrWhiteSpace(prospect.EmailVerifiedOn))
                prospect.EmailVerifiedOn = DateTime.UtcNow.ToString("yyyy-MM-dd");
            prospect.EmailVerificationStatus ??= "verified_public";
            try { prospect.OfficialDomain = new Uri("mailto:" + email).ToString().Contains('@') ? email.Split('@')[1] : prospect.OfficialDomain; }
            catch { /* keep provided domain */ }
            if (string.IsNullOrWhiteSpace(prospect.OfficialDomain) && email.Contains('@'))
                prospect.OfficialDomain = email.Split('@')[1];
        }
        var existingProspects = await ListProspectsAsync(null);
        var duplicate = existingProspects.FirstOrDefault(p => PartnerOutreachDedupe.MatchesProspect(p, prospect));
        if (duplicate != null)
        {
            _log.LogDebug("Prospect dedupe: returning existing {Id} for {Org}", duplicate.ProspectId, prospect.OrganizationName);
            PartnerCrmLifecycle.ApplyLegacyNormalization(duplicate);
            return duplicate;
        }

        prospect.CreatedAt = DateTime.UtcNow;
        prospect.FirstDiscoveredAt ??= prospect.CreatedAt;
        if (prospect.DiscoveryCount <= 0) prospect.DiscoveryCount = 1;
        prospect.Owner = string.IsNullOrWhiteSpace(prospect.Owner) ? actor : prospect.Owner;
        if (string.IsNullOrWhiteSpace(prospect.ProspectKind))
            prospect.ProspectKind = PartnerCrmLifecycle.NormalizeProspectKind(prospect.OrganizationType);
        var hasEmailNow = !string.IsNullOrWhiteSpace(prospect.Email) && prospect.Email.Contains('@');
        if (string.IsNullOrWhiteSpace(prospect.ContactabilityState))
            prospect.ContactabilityState = hasEmailNow
                ? PartnerCrmLifecycle.ContactFound
                : PartnerCrmLifecycle.ContactNeeded;
        // Acquisition scoring does not require email
        if (prospect.AcquisitionScore <= 0 && !string.IsNullOrWhiteSpace(prospect.OrganizationType))
        {
            var scored = AutomatedMarketDiscoveryService.ScoreProspect(new DiscoveredOrganization
            {
                OrganizationName = prospect.OrganizationName,
                OrganizationType = prospect.OrganizationType,
                DiscoverySource = prospect.DiscoverySource ?? "",
                Market = prospect.Metro ?? prospect.City ?? "",
            }, hasEmailNow);
            prospect.AcquisitionScore = scored.AcquisitionScore;
            prospect.AudienceFitScore = scored.AudienceFitScore;
            prospect.MarketRelevanceScore = scored.MarketRelevanceScore;
            prospect.CommunityFitScore = scored.CommunityFitScore;
            prospect.ContactQualityScore = scored.ContactQualityScore;
            prospect.ContactabilityScore = scored.ContactQualityScore;
            prospect.HistoricalCategoryScore = scored.HistoricalCategoryScore;
            prospect.ScoreExplanation = scored.ScoreExplanation;
            prospect.FitScore = scored.AcquisitionScore;
        }
        else if (hasEmailNow && prospect.ContactabilityScore <= 0)
        {
            prospect.ContactabilityScore = Math.Max(prospect.ContactQualityScore, 90);
        }
        PartnerCrmLifecycle.ApplyLegacyNormalization(prospect);
        await _db.SaveAsync(prospect);
        return prospect;
    }

    public async Task<List<PartnerProspect>> ListProspectsAsync(string? status)
    {
        var all = await _db.ScanAsync<PartnerProspect>(new List<ScanCondition>()).GetRemainingAsync();
        if (!string.IsNullOrWhiteSpace(status))
            all = all.Where(p => string.Equals(p.Status, status, StringComparison.OrdinalIgnoreCase)).ToList();
        PartnerCrmLifecycle.ApplyToList(all);
        return all.OrderByDescending(p => p.CreatedAt).ToList();
    }

    public async Task<PartnerProspect> UpdateProspectAsync(string id, PartnerProspect patch)
    {
        var existing = await _db.LoadAsync<PartnerProspect>(id) ?? throw new KeyNotFoundException("Prospect not found");
        if (!string.IsNullOrWhiteSpace(patch.OrganizationName)) existing.OrganizationName = patch.OrganizationName;
        if (!string.IsNullOrWhiteSpace(patch.Notes)) existing.Notes = patch.Notes;
        if (!string.IsNullOrWhiteSpace(patch.Status)) existing.Status = patch.Status;
        if (!string.IsNullOrWhiteSpace(patch.PartnerCode)) existing.PartnerCode = patch.PartnerCode;
        if (!string.IsNullOrWhiteSpace(patch.LandingUrl)) existing.LandingUrl = patch.LandingUrl;
        if (!string.IsNullOrWhiteSpace(patch.CrmLifecycle)) existing.CrmLifecycle = patch.CrmLifecycle;
        if (!string.IsNullOrWhiteSpace(patch.ContactState)) existing.ContactState = patch.ContactState;
        if (!string.IsNullOrWhiteSpace(patch.EmailState)) existing.EmailState = patch.EmailState;
        if (!string.IsNullOrWhiteSpace(patch.Phone)) existing.Phone = patch.Phone;
        if (!string.IsNullOrWhiteSpace(patch.ContactRole)) existing.ContactRole = patch.ContactRole;
        if (!string.IsNullOrWhiteSpace(patch.FacebookUrl)) existing.FacebookUrl = patch.FacebookUrl;
        if (!string.IsNullOrWhiteSpace(patch.InstagramUrl)) existing.InstagramUrl = patch.InstagramUrl;
        if (!string.IsNullOrWhiteSpace(patch.LinkedInUrl)) existing.LinkedInUrl = patch.LinkedInUrl;
        PartnerCrmLifecycle.ApplyLegacyNormalization(existing);
        await _db.SaveAsync(existing);
        return existing;
    }

    public async Task<PartnerQueueItem> CreateDraftAndQueuePreviewAsync(string prospectId, string campaignId)
    {
        var p = await _db.LoadAsync<PartnerProspect>(prospectId) ?? throw new KeyNotFoundException("Prospect not found");
        if (string.IsNullOrWhiteSpace(p.Email) || !p.Email.Contains('@'))
            throw new InvalidOperationException("No verified public business email on an organization-controlled page. Status: no_verified_public_email. Never infer addresses.");
        if (!MarketCampaignCatalog.IsApprovedOutreachLanguage(p.CampaignLanguage))
            throw new InvalidOperationException("No approved human-reviewed template for this language. Prospect is prepared but email is not queued.");
        if (string.IsNullOrWhiteSpace(campaignId) || campaignId == "atlanta-default")
            campaignId = string.IsNullOrWhiteSpace(p.CampaignId)
                ? MarketCampaignCatalog.CampaignId(p.Country, p.Metro, p.Mode)
                : p.CampaignId;
        var campaign = await _db.LoadAsync<PartnerCampaign>(campaignId);
        if (campaign == null)
        {
            campaign = new PartnerCampaign
            {
                CampaignId = campaignId,
                Name = string.IsNullOrWhiteSpace(p.Metro) ? campaignId : $"{p.Metro} partners",
                Status = "draft",
                Country = p.Country,
                Market = MarketCampaignCatalog.Slug(p.Metro),
                DisplayName = p.Metro,
                PrimaryMode = p.Mode,
                Timezone = p.Timezone ?? "",
                Languages = new List<string> { p.CampaignLanguage },
                FollowUpDays = new List<int> { 4, 9 },
                MaxFollowUps = 2,
            };
            await _db.SaveAsync(campaign);
        }
        if (string.IsNullOrWhiteSpace(p.LandingUrl) || string.IsNullOrWhiteSpace(p.PartnerCode))
            throw new InvalidOperationException("Partner landing URL and code are required.");

        var existingQueue = (await ListQueueAsync(null))
            .Where(q => q.FollowUpNumber == 0
                && q.Status is "draft" or "approved" or "queued"
                && (string.Equals(q.ProspectId, p.ProspectId, StringComparison.Ordinal)
                    || (string.Equals(q.Recipient, p.Email, StringComparison.OrdinalIgnoreCase)
                        && string.Equals(q.CampaignId, campaignId, StringComparison.OrdinalIgnoreCase))))
            .OrderByDescending(q => PartnerOutreachDedupe.QueueRank(q.Status))
            .ThenByDescending(q => q.CreatedAt)
            .FirstOrDefault();
        if (existingQueue != null)
        {
            _log.LogDebug("Queue dedupe: returning existing {Id} for {Org}", existingQueue.QueueId, p.OrganizationName);
            if (p.Status != "draft" && existingQueue.Status is "draft" or "approved" or "queued")
            {
                p.Status = existingQueue.Status == "approved" ? "approved" : "draft";
                p.CrmLifecycle = PartnerCrmLifecycle.Qualified;
                p.EmailState = existingQueue.Status == "approved" ? "APPROVED" : "AWAITING_APPROVAL";
                await _db.SaveAsync(p);
            }
            return existingQueue;
        }

        var unsub = BuildUnsubUrl(p.ProspectId);
        var marketLabel = string.IsNullOrWhiteSpace(p.Metro) ? p.City : p.Metro;
        var landingWithUtm = PartnerEmailMime.AppendPartnerUtm(p.LandingUrl!, campaignId, p.PartnerCode);
        var copy = PartnerEmailMime.RenderForProspect(p, landingWithUtm, unsub, Postal, marketLabel);
        var fp = PartnerOutreachRules.Fingerprint(p.Email, copy.Subject, copy.Text, landingWithUtm, campaignId);
        var item = new PartnerQueueItem
        {
            ProspectId = p.ProspectId,
            CampaignId = campaignId,
            Recipient = p.Email,
            OrganizationName = p.OrganizationName,
            Subject = copy.Subject,
            BodyText = copy.Text,
            BodyHtml = copy.Html,
            PartnerUrl = landingWithUtm,
            Fingerprint = fp,
            Status = "draft",
            MessageVersion = 1,
            FollowUpNumber = 0,
        };
        await _db.SaveAsync(item);
        p.Status = "draft";
        p.CrmLifecycle = PartnerCrmLifecycle.Qualified;
        p.ContactState = PartnerCrmLifecycle.ContactFound;
        p.EmailState = "AWAITING_APPROVAL";
        await _db.SaveAsync(p);
        return item;
    }

    public async Task<PartnerApproval> ApproveAsync(string queueId, string approver, bool confirm)
    {
        if (!confirm) throw new InvalidOperationException("Explicit confirmation is required.");
        var item = await _db.LoadAsync<PartnerQueueItem>(queueId) ?? throw new KeyNotFoundException("Queue item not found");
        if (item.Status == "rejected")
            throw new InvalidOperationException("Cannot approve a rejected queue item.");
        var current = PartnerOutreachRules.Fingerprint(item.Recipient, item.Subject, item.BodyText, item.PartnerUrl, item.CampaignId);
        if (PartnerOutreachRules.ApprovalInvalidated(item.Fingerprint, current))
            throw new InvalidOperationException("Content changed; recreate the draft.");
        var approval = new PartnerApproval
        {
            CampaignId = item.CampaignId,
            ProspectId = item.ProspectId,
            Recipient = item.Recipient,
            Subject = item.Subject,
            BodyText = item.BodyText,
            PartnerUrl = item.PartnerUrl,
            Fingerprint = current,
            TemplateVersion = PartnerOutreachRules.TemplateVersion,
            Approver = approver,
            ApprovedAt = DateTime.UtcNow
        };
        await _db.SaveAsync(approval);
        item.ApprovalId = approval.ApprovalId;
        item.Status = "approved";
        item.ApprovedBy = approver;
        item.ApprovedAt = DateTime.UtcNow;
        item.Fingerprint = current;
        await _db.SaveAsync(item);
        var p = await _db.LoadAsync<PartnerProspect>(item.ProspectId);
        if (p != null)
        {
            p.Status = "approved";
            p.CrmLifecycle = PartnerCrmLifecycle.Qualified;
            p.EmailState = "APPROVED";
            await _db.SaveAsync(p);
        }
        await TryAuditAsync(approver, "partner_outreach.approve", "partner_queue", queueId, null, new { approval.ApprovalId });
        return approval;
    }

    public async Task<object> BulkApproveAsync(IEnumerable<string> queueIds, string actor, bool confirm)
    {
        if (!confirm) throw new InvalidOperationException("Explicit confirmation is required.");
        var approved = new List<string>();
        var errors = new List<object>();
        foreach (var id in queueIds.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.Ordinal))
        {
            try
            {
                await ApproveAsync(id, actor, confirm: true);
                approved.Add(id);
            }
            catch (Exception ex)
            {
                errors.Add(new { queueId = id, error = ex.Message });
            }
        }
        return new { approved, errors, count = approved.Count };
    }

    public async Task<object> RejectQueueAsync(string queueId, string actor, string? reason)
    {
        var item = await _db.LoadAsync<PartnerQueueItem>(queueId) ?? throw new KeyNotFoundException("Queue item not found");
        if (item.Status is "sent" or "delivered" or "replied")
            throw new InvalidOperationException("Cannot reject an already-sent item.");
        item.Status = "rejected";
        item.RejectedAt = DateTime.UtcNow;
        item.RejectedBy = actor;
        item.RejectReason = reason ?? "";
        item.ApprovalId = "";
        await _db.SaveAsync(item);
        var p = await _db.LoadAsync<PartnerProspect>(item.ProspectId);
        if (p != null && item.FollowUpNumber == 0)
        {
            p.EmailState = "FAILED";
            await _db.SaveAsync(p);
        }
        await TryAuditAsync(actor, "partner_outreach.reject", "partner_queue", queueId, null, new { reason });
        return new { item.QueueId, item.Status, item.RejectReason };
    }

    public async Task<PartnerQueueItem> UpdateQueueDraftAsync(string queueId, string subject, string bodyText, string? bodyHtml, string actor)
    {
        var item = await _db.LoadAsync<PartnerQueueItem>(queueId) ?? throw new KeyNotFoundException("Queue item not found");
        if (item.Status is "sent" or "delivered" or "replied" or "queued")
            throw new InvalidOperationException("Cannot edit a sent or queued item.");
        var wasApproved = !string.IsNullOrWhiteSpace(item.ApprovalId) || item.Status == "approved";
        item.Subject = subject?.Trim() ?? "";
        item.BodyText = bodyText ?? "";
        if (bodyHtml != null) item.BodyHtml = bodyHtml;
        item.MessageVersion = Math.Max(1, item.MessageVersion) + 1;
        item.ApprovalId = "";
        item.ApprovedAt = null;
        item.ApprovedBy = null;
        item.Status = "draft";
        item.Fingerprint = PartnerOutreachRules.Fingerprint(item.Recipient, item.Subject, item.BodyText, item.PartnerUrl, item.CampaignId);
        await _db.SaveAsync(item);
        var p = await _db.LoadAsync<PartnerProspect>(item.ProspectId);
        if (p != null)
        {
            p.Status = "draft";
            p.CrmLifecycle = PartnerCrmLifecycle.Qualified;
            p.EmailState = "AWAITING_APPROVAL";
            await _db.SaveAsync(p);
        }
        if (wasApproved)
            await TryAuditAsync(actor, "partner_outreach.draft_invalidated", "partner_queue", queueId, null, new { item.MessageVersion });
        return item;
    }

    public async Task<object> ApproveAndSendAsync(string queueId, string actor, bool confirm)
    {
        var approval = await ApproveAsync(queueId, actor, confirm);
        object? sendResult = null;
        string? sendError = null;
        if (SendEnabled)
        {
            try
            {
                sendResult = await SendQueueItemByIdAsync(queueId);
            }
            catch (Exception ex)
            {
                sendError = ex.Message;
            }
        }
        else
        {
            sendError = "send_disabled";
        }
        return new { approval, sendResult, sendError, sendEnabled = SendEnabled };
    }

    public async Task<object> SendQueueItemByIdAsync(string queueId)
    {
        if (!SendEnabled) throw new InvalidOperationException("send_disabled");
        var item = await _db.LoadAsync<PartnerQueueItem>(queueId) ?? throw new KeyNotFoundException("Queue item not found");
        var settings = await LoadSettingsAsync();
        var gate = await BuildGateAsync(item, settings, scheduled: false);
        var code = PartnerOutreachRules.EvaluateSendGate(gate);
        if (code != null) throw new InvalidOperationException(code);
        await SendQueueItemAsync(item);
        settings.SentCount++;
        await _db.SaveAsync(settings);
        return new { item.QueueId, item.Status, item.SesMessageId, item.SentAt };
    }

    public async Task<PartnerQueueItem?> GetQueueAsync(string queueId) =>
        await _db.LoadAsync<PartnerQueueItem>(queueId);

    public async Task<List<PartnerQueueItem>> ListQueueAsync(string? status)
    {
        var all = await _db.ScanAsync<PartnerQueueItem>(new List<ScanCondition>()).GetRemainingAsync();
        if (!string.IsNullOrWhiteSpace(status))
            all = all.Where(x => string.Equals(x.Status, status, StringComparison.OrdinalIgnoreCase)).ToList();
        return all.OrderByDescending(x => x.CreatedAt).ToList();
    }

    public async Task<object> DispatchDueAsync(bool scheduledCursorAutomation)
    {
        if (scheduledCursorAutomation)
            return new { sent = 0, error = "scheduled_automation_blocked" };
        if (!SendEnabled)
            return new { sent = 0, error = "send_disabled" };

        var settings = await LoadSettingsAsync();
        if (settings.PauseAllOutreach)
            return new { sent = 0, error = "pause_all_outreach" };
        if (string.Equals(settings.OutreachMode, "off", StringComparison.OrdinalIgnoreCase))
            return new { sent = 0, error = "outreach_mode_off" };

        var tz = PartnerOutreachRules.EasternTimeZone();
        var now = DateTime.UtcNow;
        if (!PartnerOutreachRules.IsDispatchWindow(now, tz))
            return new { sent = 0, error = "outside_dispatch_window" };

        var allQueue = await ListQueueAsync(null);
        var due = allQueue
            .Where(x =>
                x.Status == "approved"
                || (x.Status == "scheduled"
                    && x.FollowUpNumber > 0
                    && x.AllowAutomatedFollowUp
                    && (x.ScheduledAt == null || x.ScheduledAt <= now)))
            .OrderBy(x => x.CreatedAt)
            .ToList();

        var sent = 0;
        var skippedUnsub = 0;
        var errors = new List<string>();
        var usedEmails = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var usedOrgs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var limit = settings.OutreachMode == "live"
            ? DailyLimit
            : Math.Min(DailyLimit, Math.Max(1, settings.TestRecipients?.Count ?? 1));

        foreach (var item in due)
        {
            if (sent >= limit)
                break;
            var emailKey = item.Recipient.Trim().ToLowerInvariant();
            var isFollowUp = item.FollowUpNumber > 0 && item.AllowAutomatedFollowUp;
            if (!isFollowUp && (usedEmails.Contains(emailKey) || usedOrgs.Contains(item.OrganizationName.Trim())))
            {
                errors.Add($"{item.QueueId}:duplicate_in_batch");
                continue;
            }
            var gate = await BuildGateAsync(item, settings, scheduledCursorAutomation);
            var code = PartnerOutreachRules.EvaluateSendGate(gate);
            if (code != null)
            {
                if (code == "suppressed")
                {
                    item.Status = "opted_out";
                    item.LastError = code;
                    await _db.SaveAsync(item);
                    skippedUnsub++;
                }
                errors.Add($"{item.QueueId}:{code}");
                continue;
            }
            try
            {
                await SendQueueItemAsync(item);
                usedEmails.Add(emailKey);
                usedOrgs.Add(item.OrganizationName.Trim());
                sent++;
                settings.SentCount++;
                await _db.SaveAsync(settings);
            }
            catch (Exception ex)
            {
                item.Status = "failed";
                item.LastError = "send_failed";
                await _db.SaveAsync(item);
                errors.Add(item.QueueId + ":failed");
                _log.LogError(ex, "Partner queue send failed {Id}", item.QueueId);
            }
        }
        return new { sent, skippedUnsub, errors };
    }

    async Task<PartnerSendContext> BuildGateAsync(PartnerQueueItem item, PartnerOutreachSettingsRow settings, bool scheduled)
    {
        var suppress = await _db.LoadAsync<PartnerSuppression>(item.Recipient.ToLowerInvariant());
        var all = await _db.ScanAsync<PartnerQueueItem>(new List<ScanCondition>()).GetRemainingAsync();
        var isFollowUp = item.FollowUpNumber > 0 && item.AllowAutomatedFollowUp;
        var orgDup = !isFollowUp && all.Any(x =>
            x.QueueId != item.QueueId
            && string.Equals(x.OrganizationName, item.OrganizationName, StringComparison.OrdinalIgnoreCase)
            && x.Status is "sent" or "delivered" or "replied");
        var recent = !isFollowUp && all.Any(x =>
            string.Equals(x.Recipient, item.Recipient, StringComparison.OrdinalIgnoreCase)
            && x.SentAt != null
            && x.SentAt > DateTime.UtcNow.AddDays(-PartnerOutreachRules.MinContactGapDays));
        var todayEt = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, PartnerOutreachRules.EasternTimeZone()).Date;
        var sentToday = all.Count(x => x.SentAt != null && TimeZoneInfo.ConvertTimeFromUtc(x.SentAt.Value, PartnerOutreachRules.EasternTimeZone()).Date == todayEt);
        var current = PartnerOutreachRules.Fingerprint(item.Recipient, item.Subject, item.BodyText, item.PartnerUrl, item.CampaignId);
        var bounceRate = settings.SentCount > 20 && settings.BounceCount / (double)settings.SentCount > 0.08;

        var campaign = await _db.LoadAsync<PartnerCampaign>(item.CampaignId);
        var campaignActive = campaign == null || string.Equals(campaign.Status, "active", StringComparison.OrdinalIgnoreCase);

        var parentApproved = !string.IsNullOrWhiteSpace(item.ParentApprovalId)
            || !string.IsNullOrWhiteSpace(item.ApprovalId);
        if (isFollowUp && !string.IsNullOrWhiteSpace(item.ParentQueueId))
        {
            var parent = all.FirstOrDefault(x => x.QueueId == item.ParentQueueId)
                ?? await _db.LoadAsync<PartnerQueueItem>(item.ParentQueueId);
            parentApproved = parent != null
                && !string.IsNullOrWhiteSpace(parent.ApprovalId)
                && parent.Status is "sent" or "delivered" or "replied" or "approved";
        }

        var dailyCap = campaign?.DailyOutreachLimit > 0 ? campaign.DailyOutreachLimit : DailyLimit;

        return new PartnerSendContext
        {
            SendEnabled = SendEnabled,
            ScheduledCursorAutomation = scheduled,
            PostalAddress = Postal,
            FromEmail = FromEmail,
            ReplyToEmail = ReplyTo,
            ComplaintPause = settings.ComplaintPause,
            Approved = !string.IsNullOrWhiteSpace(item.ApprovalId) || parentApproved,
            ApprovalFingerprint = item.Fingerprint,
            CurrentFingerprint = current,
            OptedOut = suppress != null && suppress.Reason is "opt_out" or "unsubscribe" or "list_unsubscribe",
            Complained = suppress?.Reason == "complaint",
            HardBounced = suppress?.Reason is "hard_bounce" or "bounce",
            DuplicateOrganizationInitial = orgDup,
            AlreadySentThisRecipient = all.Any(x =>
                x.QueueId != item.QueueId
                && x.FollowUpNumber == 0
                && string.Equals(x.Recipient, item.Recipient, StringComparison.OrdinalIgnoreCase)
                && x.Status is "sent" or "delivered" or "replied" or "queued"),
            RecentlyContacted = recent,
            AlreadyQueuedOrSentSameRecipient = all.Any(x =>
                x.QueueId != item.QueueId
                && x.FollowUpNumber == 0
                && string.Equals(x.Recipient, item.Recipient, StringComparison.OrdinalIgnoreCase)
                && x.Status is "sent" or "queued" or "delivered" or "replied"),
            SentToday = sentToday,
            DailyLimit = dailyCap,
            UnsafeBounceHealth = bounceRate,
            OutreachMode = string.IsNullOrWhiteSpace(settings.OutreachMode) ? "off" : settings.OutreachMode,
            PauseAllOutreach = settings.PauseAllOutreach,
            TestRecipients = settings.TestRecipients ?? new List<string>(),
            Recipient = item.Recipient,
            IsAutomatedFollowUp = isFollowUp,
            FollowUpNumber = item.FollowUpNumber,
            ParentWasApproved = parentApproved,
            CampaignActive = campaignActive,
        };
    }

    async Task SendQueueItemAsync(PartnerQueueItem item)
    {
        var internalId = "po_" + Guid.NewGuid().ToString("N")[..16];
        SesTagRules.AssertNoPii(SesTagRules.CampaignTags(internalId));
        var rfcId = $"<{internalId}@gettrainmate.com>";
        var unsub = BuildUnsubUrl(item.ProspectId);
        var raw = PartnerEmailMime.BuildRaw(
            PartnerOutreachRules.PartnerFromName,
            FromEmail,
            item.Recipient,
            ReplyTo,
            item.Subject,
            item.BodyText,
            item.BodyHtml,
            listUnsubscribeUrl: unsub,
            configurationSet: Env("PARTNER_SES_CONFIGURATION_SET"),
            internalMessageId: internalId);
        item.Status = "queued";
        item.InternalMessageId = internalId;
        item.RfcMessageId = rfcId;
        await _db.SaveAsync(item);

        var sesId = await _email.SendRawEmailAsync(FromEmail, item.Recipient, raw, Env("PARTNER_SES_CONFIGURATION_SET"));
        item.SesMessageId = sesId;
        item.Status = "sent";
        item.SentAt = DateTime.UtcNow;
        await _db.SaveAsync(item);

        var thread = new PartnerThread
        {
            ProspectId = item.ProspectId,
            QueueId = item.QueueId,
            Subject = item.Subject,
            LastMessageAt = DateTime.UtcNow,
            MessageCount = 1
        };
        await _db.SaveAsync(thread);
        await _db.SaveAsync(new PartnerMessage
        {
            ThreadId = thread.ThreadId,
            MessageId = $"{DateTime.UtcNow:yyyy-MM-ddTHH:mm:ss.fffZ}#{Guid.NewGuid()}",
            Direction = "outbound",
            From = $"{PartnerOutreachRules.PartnerFromName} <{FromEmail}>",
            To = item.Recipient,
            Subject = item.Subject,
            BodyText = item.BodyText,
            BodyHtmlSafe = PartnerEmailMime.SanitizeHtml(item.BodyHtml),
            DeliveryStatus = "sent",
            RfcMessageId = rfcId,
            SesMessageId = sesId,
            InternalMessageId = internalId,
            CreatedAt = DateTime.UtcNow
        });
        var p = await _db.LoadAsync<PartnerProspect>(item.ProspectId);
        if (p != null)
        {
            p.Status = "sent";
            p.CrmLifecycle = item.FollowUpNumber > 0 ? PartnerCrmLifecycle.FollowUp : PartnerCrmLifecycle.Contacted;
            p.EmailState = "SENT";
            p.LastContactedAt = DateTime.UtcNow;
            await _db.SaveAsync(p);
        }

        // Schedule follow-ups only after a successful INITIAL approved send.
        if (item.FollowUpNumber == 0 && !string.IsNullOrWhiteSpace(item.ApprovalId))
            await ScheduleFollowUpsAsync(item);
    }

    async Task ScheduleFollowUpsAsync(PartnerQueueItem parent)
    {
        var campaign = await _db.LoadAsync<PartnerCampaign>(parent.CampaignId);
        var days = campaign?.FollowUpDays?.Where(d => d > 0).Distinct().OrderBy(d => d).ToList()
            ?? new List<int> { 4, 9 };
        var max = campaign?.MaxFollowUps > 0 ? campaign.MaxFollowUps : 2;
        days = days.Take(max).ToList();
        if (days.Count == 0) return;

        var existing = await ListQueueAsync(null);
        var n = 0;
        foreach (var day in days)
        {
            n++;
            var idem = $"fu:{parent.QueueId}:{n}";
            if (existing.Any(x => x.IdempotencyKey == idem || (x.ParentQueueId == parent.QueueId && x.FollowUpNumber == n)))
                continue;

            var subject = parent.Subject.StartsWith("Re:", StringComparison.OrdinalIgnoreCase)
                ? parent.Subject
                : "Re: " + parent.Subject;
            var bodyText = BuildFollowUpBody(parent.BodyText, n, parent.OrganizationName);
            var bodyHtml = $"<p>{System.Net.WebUtility.HtmlEncode(bodyText).Replace("\n", "<br>")}</p>";
            var fp = PartnerOutreachRules.Fingerprint(parent.Recipient, subject, bodyText, parent.PartnerUrl, parent.CampaignId);
            var followUp = new PartnerQueueItem
            {
                ProspectId = parent.ProspectId,
                CampaignId = parent.CampaignId,
                Recipient = parent.Recipient,
                OrganizationName = parent.OrganizationName,
                Subject = subject,
                BodyText = bodyText,
                BodyHtml = bodyHtml,
                PartnerUrl = parent.PartnerUrl,
                Fingerprint = fp,
                Status = "scheduled",
                FollowUpNumber = n,
                ParentQueueId = parent.QueueId,
                ParentApprovalId = parent.ApprovalId,
                ApprovalId = parent.ApprovalId,
                AllowAutomatedFollowUp = true,
                ScheduledAt = DateTime.UtcNow.AddDays(day),
                IdempotencyKey = idem,
                MessageVersion = 1,
                ApprovedBy = parent.ApprovedBy,
                ApprovedAt = parent.ApprovedAt,
            };
            await _db.SaveAsync(followUp);
        }
    }

    static string BuildFollowUpBody(string originalBody, int followUpNumber, string orgName)
    {
        var intro = followUpNumber == 1
            ? $"Hi {orgName} team — just a quick follow-up on my note below.\n\n"
            : $"Hi {orgName} team — one last follow-up in case this is useful for your members.\n\n";
        return intro + originalBody.Trim();
    }

    public async Task<object> SendCrmReplyAsync(string threadId, string bodyText, string actor, bool confirmSend)
    {
        if (!confirmSend) throw new InvalidOperationException("Explicit Send confirmation is required.");
        if (!SendEnabled) throw new InvalidOperationException("send_disabled");
        var thread = await _db.LoadAsync<PartnerThread>(threadId) ?? throw new KeyNotFoundException("Thread not found");
        var msgs = (await _db.QueryAsync<PartnerMessage>(threadId).GetRemainingAsync()).OrderBy(m => m.CreatedAt).ToList();
        var last = msgs.LastOrDefault();
        var prospect = await _db.LoadAsync<PartnerProspect>(thread.ProspectId) ?? throw new KeyNotFoundException("Prospect not found");
        var replySuppress = await _db.LoadAsync<PartnerSuppression>(prospect.Email.ToLowerInvariant());
        if (replySuppress != null)
            throw new InvalidOperationException("suppressed");
        var refs = msgs.Select(m => m.RfcMessageId).Where(s => !string.IsNullOrWhiteSpace(s)).Cast<string>().ToList();
        var rfcId = $"<po_reply_{Guid.NewGuid():N}@gettrainmate.com>";
        var html = $"<p>{System.Net.WebUtility.HtmlEncode(bodyText).Replace("\n", "<br>")}</p>";
        var raw = PartnerEmailMime.BuildRaw(
            PartnerOutreachRules.PartnerFromName,
            FromEmail,
            prospect.Email,
            ReplyTo,
            thread.Subject.StartsWith("Re:", StringComparison.OrdinalIgnoreCase) ? thread.Subject : "Re: " + thread.Subject,
            bodyText,
            html,
            inReplyTo: last?.RfcMessageId,
            references: refs);
        var pending = new PartnerMessage
        {
            ThreadId = threadId,
            MessageId = $"{DateTime.UtcNow:yyyy-MM-ddTHH:mm:ss.fffZ}#{Guid.NewGuid()}",
            Direction = "outbound",
            From = $"{PartnerOutreachRules.PartnerFromName} <{FromEmail}>",
            To = prospect.Email,
            Subject = thread.Subject,
            BodyText = bodyText,
            BodyHtmlSafe = html,
            DeliveryStatus = "queued",
            RfcMessageId = rfcId,
            InReplyTo = last?.RfcMessageId,
            References = refs,
            CreatedAt = DateTime.UtcNow
        };
        await _db.SaveAsync(pending);
        var sesId = await _email.SendRawEmailAsync(FromEmail, prospect.Email, raw, Env("PARTNER_SES_CONFIGURATION_SET"));
        pending.SesMessageId = sesId;
        pending.DeliveryStatus = "sent";
        await _db.SaveAsync(pending);
        thread.MessageCount++;
        thread.LastMessageAt = DateTime.UtcNow;
        await _db.SaveAsync(thread);
        return new { sesMessageId = sesId, threadId };
    }

    public async Task<object> IngestInboundAsync(string rawMime, string dedupeKey)
    {
        var existing = await _db.LoadAsync<PartnerInboundDedupe>(dedupeKey);
        if (existing != null) return new { ingested = false, reason = "duplicate" };
        await _db.SaveAsync(new PartnerInboundDedupe { DedupeKey = dedupeKey });

        var parsed = InboundMimeParser.Parse(rawMime);
        PartnerQueueItem? match = null;
        var queues = await _db.ScanAsync<PartnerQueueItem>(new List<ScanCondition>()).GetRemainingAsync();
        if (!string.IsNullOrWhiteSpace(parsed.InReplyTo))
            match = queues.FirstOrDefault(q => parsed.InReplyTo.Contains(q.InternalMessageId ?? "___", StringComparison.OrdinalIgnoreCase)
                || parsed.InReplyTo.Contains(q.RfcMessageId ?? "___", StringComparison.OrdinalIgnoreCase));
        match ??= queues.FirstOrDefault(q => parsed.References.Any(r =>
            r.Contains(q.InternalMessageId ?? "___", StringComparison.OrdinalIgnoreCase)));

        PartnerThread thread;
        if (match != null)
        {
            var threads = await _db.ScanAsync<PartnerThread>(new List<ScanCondition>()).GetRemainingAsync();
            thread = threads.FirstOrDefault(t => t.QueueId == match.QueueId)
                ?? new PartnerThread { ProspectId = match.ProspectId, QueueId = match.QueueId, Subject = parsed.Subject };
            match.Status = "replied";
            await _db.SaveAsync(match);
            var p = await _db.LoadAsync<PartnerProspect>(match.ProspectId);
            if (p != null)
            {
                p.Status = "replied";
                p.CrmLifecycle = PartnerCrmLifecycle.Replied;
                await _db.SaveAsync(p);
            }
        }
        else
        {
            thread = new PartnerThread { Subject = parsed.Subject };
        }

        var msg = new PartnerMessage
        {
            ThreadId = thread.ThreadId,
            MessageId = $"{DateTime.UtcNow:yyyy-MM-ddTHH:mm:ss.fffZ}#{Guid.NewGuid()}",
            Direction = "inbound",
            From = parsed.From,
            To = parsed.To,
            Subject = parsed.Subject,
            BodyText = parsed.TextBody,
            BodyHtmlSafe = PartnerEmailMime.SanitizeHtml(parsed.HtmlBody),
            DeliveryStatus = "replied",
            RfcMessageId = parsed.MessageId,
            InReplyTo = parsed.InReplyTo,
            References = parsed.References.ToList(),
            CreatedAt = DateTime.UtcNow
        };
        thread.LastMessageAt = DateTime.UtcNow;
        thread.MessageCount++;
        await _db.SaveAsync(thread);
        await _db.SaveAsync(msg);
        var settings = await LoadSettingsAsync();
        settings.ReplyCount++;
        await _db.SaveAsync(settings);

        var preview = parsed.TextBody.Length > 280 ? parsed.TextBody[..280] + "…" : parsed.TextBody;
        var et = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, PartnerOutreachRules.EasternTimeZone());
        var admin = First(Env("SES_ADMIN_EMAIL"), Env("ADMIN_EMAIL"));
        if (!string.IsNullOrWhiteSpace(admin))
        {
            var org = match?.OrganizationName ?? "Unknown organization";
            var link = $"{Frontend}/admin/partner-outreach?thread={thread.ThreadId}";
            await _email.SendEmailAsync(
                admin,
                $"[GetTrainMate] Partner reply: {org}",
                $"Organization: {org}\nSubject: {parsed.Subject}\nReceived: {et:MMM d, yyyy h:mm tt} ET\nCRM: {link}\n\nPreview:\n{preview}\n\nReply from the Admin CRM only.");
        }
        return new { ingested = true, threadId = thread.ThreadId };
    }

    public async Task ApplySesEventAsync(string internalMessageId, string eventType)
    {
        var items = await _db.ScanAsync<PartnerQueueItem>(new List<ScanCondition>()).GetRemainingAsync();
        var item = items.FirstOrDefault(x => x.InternalMessageId == internalMessageId);
        if (item == null) return;
        var settings = await LoadSettingsAsync();
        var p = await _db.LoadAsync<PartnerProspect>(item.ProspectId);
        switch (eventType.ToLowerInvariant())
        {
            case "delivery":
                item.Status = "delivered";
                if (p != null) { p.Status = "delivered"; p.EmailState = "DELIVERED"; p.CrmLifecycle ??= PartnerCrmLifecycle.Contacted; }
                break;
            case "bounce":
                item.Status = "bounced";
                settings.BounceCount++;
                await _db.SaveAsync(new PartnerSuppression { Email = item.Recipient.ToLowerInvariant(), Reason = "hard_bounce" });
                if (p != null) { p.Status = "bounced"; p.EmailState = "BOUNCED"; }
                break;
            case "complaint":
                item.Status = "complained";
                settings.ComplaintCount++;
                settings.ComplaintPause = true;
                await _db.SaveAsync(new PartnerSuppression { Email = item.Recipient.ToLowerInvariant(), Reason = "complaint" });
                if (p != null) { p.Status = "complained"; p.EmailState = "COMPLAINED"; p.CrmLifecycle = PartnerCrmLifecycle.Closed; }
                break;
            case "reject":
            case "rendering failure":
                item.Status = "failed";
                if (p != null) p.EmailState = "FAILED";
                break;
            case "delivery delay":
                item.Status = "deferred";
                break;
        }
        await _db.SaveAsync(item);
        await _db.SaveAsync(settings);
        if (p != null) await _db.SaveAsync(p);
    }

    public async Task UnsubscribeAsync(string recipientId)
    {
        var p = await _db.LoadAsync<PartnerProspect>(recipientId);
        if (p == null && recipientId.Contains('@'))
        {
            var all = await _db.ScanAsync<PartnerProspect>(new List<ScanCondition>()).GetRemainingAsync();
            p = all.FirstOrDefault(x => string.Equals(x.Email, recipientId, StringComparison.OrdinalIgnoreCase));
        }
        var email = (p?.Email ?? recipientId).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            return;
        await _db.SaveAsync(new PartnerSuppression { Email = email, Reason = "opt_out", CreatedAt = DateTime.UtcNow });
        if (p != null)
        {
            p.Status = "opted_out";
            p.CrmLifecycle = PartnerCrmLifecycle.Closed;
            p.EmailState = "OPTED_OUT";
            await _db.SaveAsync(p);
        }
        var queue = await _db.ScanAsync<PartnerQueueItem>(new List<ScanCondition>()).GetRemainingAsync();
        foreach (var item in queue.Where(x =>
            string.Equals(x.Recipient, email, StringComparison.OrdinalIgnoreCase)
            && x.Status is "approved" or "queued" or "draft" or "scheduled"))
        {
            item.Status = "opted_out";
            item.LastError = "unsubscribed";
            await _db.SaveAsync(item);
        }
    }

    public async Task<object> MetricsAsync()
    {
        var q = await ListQueueAsync(null);
        var p = await ListProspectsAsync(null);
        var s = await LoadSettingsAsync();
        return new
        {
            approvedRecipients = q.Count(x => x.Status == "approved"),
            sent = q.Count(x => x.Status is "sent" or "delivered" or "replied"),
            delivered = q.Count(x => x.Status == "delivered"),
            bounced = q.Count(x => x.Status == "bounced"),
            complaints = s.ComplaintCount,
            replies = s.ReplyCount,
            positiveReplies = "Unavailable",
            partnerLandingSessions = "Unavailable",
            partnerAttributedSignups = "Unavailable",
            sendEnabled = SendEnabled,
            complaintPause = s.ComplaintPause,
            outreachMode = s.OutreachMode,
            pauseAllOutreach = s.PauseAllOutreach,
            maxActiveMarkets = MarketCampaignCatalog.MaxActiveMarkets,
            approvedOutreachLanguages = MarketCampaignCatalog.ApprovedOutreachLanguages,
            pendingOutreachLanguages = MarketCampaignCatalog.PendingOutreachLanguages,
            organizationsDiscovered = p.Count,
            qualifiedOrganizations = p.Count(x => x.Status is "prospect" or "draft" or "approved"
                || x.CrmLifecycle is PartnerCrmLifecycle.Qualified or PartnerCrmLifecycle.Contacted),
            verifiedPublicContacts = p.Count(x => x.EmailVerificationStatus == "verified_public"),
            contactsUnavailable = p.Count(x => x.Status == "no_verified_public_email"),
            languageTemplateUnavailable = p.Count(x => x.Status == "qualified_language_unavailable"),
            inviteCodesGenerated = p.Count(x => !string.IsNullOrWhiteSpace(x.PartnerCode)),
            draftsGenerated = q.Count(x => x.Status == "draft"),
            approvalReadyRecipients = q.Count(x => x.Status == "draft"),
        };
    }

    public async Task<object> AcquisitionDashboardAsync()
    {
        var prospects = await ListProspectsAsync(null);
        var queue = await ListQueueAsync(null);
        var settings = await LoadSettingsAsync();

        var customersAcquired = prospects.Sum(p => p.PaidCustomers);
        var activeUsersAcquired = prospects.Sum(p => p.ActivatedUsers);
        var revenueAttributedCents = prospects.Sum(p => p.AttributedRevenueCents);
        var referralSignups = prospects.Sum(p => p.ReferralSignups);

        static double Rate(int num, int den) => den <= 0 ? 0d : (double)num / den;

        var discovered = prospects.Count;
        var qualified = prospects.Count(p =>
            p.CrmLifecycle is PartnerCrmLifecycle.Qualified or PartnerCrmLifecycle.Contacted
                or PartnerCrmLifecycle.FollowUp or PartnerCrmLifecycle.Replied
                or PartnerCrmLifecycle.Interested or PartnerCrmLifecycle.Partner
            || p.Status is "prospect" or "draft" or "approved" or "sent" or "delivered" or "replied");
        var contacted = prospects.Count(p =>
            p.CrmLifecycle is PartnerCrmLifecycle.Contacted or PartnerCrmLifecycle.FollowUp
                or PartnerCrmLifecycle.Replied or PartnerCrmLifecycle.Interested or PartnerCrmLifecycle.Partner
            || p.Status is "sent" or "delivered" or "replied");
        var replied = prospects.Count(p =>
            p.CrmLifecycle is PartnerCrmLifecycle.Replied or PartnerCrmLifecycle.Interested or PartnerCrmLifecycle.Partner
            || p.Status == "replied");
        var interested = prospects.Count(p => p.CrmLifecycle == PartnerCrmLifecycle.Interested);
        var partners = prospects.Count(p => p.CrmLifecycle == PartnerCrmLifecycle.Partner);
        var drafts = queue.Count(q => q.Status == "draft" && q.FollowUpNumber == 0);
        var awaitingApproval = queue.Count(q => q.Status == "draft");
        var approved = queue.Count(q => q.Status == "approved");
        var scheduled = queue.Count(q => q.Status == "scheduled");
        var sent = queue.Count(q => q.Status is "sent" or "delivered");
        var contactNeeded = prospects.Count(p =>
            p.ContactState == PartnerCrmLifecycle.ContactNeeded || p.Status == "no_verified_public_email");

        var todayEt = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, PartnerOutreachRules.EasternTimeZone()).Date;
        var dueFollowUps = queue.Count(q =>
            q.Status == "scheduled" && q.FollowUpNumber > 0
            && (q.ScheduledAt == null || q.ScheduledAt.Value.Date <= todayEt));

        return new
        {
            northStars = new
            {
                customersAcquired,
                activeUsersAcquired,
                revenueAttributedCents,
                referralSignups,
            },
            funnel = new
            {
                discovered,
                qualified,
                contactNeeded,
                drafts,
                awaitingApproval,
                approved,
                scheduled,
                sent,
                contacted,
                replied,
                interested,
                partners,
            },
            conversionRates = new
            {
                discoveredToQualified = Rate(qualified, discovered),
                qualifiedToContacted = Rate(contacted, qualified),
                contactedToReplied = Rate(replied, contacted),
                repliedToInterested = Rate(interested, replied),
                interestedToPartner = Rate(partners, interested),
                draftToApproved = Rate(approved, drafts + approved),
                approvedToSent = Rate(sent, approved + sent),
            },
            todaysActions = new object[]
            {
                new { key = "awaiting_approval", label = "Approve drafts", count = awaitingApproval, filter = "status=draft" },
                new { key = "approved_ready", label = "Approved ready to send", count = approved, filter = "status=approved" },
                new { key = "contact_needed", label = "Find contacts", count = contactNeeded, filter = "contactState=CONTACT_NEEDED" },
                new { key = "due_follow_ups", label = "Due follow-ups", count = dueFollowUps, filter = "status=scheduled" },
                new { key = "replies", label = "Replies to handle", count = replied, filter = "crmLifecycle=REPLIED" },
            },
            settings = new
            {
                settings.OutreachMode,
                settings.PauseAllOutreach,
                settings.ComplaintPause,
                sendEnabled = SendEnabled,
            },
        };
    }

    public async Task<object> GetOutreachSettingsAsync()
    {
        var s = await LoadSettingsAsync();
        return new
        {
            s.Id,
            s.OutreachMode,
            s.PauseAllOutreach,
            s.TestRecipients,
            s.ProspectsPerRun,
            s.ResearchAttemptsPerRun,
            s.ResearchContactsPerRun,
            s.DraftsPerRun,
            s.ComplaintPause,
            s.SentCount,
            s.BounceCount,
            s.ComplaintCount,
            s.ReplyCount,
            sendEnabled = SendEnabled,
        };
    }

    public async Task<object> UpdateOutreachSettingsAsync(PartnerOutreachSettingsRow patch)
    {
        var s = await LoadSettingsAsync();
        if (!string.IsNullOrWhiteSpace(patch.OutreachMode))
        {
            var mode = patch.OutreachMode.Trim().ToLowerInvariant();
            if (mode is not ("off" or "test" or "live"))
                throw new InvalidOperationException("OutreachMode must be off, test, or live.");
            s.OutreachMode = mode;
        }
        s.PauseAllOutreach = patch.PauseAllOutreach;
        if (patch.TestRecipients != null)
            s.TestRecipients = patch.TestRecipients
                .Where(e => !string.IsNullOrWhiteSpace(e) && e.Contains('@'))
                .Select(e => e.Trim().ToLowerInvariant())
                .Distinct()
                .ToList();
        if (patch.ProspectsPerRun > 0) s.ProspectsPerRun = patch.ProspectsPerRun;
        if (patch.ResearchAttemptsPerRun > 0) s.ResearchAttemptsPerRun = patch.ResearchAttemptsPerRun;
        if (patch.ResearchContactsPerRun > 0) s.ResearchContactsPerRun = patch.ResearchContactsPerRun;
        if (patch.DraftsPerRun > 0) s.DraftsPerRun = patch.DraftsPerRun;
        await _db.SaveAsync(s);
        return await GetOutreachSettingsAsync();
    }

    public async Task<List<PartnerThread>> ListThreadsAsync()
    {
        var all = await _db.ScanAsync<PartnerThread>(new List<ScanCondition>()).GetRemainingAsync();
        return all.OrderByDescending(t => t.LastMessageAt).ToList();
    }

    public async Task<object> ConvertToPartnerAsync(string prospectId, string actor)
    {
        var p = await _db.LoadAsync<PartnerProspect>(prospectId) ?? throw new KeyNotFoundException("Prospect not found");
        p.CrmLifecycle = PartnerCrmLifecycle.Partner;
        p.Status = "partner";
        await _db.SaveAsync(p);
        await TryAuditAsync(actor, "partner_outreach.convert_partner", "partner_prospect", prospectId, null, new { p.CrmLifecycle });
        return new { p.ProspectId, p.CrmLifecycle, p.Status };
    }

    public async Task<object> MarkInterestedAsync(string prospectId, string actor)
    {
        var p = await _db.LoadAsync<PartnerProspect>(prospectId) ?? throw new KeyNotFoundException("Prospect not found");
        p.CrmLifecycle = PartnerCrmLifecycle.Interested;
        p.Status = "interested";
        await _db.SaveAsync(p);
        await TryAuditAsync(actor, "partner_outreach.mark_interested", "partner_prospect", prospectId, null, new { p.CrmLifecycle });
        return new { p.ProspectId, p.CrmLifecycle, p.Status };
    }

    public async Task<List<PartnerCampaign>> ListCampaignsAsync()
    {
        var stored = await _db.ScanAsync<PartnerCampaign>(new List<ScanCondition>()).GetRemainingAsync();
        var byId = stored.ToDictionary(c => c.CampaignId, StringComparer.OrdinalIgnoreCase);
        foreach (var seed in MarketCampaignCatalog.Candidates)
        {
            if (byId.ContainsKey(seed.CampaignId)) continue;
            byId[seed.CampaignId] = new PartnerCampaign
            {
                CampaignId = seed.CampaignId,
                Name = seed.DisplayName,
                DisplayName = seed.DisplayName,
                Country = seed.Country,
                Market = seed.Market,
                Status = PartnerCrmLifecycle.NormalizeCampaignStatus(seed.Status),
                PrimaryMode = seed.PrimaryMode,
                Timezone = seed.Timezone,
                Languages = seed.Languages.ToList(),
                FollowUpDays = new List<int> { 4, 9 },
                MaxFollowUps = 2,
            };
        }
        return byId.Values
            .OrderBy(c => c.Status == "active" ? 0 : c.Status is "paused" ? 1 : 2)
            .ThenBy(c => c.DisplayName)
            .ToList();
    }

    public async Task<PartnerCampaign> SetCampaignStatusAsync(string campaignId, string status)
    {
        status = PartnerCrmLifecycle.NormalizeCampaignStatus(status);
        if (status is not ("active" or "paused" or "draft" or "completed" or "candidate"))
            throw new InvalidOperationException("Status must be draft, active, paused, or completed (candidate maps to draft).");
        if (status == "candidate") status = "draft";
        var all = await ListCampaignsAsync();
        // Soft portfolio size via MaxActiveMarkets / daily discovery+outreach limits — do not hard-block activation.
        var row = await _db.LoadAsync<PartnerCampaign>(campaignId)
            ?? all.FirstOrDefault(c => string.Equals(c.CampaignId, campaignId, StringComparison.OrdinalIgnoreCase))
            ?? throw new KeyNotFoundException("Campaign not found");
        row.CampaignId = campaignId;
        row.Status = status;
        if (row.FollowUpDays == null || row.FollowUpDays.Count == 0)
            row.FollowUpDays = new List<int> { 4, 9 };
        if (row.MaxFollowUps <= 0) row.MaxFollowUps = 2;
        if (row.DailyDiscoveryLimit <= 0) row.DailyDiscoveryLimit = 10;
        if (row.DailyOutreachLimit <= 0) row.DailyOutreachLimit = 3;
        if (row.MinAcquisitionScore <= 0) row.MinAcquisitionScore = 50;
        await _db.SaveAsync(row);
        return row;
    }

    public Task<object> DiscoverAsync(string? country, string? market, string? language, string? mode)
    {
        return Task.FromResult<object>(new
        {
            note = "Prefer POST /api/admin/partner-outreach/discovery/jobs for chunked discovery. POST /discover/automated remains for short sync/seedsOnly runs.",
            country,
            market,
            language,
            mode,
        });
    }

    public async Task<object> DedupeAsync(bool dryRun = false)
    {
        var prospects = await ListProspectsAsync(null);
        var queue = await ListQueueAsync(null);
        var removedProspects = new List<object>();
        var removedQueue = new List<object>();
        var keptProspects = new List<object>();

        var prospectGroups = prospects
            .GroupBy(PartnerOutreachDedupe.ProspectKey)
            .Where(g => g.Count() > 1)
            .ToList();

        foreach (var group in prospectGroups)
        {
            var keeper = PartnerOutreachDedupe.PickBestProspect(group);
            keptProspects.Add(new { keeper.ProspectId, keeper.OrganizationName, keeper.Email, keeper.Status });
            foreach (var dup in group.Where(p => p.ProspectId != keeper.ProspectId))
            {
                removedProspects.Add(new { dup.ProspectId, dup.OrganizationName, dup.Email, dup.Status });
                if (!dryRun)
                {
                    foreach (var q in queue.Where(x => x.ProspectId == dup.ProspectId))
                    {
                        removedQueue.Add(new { q.QueueId, q.Recipient, q.Status, reason = "orphan_prospect" });
                        await _db.DeleteAsync(q);
                    }
                    await _db.DeleteAsync(dup);
                }
            }
        }

        var queueGroups = (dryRun ? queue : await ListQueueAsync(null))
            .GroupBy(PartnerOutreachDedupe.QueueKey)
            .Where(g => g.Count() > 1)
            .ToList();

        foreach (var group in queueGroups)
        {
            var keeper = PartnerOutreachDedupe.PickBestQueueItem(group);
            foreach (var dup in group.Where(q => q.QueueId != keeper.QueueId))
            {
                removedQueue.Add(new { dup.QueueId, dup.Recipient, dup.Status, reason = "duplicate_recipient" });
                if (!dryRun)
                    await _db.DeleteAsync(dup);
            }
        }

        return new
        {
            dryRun,
            duplicateProspectGroups = prospectGroups.Count,
            prospectsRemoved = removedProspects.Count,
            queueRemoved = removedQueue.Count,
            keptProspects,
            removedProspects,
            removedQueue,
        };
    }

    public async Task<object> ResearchContactAsync(string prospectId, string actor, bool force = false)
    {
        var p = await _db.LoadAsync<PartnerProspect>(prospectId) ?? throw new KeyNotFoundException("Prospect not found");
        if (string.IsNullOrWhiteSpace(p.Website) || !Uri.TryCreate(p.Website, UriKind.Absolute, out var siteUri))
            return new { ok = false, error = "no_website", prospectId, message = "Prospect has no website to research." };

        if (p.ResearchAttempts >= 5 && !force)
        {
            p.ContactabilityState = p.ResearchAttempts >= 8
                ? PartnerCrmLifecycle.ManualReview
                : PartnerCrmLifecycle.NoPublicContact;
            p.ContactState = PartnerCrmLifecycle.ContactNeeded;
            p.NextResearchAt = null;
            await _db.SaveAsync(p);
            return new
            {
                ok = false,
                skipped = true,
                reason = "max_research_attempts",
                prospectId,
                p.ResearchAttempts,
                p.ContactabilityState,
            };
        }

        if (!force && p.NextResearchAt is DateTime next && next > DateTime.UtcNow)
        {
            return new
            {
                ok = false,
                skipped = true,
                reason = "retry_later",
                prospectId,
                nextResearchAt = next,
                p.ContactabilityState,
            };
        }

        p.ContactabilityState = PartnerCrmLifecycle.ContactResearching;
        p.ContactState = PartnerCrmLifecycle.ContactResearching;
        p.ResearchAttempts++;
        p.LastResearchAt = DateTime.UtcNow;
        await _db.SaveAsync(p);

        VerifiedPublicContact? verified = null;
        try
        {
            verified = await _contactVerifier.TryVerifyAsync(siteUri);
        }
        catch (Exception ex)
        {
            _log.LogDebug(ex, "Research contact failed for {Id}", prospectId);
        }

        if (verified != null && !string.IsNullOrWhiteSpace(verified.Email))
        {
            p.Email = verified.Email.Trim().ToLowerInvariant();
            p.SourceUrl = verified.SourceUrl;
            p.ContactSourceUrl = verified.SourceUrl;
            p.ContactSourceType = verified.SourceType ?? "website_mailto";
            if (!string.IsNullOrWhiteSpace(verified.ContactName))
                p.ContactName = verified.ContactName;
            p.SourceVerifiedOn = verified.VerifiedOnUtc.ToString("yyyy-MM-dd");
            p.EmailVerifiedOn = verified.VerifiedOnUtc.ToString("yyyy-MM-dd");
            p.OfficialDomain = p.Email.Contains('@') ? p.Email.Split('@')[1] : p.OfficialDomain;
            p.EmailVerificationStatus = "verified_public";
            p.EmailSource = "public_listing";
            p.ContactState = PartnerCrmLifecycle.ContactFound;
            p.ContactabilityState = PartnerCrmLifecycle.ContactFound;
            p.NextResearchAt = null;
            if (string.Equals(p.Status, "no_verified_public_email", StringComparison.OrdinalIgnoreCase)
                || string.Equals(p.Status, "discovered", StringComparison.OrdinalIgnoreCase))
                p.Status = "prospect";
            p.CrmLifecycle ??= PartnerCrmLifecycle.Qualified;
            if (p.CrmLifecycle == PartnerCrmLifecycle.New)
                p.CrmLifecycle = PartnerCrmLifecycle.Qualified;

            var scored = AutomatedMarketDiscoveryService.ScoreProspect(new DiscoveredOrganization
            {
                OrganizationName = p.OrganizationName,
                OrganizationType = p.OrganizationType,
                DiscoverySource = p.DiscoverySource ?? "",
                Market = p.Metro ?? p.City ?? "",
            }, hasEmail: true);
            p.AcquisitionScore = scored.AcquisitionScore;
            p.AudienceFitScore = scored.AudienceFitScore;
            p.MarketRelevanceScore = scored.MarketRelevanceScore;
            p.CommunityFitScore = scored.CommunityFitScore;
            p.ContactQualityScore = scored.ContactQualityScore;
            p.ContactabilityScore = scored.ContactQualityScore;
            p.HistoricalCategoryScore = scored.HistoricalCategoryScore;
            p.ScoreExplanation = scored.ScoreExplanation;
            p.FitScore = scored.AcquisitionScore;
            p.ProspectKind ??= PartnerCrmLifecycle.NormalizeProspectKind(p.OrganizationType);
            p.LastEvaluatedAt = DateTime.UtcNow;
            await _db.SaveAsync(p);

            object? draft = null;
            if (MarketCampaignCatalog.IsApprovedOutreachLanguage(p.CampaignLanguage))
            {
                try
                {
                    draft = await CreateDraftAndQueuePreviewAsync(p.ProspectId, p.CampaignId ?? "");
                }
                catch (Exception ex)
                {
                    _log.LogDebug(ex, "Draft after research skipped for {Id}", prospectId);
                }
            }

            await TryAuditAsync(actor, "partner_outreach.research_contact", "partner_prospect", prospectId, null,
                new { found = true, p.Email, p.ContactSourceUrl, p.ResearchAttempts });
            return new
            {
                ok = true,
                found = true,
                prospectId,
                email = p.Email,
                contactSourceUrl = p.ContactSourceUrl,
                contactSourceType = p.ContactSourceType,
                contactName = p.ContactName,
                p.ResearchAttempts,
                p.ContactabilityState,
                p.ContactabilityScore,
                p.AcquisitionScore,
                draft,
            };
        }

        // Not found — never invent email
        p.ContactabilityState = p.ResearchAttempts >= 3
            ? PartnerCrmLifecycle.NoPublicContact
            : PartnerCrmLifecycle.RetryLater;
        p.ContactState = PartnerCrmLifecycle.ContactNeeded;
        p.NextResearchAt = DateTime.UtcNow.AddDays(Math.Max(1, p.ResearchAttempts * 2));
        p.EmailVerificationStatus = "no_verified_public_email";
        if (string.IsNullOrWhiteSpace(p.Email))
            p.Status = "no_verified_public_email";
        p.ContactabilityScore = 0;
        p.ContactQualityScore = 0;
        p.LastEvaluatedAt = DateTime.UtcNow;
        await _db.SaveAsync(p);
        await TryAuditAsync(actor, "partner_outreach.research_contact", "partner_prospect", prospectId, null,
            new { found = false, p.ResearchAttempts, p.ContactabilityState, p.NextResearchAt });
        return new
        {
            ok = true,
            found = false,
            prospectId,
            p.ResearchAttempts,
            p.ContactabilityState,
            nextResearchAt = p.NextResearchAt,
        };
    }

    public async Task<object> ResearchContactsBulkAsync(IEnumerable<string> prospectIds, string actor, int max = 20)
    {
        var ids = (prospectIds ?? Array.Empty<string>())
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.Ordinal)
            .Take(Math.Clamp(max, 1, 50))
            .ToList();
        var results = new List<object>();
        foreach (var id in ids)
        {
            try
            {
                results.Add(await ResearchContactAsync(id, actor, force: false));
            }
            catch (Exception ex)
            {
                results.Add(new { ok = false, prospectId = id, error = ex.Message });
            }
        }
        return new { researched = results.Count, results };
    }

    public async Task<object> ResearchContactNeededBatchAsync(int max, string actor)
    {
        max = Math.Clamp(max <= 0 ? 10 : max, 1, 50);
        var prospects = await ListProspectsAsync(null);
        var now = DateTime.UtcNow;
        var candidates = prospects
            .Where(p => !string.IsNullOrWhiteSpace(p.Website))
            .Where(p => string.IsNullOrWhiteSpace(p.Email) || !p.Email.Contains('@'))
            .Where(p =>
            {
                var state = (p.ContactabilityState ?? p.ContactState ?? "").ToUpperInvariant();
                if (state is PartnerCrmLifecycle.ContactFound) return false;
                if (state is PartnerCrmLifecycle.NoPublicContact or PartnerCrmLifecycle.ManualReview)
                    return false;
                if (p.NextResearchAt is DateTime next && next > now) return false;
                if (p.ResearchAttempts >= 5) return false;
                return state is "" or PartnerCrmLifecycle.ContactNeeded or PartnerCrmLifecycle.RetryLater
                    or PartnerCrmLifecycle.ContactUnknown or PartnerCrmLifecycle.ContactResearching
                    || p.Status == "no_verified_public_email";
            })
            .OrderBy(p => p.ResearchAttempts)
            .ThenBy(p => p.NextResearchAt ?? DateTime.MinValue)
            .Take(max)
            .Select(p => p.ProspectId)
            .ToList();

        return await ResearchContactsBulkAsync(candidates, actor, max);
    }

    public async Task<object> RecordPartnerAttributionAsync(string partnerOrRefCode, string eventType, long? revenueCents = null)
    {
        var code = (partnerOrRefCode ?? "").Trim();
        if (string.IsNullOrWhiteSpace(code))
            return new { ok = false, error = "missing_code" };
        var evt = (eventType ?? "").Trim().ToLowerInvariant();
        if (evt is not ("signup" or "activated" or "paid"))
            return new { ok = false, error = "invalid_event" };

        var all = await ListProspectsAsync(null);
        var p = all.FirstOrDefault(x =>
            string.Equals(x.PartnerCode, code, StringComparison.OrdinalIgnoreCase)
            || string.Equals(x.PartnerCode, MarketCampaignCatalog.Slug(code), StringComparison.OrdinalIgnoreCase));
        if (p == null)
            return new { ok = false, error = "prospect_not_found", code };

        switch (evt)
        {
            case "signup":
                p.ReferralSignups++;
                break;
            case "activated":
                p.ActivatedUsers++;
                break;
            case "paid":
                p.PaidCustomers++;
                if (revenueCents is > 0) p.AttributedRevenueCents += revenueCents.Value;
                break;
        }
        p.LastEvaluatedAt = DateTime.UtcNow;
        await _db.SaveAsync(p);
        return new
        {
            ok = true,
            prospectId = p.ProspectId,
            partnerCode = p.PartnerCode,
            evt,
            p.ReferralSignups,
            p.ActivatedUsers,
            p.PaidCustomers,
            p.AttributedRevenueCents,
        };
    }

    public async Task<PartnerThread?> GetThreadAsync(string threadId) =>
        await _db.LoadAsync<PartnerThread>(threadId);

    public async Task<List<PartnerMessage>> ListMessagesAsync(string threadId)
    {
        var msgs = await _db.QueryAsync<PartnerMessage>(threadId).GetRemainingAsync();
        return msgs.OrderBy(m => m.CreatedAt).ToList();
    }

    string BuildUnsubUrl(string prospectId)
    {
        var secret = string.IsNullOrWhiteSpace(UnsubSecret) ? "dev-unsub-secret-not-for-production" : UnsubSecret;
        var token = UnsubscribeToken.Create(prospectId, secret, DateTimeOffset.UtcNow.AddDays(30));
        return $"{Frontend}/email/unsubscribe?t={Uri.EscapeDataString(token)}";
    }

    async Task<PartnerOutreachSettingsRow> LoadSettingsAsync()
    {
        var row = await _db.LoadAsync<PartnerOutreachSettingsRow>("default")
            ?? new PartnerOutreachSettingsRow();
        if (string.IsNullOrWhiteSpace(row.OutreachMode)) row.OutreachMode = "off";
        if (row.ProspectsPerRun <= 0) row.ProspectsPerRun = 8;
        if (row.ResearchAttemptsPerRun <= 0) row.ResearchAttemptsPerRun = 15;
        if (row.ResearchContactsPerRun <= 0) row.ResearchContactsPerRun = 10;
        if (row.DraftsPerRun <= 0) row.DraftsPerRun = 5;
        row.TestRecipients ??= new List<string>();
        return row;
    }

    async Task TryAuditAsync(string actor, string action, string targetType, string? targetId, object? before, object? after)
    {
        if (_audit == null) return;
        try
        {
            await _audit.LogActionAsync(
                new AdminIdentity { Sub = actor, Email = actor, CognitoUsername = actor },
                action,
                targetType,
                targetId,
                before,
                after);
        }
        catch (Exception ex)
        {
            _log.LogDebug(ex, "Audit log skipped for {Action}", action);
        }
    }
}
