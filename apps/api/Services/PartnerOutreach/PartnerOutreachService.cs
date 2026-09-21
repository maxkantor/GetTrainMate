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
    Task<object> ListAcquisitionCustomersAsync();
    Task<object> GetProspectDetailAsync(string prospectId);
    Task<object> BulkApproveAsync(IEnumerable<string> queueIds, string actor, bool confirm);
    Task<object> RejectQueueAsync(string queueId, string actor, string? reason);
    Task<PartnerQueueItem> UpdateQueueDraftAsync(string queueId, string subject, string bodyText, string? bodyHtml, string actor);
    Task<object> GetOutreachSettingsAsync();
    Task<object> UpdateOutreachSettingsAsync(PartnerOutreachSettingsRow patch);
    Task<List<PartnerThread>> ListThreadsAsync();
    Task<object> ConvertToPartnerAsync(string prospectId, string actor);
    Task<object> MarkInterestedAsync(string prospectId, string actor);
    Task<object> ApproveAndSendAsync(string queueId, string actor, bool confirm, bool confirmOverride = false);
    Task<object> BulkApproveAndSendAsync(IEnumerable<string> queueIds, string actor, bool confirm, bool confirmOverride = false);
    Task<object> SendQueueItemByIdAsync(string queueId);
    Task<object> RescoreProspectAsync(string prospectId);
    Task<object> RescoreLowScoreProspectsAsync(int max = 50);
    /// <summary>
    /// Regenerates all unsent initial outreach drafts that still contain obsolete Max/partnership
    /// copy (or any unsent initial when forceAllUnsentInitial is true). Invalidates prior approval
    /// → status draft (NEEDS_APPROVAL). Does not modify sent history.
    /// </summary>
    Task<object> RegenerateObsoleteUnsentDraftsAsync(string actor, bool forceAllUnsentInitial = false);
    Task<object> ResearchContactAsync(string prospectId, string actor, bool force = false);
    Task<object> ResearchContactsBulkAsync(IEnumerable<string> prospectIds, string actor, int max = 20, bool force = false);
    Task<object> ResearchContactNeededBatchAsync(int max, string actor);
    /// <summary>
    /// Increment attribution counters on a prospect matched by PartnerCode.
    /// eventType: signup | activated | paid
    /// Active user = Discover started (discover_started) after partner referral signup.
    /// isDirectCustomer: when true, paid revenue goes to DirectRevenueCents (org as customer);
    /// otherwise AttributedRevenueCents (referral path). Default false.
    /// </summary>
    Task<object> RecordPartnerAttributionAsync(string partnerOrRefCode, string eventType, long? revenueCents = null, bool isDirectCustomer = false);
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
            PartnerCrmLifecycle.NormalizeAcquisitionDimensions(duplicate);
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
        PartnerCrmLifecycle.NormalizeAcquisitionDimensions(prospect);
        PartnerCrmLifecycle.AppendTimelineEvent(prospect, "discovered", "Prospect discovered", prospect.CreatedAt,
            new { prospect.OrganizationName, prospect.EntityType });
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
        PartnerCrmLifecycle.NormalizeAcquisitionDimensions(existing);
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
                p.AcquisitionStatus = existingQueue.Status == "approved"
                    ? PartnerCrmLifecycle.AcqApproved
                    : PartnerCrmLifecycle.AcqAwaitingApproval;
                if (!string.IsNullOrWhiteSpace(p.PartnerCode))
                    p.DistributionStatus ??= PartnerCrmLifecycle.DistInviteCreated;
                PartnerCrmLifecycle.NormalizeAcquisitionDimensions(p);
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
            TemplateVersion = PartnerOutreachRules.TemplateVersion,
            MessageVersion = 1,
            FollowUpNumber = 0,
        };
        await _db.SaveAsync(item);
        p.Status = "draft";
        p.CrmLifecycle = PartnerCrmLifecycle.Qualified;
        p.ContactState = PartnerCrmLifecycle.ContactFound;
        p.EmailState = "AWAITING_APPROVAL";
        p.AcquisitionStatus = PartnerCrmLifecycle.AcqAwaitingApproval;
        if (!string.IsNullOrWhiteSpace(p.PartnerCode) || !string.IsNullOrWhiteSpace(p.LandingUrl))
            p.DistributionStatus = string.IsNullOrWhiteSpace(p.DistributionStatus) || p.DistributionStatus == PartnerCrmLifecycle.DistNone
                ? PartnerCrmLifecycle.DistInviteCreated
                : p.DistributionStatus;
        PartnerCrmLifecycle.AppendTimelineEvent(p, "draft_created", "Outreach draft created", DateTime.UtcNow,
            new { item.QueueId, item.Subject });
        PartnerCrmLifecycle.NormalizeAcquisitionDimensions(p);
        await _db.SaveAsync(p);
        return item;
    }

    public async Task<PartnerApproval> ApproveAsync(string queueId, string approver, bool confirm)
    {
        if (!confirm) throw new InvalidOperationException("Explicit confirmation is required.");
        var item = await _db.LoadAsync<PartnerQueueItem>(queueId) ?? throw new KeyNotFoundException("Queue item not found");
        if (item.Status == "rejected")
            throw new InvalidOperationException("Cannot approve a rejected queue item.");
        if (IsAlreadySentQueueItem(item))
            throw new InvalidOperationException("Cannot re-approve an already-sent item.");
        // Approving authorizes the CURRENT draft body/subject/url (refresh fingerprint).
        // Do not reject on drift — Approve & Send is the human authorization of what's on screen.
        var current = PartnerOutreachRules.Fingerprint(item.Recipient, item.Subject, item.BodyText, item.PartnerUrl, item.CampaignId);
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
            p.AcquisitionStatus = PartnerCrmLifecycle.AcqApproved;
            PartnerCrmLifecycle.AppendTimelineEvent(p, "approved", "Outreach approved", DateTime.UtcNow,
                new { approval.ApprovalId, queueId });
            PartnerCrmLifecycle.NormalizeAcquisitionDimensions(p);
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

    public async Task<object> ApproveAndSendAsync(string queueId, string actor, bool confirm, bool confirmOverride = false)
    {
        if (!confirm) throw new InvalidOperationException("Explicit confirmation is required.");

        var itemPre = await _db.LoadAsync<PartnerQueueItem>(queueId) ?? throw new KeyNotFoundException("Queue item not found");
        if (IsAlreadySentQueueItem(itemPre))
        {
            return new
            {
                approved = true,
                sent = true,
                alreadySent = true,
                status = itemPre.Status,
                sesMessageId = itemPre.SesMessageId,
                sentAt = itemPre.SentAt,
            };
        }

        var prospect = await _db.LoadAsync<PartnerProspect>(itemPre.ProspectId);
        if (prospect != null)
        {
            var scoreCheck = await EnsureAcquisitionScoreForSendAsync(prospect, itemPre.CampaignId, confirmOverride);
            if (scoreCheck != null) return scoreCheck;
        }

        await ApproveAsync(queueId, actor, confirm: true);

        var item = await _db.LoadAsync<PartnerQueueItem>(queueId) ?? throw new KeyNotFoundException("Queue item not found");
        if (IsAlreadySentQueueItem(item))
        {
            return new
            {
                approved = true,
                sent = true,
                alreadySent = true,
                status = item.Status,
                sesMessageId = item.SesMessageId,
                sentAt = item.SentAt,
            };
        }

        var settings = await LoadSettingsAsync();
        if (settings.PauseAllOutreach)
        {
            return new
            {
                approved = true,
                sent = false,
                status = "paused",
                error = "pause_all_outreach",
            };
        }

        var gate = await BuildGateAsync(item, settings, scheduled: false);
        var code = PartnerOutreachRules.EvaluateSendGate(gate);
        if (code == "daily_send_limit")
        {
            item.Status = "approved_for_next_send";
            item.LastError = null;
            await _db.SaveAsync(item);
            var p = await _db.LoadAsync<PartnerProspect>(item.ProspectId);
            if (p != null)
            {
                p.Status = "approved";
                p.EmailState = "APPROVED";
                p.AcquisitionStatus = PartnerCrmLifecycle.AcqQueued;
                PartnerCrmLifecycle.NormalizeAcquisitionDimensions(p);
                await _db.SaveAsync(p);
            }
            return new
            {
                approved = true,
                sent = false,
                deferred = true,
                status = "approved_for_next_send",
                remainingCapacity = 0,
            };
        }

        if (code != null)
        {
            return new
            {
                approved = true,
                sent = false,
                status = item.Status,
                error = code,
            };
        }

        await SendQueueItemAsync(item);
        settings.SentCount++;
        await _db.SaveAsync(settings);
        return new
        {
            approved = true,
            sent = true,
            sesMessageId = item.SesMessageId,
            sentAt = item.SentAt,
        };
    }

    public async Task<object> BulkApproveAndSendAsync(IEnumerable<string> queueIds, string actor, bool confirm, bool confirmOverride = false)
    {
        if (!confirm) throw new InvalidOperationException("Explicit confirmation is required.");
        var ids = queueIds.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.Ordinal).ToList();
        var settings = await LoadSettingsAsync();
        var allQueue = await ListQueueAsync(null);
        var todayEt = PartnerOutreachRules.EasternNowDate();
        var sentTodayBefore = allQueue.Count(x =>
            x.SentAt != null
            && PartnerOutreachRules.ToEasternDate(x.SentAt.Value) == todayEt);
        var dailyLimit = DailyLimit;
        var remaining = Math.Max(0, dailyLimit - sentTodayBefore);

        var ordered = new List<PartnerQueueItem>();
        foreach (var id in ids)
        {
            var item = await _db.LoadAsync<PartnerQueueItem>(id);
            if (item != null) ordered.Add(item);
        }
        ordered = ordered.OrderBy(x => x.CreatedAt).ToList();

        var sent = 0;
        var alreadySent = 0;
        var deferred = 0;
        var blocked = new List<object>();
        var selected = ordered.Count;
        // Stay under API Gateway ~29s so partial batches return a real JSON result.
        var deadline = DateTime.UtcNow.AddSeconds(18);
        var incomplete = false;

        foreach (var item in ordered)
        {
            if (DateTime.UtcNow >= deadline)
            {
                incomplete = true;
                break;
            }

            try
            {
                if (IsAlreadySentQueueItem(item))
                {
                    alreadySent++;
                    continue;
                }

                if (item.Status is "rejected" or "opted_out")
                {
                    blocked.Add(new { id = item.QueueId, error = $"invalid_status:{item.Status}" });
                    continue;
                }

                var prospect = await _db.LoadAsync<PartnerProspect>(item.ProspectId);
                if (prospect != null)
                {
                    var scoreCheck = await EnsureAcquisitionScoreForSendAsync(prospect, item.CampaignId, confirmOverride);
                    if (scoreCheck != null)
                    {
                        var err = scoreCheck.GetType().GetProperty("error")?.GetValue(scoreCheck)?.ToString()
                            ?? "needs_override";
                        blocked.Add(new { id = item.QueueId, error = err });
                        continue;
                    }
                }

                // Always re-authorize current content (fingerprint refresh) before send.
                await ApproveAsync(item.QueueId, actor, confirm: true);

                var fresh = await _db.LoadAsync<PartnerQueueItem>(item.QueueId)
                    ?? throw new KeyNotFoundException("Queue item not found");

                if (IsAlreadySentQueueItem(fresh))
                {
                    alreadySent++;
                    continue;
                }

                if (settings.PauseAllOutreach)
                {
                    blocked.Add(new { id = fresh.QueueId, error = "pause_all_outreach" });
                    continue;
                }

                if (remaining <= 0)
                {
                    fresh.Status = "approved_for_next_send";
                    await _db.SaveAsync(fresh);
                    var p = await _db.LoadAsync<PartnerProspect>(fresh.ProspectId);
                    if (p != null)
                    {
                        p.Status = "approved";
                        p.EmailState = "APPROVED";
                        p.AcquisitionStatus = PartnerCrmLifecycle.AcqQueued;
                        PartnerCrmLifecycle.NormalizeAcquisitionDimensions(p);
                        await _db.SaveAsync(p);
                    }
                    deferred++;
                    continue;
                }

                var gate = await BuildGateAsync(fresh, settings, scheduled: false);
                // Treat capacity locally so batch doesn't double-count SentToday mid-loop incorrectly
                if (gate.SentToday + sent >= gate.DailyLimit)
                {
                    fresh.Status = "approved_for_next_send";
                    await _db.SaveAsync(fresh);
                    var p = await _db.LoadAsync<PartnerProspect>(fresh.ProspectId);
                    if (p != null)
                    {
                        p.Status = "approved";
                        p.EmailState = "APPROVED";
                        p.AcquisitionStatus = PartnerCrmLifecycle.AcqQueued;
                        PartnerCrmLifecycle.NormalizeAcquisitionDimensions(p);
                        await _db.SaveAsync(p);
                    }
                    deferred++;
                    continue;
                }

                var code = PartnerOutreachRules.EvaluateSendGate(gate);
                if (code == "daily_send_limit")
                {
                    fresh.Status = "approved_for_next_send";
                    await _db.SaveAsync(fresh);
                    deferred++;
                    remaining = 0;
                    continue;
                }
                if (code != null)
                {
                    blocked.Add(new { id = fresh.QueueId, error = code });
                    continue;
                }

                await SendQueueItemAsync(fresh, allQueue);
                settings.SentCount++;
                await _db.SaveAsync(settings);
                sent++;
                remaining = Math.Max(0, remaining - 1);
            }
            catch (Exception ex)
            {
                blocked.Add(new { id = item.QueueId, error = ex.Message });
            }
        }

        return new
        {
            selected,
            sent,
            alreadySent,
            deferred,
            blocked,
            incomplete,
            remainingCapacityAfter = remaining,
            dailyLimit,
            sentTodayBefore,
        };
    }

    public async Task<object> SendQueueItemByIdAsync(string queueId)
    {
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

    public async Task<object> DispatchDueAsync(bool scheduledCursorAutomation)
    {
        if (scheduledCursorAutomation)
            return new { sent = 0, error = "scheduled_automation_blocked" };

        var settings = await LoadSettingsAsync();
        if (settings.PauseAllOutreach)
            return new { sent = 0, error = "pause_all_outreach" };

        var tz = PartnerOutreachRules.EasternTimeZone();
        var now = DateTime.UtcNow;
        if (!PartnerOutreachRules.IsDispatchWindow(now, tz))
            return new { sent = 0, error = "outside_dispatch_window" };

        var allQueue = await ListQueueAsync(null);
        var due = allQueue
            .Where(x =>
                x.Status is "approved" or "approved_for_next_send"
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
        var limit = DailyLimit;

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

    public async Task<PartnerQueueItem?> GetQueueAsync(string queueId) =>
        await _db.LoadAsync<PartnerQueueItem>(queueId);

    public async Task<List<PartnerQueueItem>> ListQueueAsync(string? status)
    {
        var all = await _db.ScanAsync<PartnerQueueItem>(new List<ScanCondition>()).GetRemainingAsync();
        if (!string.IsNullOrWhiteSpace(status))
            all = all.Where(x => string.Equals(x.Status, status, StringComparison.OrdinalIgnoreCase)).ToList();
        return all.OrderByDescending(x => x.CreatedAt).ToList();
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
        var todayEt = PartnerOutreachRules.EasternNowDate();
        var sentToday = all.Count(x => x.SentAt != null && PartnerOutreachRules.ToEasternDate(x.SentAt.Value) == todayEt);
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
                && parent.Status is "sent" or "delivered" or "replied" or "approved" or "approved_for_next_send";
        }

        var dailyCap = campaign?.DailyOutreachLimit > 0 ? campaign.DailyOutreachLimit : DailyLimit;

        return new PartnerSendContext
        {
            SendEnabled = !settings.PauseAllOutreach,
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
            TestRecipientsOnly = settings.TestRecipientsOnly,
            TestRecipients = settings.TestRecipients ?? new List<string>(),
            Recipient = item.Recipient,
            IsAutomatedFollowUp = isFollowUp,
            FollowUpNumber = item.FollowUpNumber,
            ParentWasApproved = parentApproved,
            CampaignActive = campaignActive,
        };
    }

    static bool IsAlreadySentQueueItem(PartnerQueueItem item) =>
        item.SentAt != null
        || !string.IsNullOrWhiteSpace(item.SesMessageId)
        || item.Status is "sent" or "delivered" or "replied";

    async Task SendQueueItemAsync(PartnerQueueItem item, List<PartnerQueueItem>? queueSnapshot = null)
    {
        // Idempotent: never SES-send the same queue row twice (bulk timeout / retry safety).
        if (item.Status is "sent" or "delivered" or "replied" || item.SentAt != null)
            return;

        if (!string.IsNullOrWhiteSpace(item.SesMessageId))
        {
            await FinalizeSentQueueItemAsync(item, queueSnapshot);
            return;
        }

        if (PartnerOutreachRules.ContainsObsoleteOutreachCopy(item.Subject, item.BodyText, item.BodyHtml))
            throw new InvalidOperationException("obsolete_outreach_copy_blocked");

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
        // Persist SES acceptance immediately so a Lambda/API timeout cannot leave a
        // successfully-accepted email stuck as draft/approved and re-sendable.
        item.SesMessageId = sesId;
        item.Status = "sent";
        item.SentAt = DateTime.UtcNow;
        await _db.SaveAsync(item);

        await FinalizeSentQueueItemAsync(item, queueSnapshot, skipStatusPersist: true);
    }

    async Task FinalizeSentQueueItemAsync(
        PartnerQueueItem item,
        List<PartnerQueueItem>? queueSnapshot = null,
        bool skipStatusPersist = false)
    {
        if (!skipStatusPersist)
        {
            item.Status = "sent";
            item.SentAt ??= DateTime.UtcNow;
            await _db.SaveAsync(item);
        }

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
            RfcMessageId = item.RfcMessageId,
            SesMessageId = item.SesMessageId,
            InternalMessageId = item.InternalMessageId,
            CreatedAt = DateTime.UtcNow
        });
        var p = await _db.LoadAsync<PartnerProspect>(item.ProspectId);
        if (p != null)
        {
            p.Status = "sent";
            p.CrmLifecycle = item.FollowUpNumber > 0 ? PartnerCrmLifecycle.FollowUp : PartnerCrmLifecycle.Contacted;
            p.EmailState = "SENT";
            p.AcquisitionStatus = PartnerCrmLifecycle.AcqSent;
            if (p.DistributionStatus is null or "" or PartnerCrmLifecycle.DistNone or PartnerCrmLifecycle.DistInviteCreated)
                p.DistributionStatus = PartnerCrmLifecycle.DistSharing;
            p.LastContactedAt = DateTime.UtcNow;
            PartnerCrmLifecycle.AppendTimelineEvent(p, "sent", "Outreach sent", DateTime.UtcNow,
                new { item.QueueId, item.FollowUpNumber });
            PartnerCrmLifecycle.NormalizeAcquisitionDimensions(p);
            await _db.SaveAsync(p);
        }

        if (item.FollowUpNumber == 0 && !string.IsNullOrWhiteSpace(item.ApprovalId))
            await ScheduleFollowUpsAsync(item, queueSnapshot);
    }

    async Task ScheduleFollowUpsAsync(PartnerQueueItem parent, List<PartnerQueueItem>? queueSnapshot = null)
    {
        var campaign = await _db.LoadAsync<PartnerCampaign>(parent.CampaignId);
        var days = campaign?.FollowUpDays?.Where(d => d > 0).Distinct().OrderBy(d => d).ToList()
            ?? new List<int> { 4, 9 };
        var max = campaign?.MaxFollowUps > 0 ? campaign.MaxFollowUps : 2;
        days = days.Take(max).ToList();
        if (days.Count == 0) return;

        var existing = queueSnapshot ?? await ListQueueAsync(null);
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
            existing.Add(followUp);
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
        var settings = await LoadSettingsAsync();
        if (settings.PauseAllOutreach) throw new InvalidOperationException("pause_all_outreach");
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
                p.AcquisitionStatus = PartnerCrmLifecycle.AcqReplied;
                PartnerCrmLifecycle.AppendTimelineEvent(p, "replied", "Inbound reply received", DateTime.UtcNow,
                    new { match.QueueId, subject = parsed.Subject });
                PartnerCrmLifecycle.NormalizeAcquisitionDimensions(p);
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
        var et = TimeZoneInfo.ConvertTimeFromUtc(PartnerOutreachRules.AsUtc(DateTime.UtcNow), PartnerOutreachRules.EasternTimeZone());
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
                if (p != null)
                {
                    p.Status = "delivered";
                    p.EmailState = "DELIVERED";
                    p.CrmLifecycle ??= PartnerCrmLifecycle.Contacted;
                    p.AcquisitionStatus = PartnerCrmLifecycle.AcqDelivered;
                }
                break;
            case "bounce":
                item.Status = "bounced";
                settings.BounceCount++;
                await _db.SaveAsync(new PartnerSuppression { Email = item.Recipient.ToLowerInvariant(), Reason = "hard_bounce" });
                if (p != null)
                {
                    p.Status = "bounced";
                    p.EmailState = "BOUNCED";
                    p.AcquisitionStatus = PartnerCrmLifecycle.AcqBounced;
                }
                break;
            case "complaint":
                item.Status = "complained";
                settings.ComplaintCount++;
                settings.ComplaintPause = true;
                await _db.SaveAsync(new PartnerSuppression { Email = item.Recipient.ToLowerInvariant(), Reason = "complaint" });
                if (p != null)
                {
                    p.Status = "complained";
                    p.EmailState = "COMPLAINED";
                    p.CrmLifecycle = PartnerCrmLifecycle.Closed;
                    p.AcquisitionStatus = PartnerCrmLifecycle.AcqRejected;
                }
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
            && x.Status is "approved" or "queued" or "draft" or "scheduled" or "approved_for_next_send"))
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
            sendEnabled = !s.PauseAllOutreach,
            complaintPause = s.ComplaintPause,
            outreachMode = s.OutreachMode,
            pauseAllOutreach = s.PauseAllOutreach,
            testRecipientsOnly = s.TestRecipientsOnly,
            adminApprovalSends = true,
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

        static bool IsRegisteredPlus(PartnerProspect p) =>
            PartnerCrmLifecycle.IsCustomerStatus(p.CustomerStatus)
            || p.ReferralSignups > 0 || p.SignupAt != null;

        var referralSignupSum = prospects.Sum(p => p.ReferralSignups);
        var registeredStatusOnly = prospects.Count(p =>
            PartnerCrmLifecycle.IsCustomerStatus(p.CustomerStatus) && p.ReferralSignups <= 0);
        var newSignups = referralSignupSum + registeredStatusOnly;
        var activatedUsers = prospects.Sum(p => p.ActivatedUsers);
        var payingCustomers = Math.Max(
            prospects.Sum(p => p.PaidCustomers),
            prospects.Count(p => p.CustomerStatus == PartnerCrmLifecycle.CustPaying || p.FirstPurchaseAt != null));
        var creditPurchases = Math.Max(prospects.Sum(p => p.PaidCustomers), payingCustomers);
        var revenueCents = prospects.Sum(p => p.DirectRevenueCents + p.AttributedRevenueCents);

        static double Rate(int num, int den) => den <= 0 ? 0d : (double)num / den;

        var discovered = prospects.Count;
        var contactable = prospects.Count(p =>
            p.AcquisitionStatus is PartnerCrmLifecycle.AcqContactable or PartnerCrmLifecycle.AcqQualified
                or PartnerCrmLifecycle.AcqDraft or PartnerCrmLifecycle.AcqAwaitingApproval
                or PartnerCrmLifecycle.AcqApproved or PartnerCrmLifecycle.AcqQueued
                or PartnerCrmLifecycle.AcqSent or PartnerCrmLifecycle.AcqDelivered
                or PartnerCrmLifecycle.AcqOpened or PartnerCrmLifecycle.AcqClicked
                or PartnerCrmLifecycle.AcqReplied or PartnerCrmLifecycle.AcqInterested
                or PartnerCrmLifecycle.AcqConverted
            || (!string.IsNullOrWhiteSpace(p.Email) && p.Email.Contains('@')));
        var approved = queue.Count(q => q.Status == "approved");
        var approvedProspects = prospects.Count(p =>
            p.AcquisitionStatus == PartnerCrmLifecycle.AcqApproved
            || p.Status == "approved"
            || string.Equals(p.EmailState, "APPROVED", StringComparison.OrdinalIgnoreCase));
        var sent = queue.Count(q => q.Status is "sent" or "delivered");
        var sentProspects = prospects.Count(p =>
            p.AcquisitionStatus is PartnerCrmLifecycle.AcqSent or PartnerCrmLifecycle.AcqDelivered
                or PartnerCrmLifecycle.AcqOpened or PartnerCrmLifecycle.AcqClicked
                or PartnerCrmLifecycle.AcqReplied or PartnerCrmLifecycle.AcqInterested
                or PartnerCrmLifecycle.AcqConverted
            || p.Status is "sent" or "delivered" or "replied");
        var clicked = prospects.Count(p =>
            p.AcquisitionStatus is PartnerCrmLifecycle.AcqClicked or PartnerCrmLifecycle.AcqConverted
            || p.ReferralSignups > 0 || IsRegisteredPlus(p));
        var signedUp = prospects.Count(IsRegisteredPlus);
        var activated = prospects.Count(p =>
            p.CustomerStatus is PartnerCrmLifecycle.CustActivated or PartnerCrmLifecycle.CustPaying
            || p.ActivatedUsers > 0 || p.ActivatedAt != null);
        var buyers = prospects.Count(p =>
            p.CustomerStatus == PartnerCrmLifecycle.CustPaying
            || p.PaidCustomers > 0 || p.FirstPurchaseAt != null || p.DirectRevenueCents > 0);

        // Legacy funnel fields retained for older admin UI
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
            || p.Status == "replied"
            || p.AcquisitionStatus == PartnerCrmLifecycle.AcqReplied);
        var interested = prospects.Count(p =>
            p.CrmLifecycle == PartnerCrmLifecycle.Interested
            || p.PartnershipStatus == PartnerCrmLifecycle.PartInterested
            || p.AcquisitionStatus == PartnerCrmLifecycle.AcqInterested);
        var partners = prospects.Count(p =>
            p.CrmLifecycle == PartnerCrmLifecycle.Partner
            || p.PartnershipStatus == PartnerCrmLifecycle.PartPartner);
        var drafts = queue.Count(q => q.Status == "draft" && q.FollowUpNumber == 0);
        var awaitingApproval = queue.Count(q => q.Status == "draft");
        var scheduled = queue.Count(q => q.Status == "scheduled");
        var contactNeeded = prospects.Count(p =>
            p.AcquisitionStatus == PartnerCrmLifecycle.AcqContactNeeded
            || p.ContactState == PartnerCrmLifecycle.ContactNeeded
            || p.Status == "no_verified_public_email"
            || string.IsNullOrWhiteSpace(p.Email) || !p.Email.Contains('@'));

        var todayEt = PartnerOutreachRules.EasternNowDate();
        var dueFollowUps = queue.Count(q =>
            q.Status == "scheduled" && q.FollowUpNumber > 0
            && (q.ScheduledAt == null || PartnerOutreachRules.ToEasternDate(q.ScheduledAt.Value) <= todayEt));

        return new
        {
            northStars = new
            {
                newSignups,
                activatedUsers,
                payingCustomers,
                creditPurchases,
                revenueCents,
                // backward-compatible aliases
                customersAcquired = payingCustomers,
                activeUsersAcquired = activatedUsers,
                revenueAttributedCents = revenueCents,
                referralSignups = referralSignupSum,
            },
            funnel = new
            {
                discovered,
                contactable,
                approved = Math.Max(approved, approvedProspects),
                sent = Math.Max(sent, sentProspects),
                clicked,
                signedUp,
                activated,
                buyers,
                revenue = revenueCents,
                // legacy keys
                qualified,
                contactNeeded,
                drafts,
                awaitingApproval,
                scheduled,
                contacted,
                replied,
                interested,
                partners,
            },
            conversionRates = new
            {
                discoveredToContactable = Rate(contactable, discovered),
                contactableToApproved = Rate(Math.Max(approved, approvedProspects), contactable),
                approvedToSent = Rate(Math.Max(sent, sentProspects), Math.Max(approved, approvedProspects) + Math.Max(sent, sentProspects)),
                sentToClicked = Rate(clicked, Math.Max(sent, sentProspects)),
                clickedToSignedUp = Rate(signedUp, Math.Max(clicked, 1)),
                signedUpToActivated = Rate(activated, signedUp),
                activatedToBuyers = Rate(buyers, activated),
                // legacy
                discoveredToQualified = Rate(qualified, discovered),
                qualifiedToContacted = Rate(contacted, qualified),
                contactedToReplied = Rate(replied, contacted),
                repliedToInterested = Rate(interested, replied),
                interestedToPartner = Rate(partners, interested),
                draftToApproved = Rate(approved, drafts + approved),
            },
            todaysActions = new object[]
            {
                new { key = "need_contact_research", label = "Research contacts", count = contactNeeded, filter = "acquisitionStatus=CONTACT_NEEDED" },
                new { key = "awaiting_approval", label = "Approve drafts", count = awaitingApproval, filter = "status=draft" },
                new { key = "approved_ready", label = "Approved ready to send", count = approved, filter = "status=approved" },
                new { key = "replies", label = "Replies to handle", count = replied, filter = "acquisitionStatus=REPLIED" },
                new { key = "follow_ups", label = "Due follow-ups", count = dueFollowUps, filter = "status=scheduled" },
            },
            settings = new
            {
                settings.OutreachMode,
                settings.PauseAllOutreach,
                settings.ComplaintPause,
                settings.TestRecipientsOnly,
                adminApprovalSends = true,
                sendEnabled = !settings.PauseAllOutreach,
            },
        };
    }

    public async Task<object> ListAcquisitionCustomersAsync()
    {
        var prospects = await ListProspectsAsync(null);
        var customers = prospects
            .Where(p =>
                PartnerCrmLifecycle.IsCustomerStatus(p.CustomerStatus)
                || p.ReferralSignups > 0
                || p.PaidCustomers > 0
                || p.DirectRevenueCents > 0)
            .OrderByDescending(p => p.FirstPurchaseAt ?? p.ActivatedAt ?? p.SignupAt ?? p.CreatedAt)
            .Select(p => new
            {
                p.ProspectId,
                p.OrganizationName,
                entityType = p.EntityType ?? PartnerCrmLifecycle.EntityOrganization,
                prospectType = p.ProspectType,
                source = p.DiscoverySource ?? p.EmailSource,
                campaignId = p.CampaignId,
                partnerCode = p.PartnerCode,
                customerStatus = p.CustomerStatus,
                acquisitionStatus = p.AcquisitionStatus,
                distributionStatus = p.DistributionStatus,
                partnershipStatus = p.PartnershipStatus,
                signupAt = p.SignupAt,
                activatedAt = p.ActivatedAt,
                firstPurchaseAt = p.FirstPurchaseAt,
                referralSignups = p.ReferralSignups,
                activatedUsers = p.ActivatedUsers,
                paidCustomers = p.PaidCustomers,
                directRevenueCents = p.DirectRevenueCents,
                attributedRevenueCents = p.AttributedRevenueCents,
                revenueCents = p.DirectRevenueCents + p.AttributedRevenueCents,
                country = p.Country,
                metro = p.Metro,
                city = p.City,
            })
            .ToList();
        return new { count = customers.Count, customers };
    }

    public async Task<object> GetProspectDetailAsync(string prospectId)
    {
        var p = await _db.LoadAsync<PartnerProspect>(prospectId) ?? throw new KeyNotFoundException("Prospect not found");
        PartnerCrmLifecycle.NormalizeAcquisitionDimensions(p);
        var queue = (await ListQueueAsync(null))
            .Where(q => string.Equals(q.ProspectId, prospectId, StringComparison.Ordinal))
            .OrderByDescending(q => q.CreatedAt)
            .ToList();
        var draftOrApproved = queue
            .Where(q => q.FollowUpNumber == 0 && q.Status is "draft" or "approved" or "queued" or "sent" or "delivered" or "replied")
            .OrderByDescending(q => PartnerOutreachDedupe.QueueRank(q.Status))
            .ThenByDescending(q => q.CreatedAt)
            .FirstOrDefault();
        var nextAction = PartnerCrmLifecycle.ComputeNextAction(p, draftOrApproved);
        var timeline = PartnerCrmLifecycle.ParseTimeline(p);
        return new
        {
            prospect = p,
            nextAction,
            timeline,
            queueItems = queue,
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
            s.TestRecipientsOnly,
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
            adminApprovalSends = true,
            sendEnabled = !s.PauseAllOutreach,
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
        s.TestRecipientsOnly = patch.TestRecipientsOnly;
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
        // Partnership only — does not convert customer status.
        p.CrmLifecycle = PartnerCrmLifecycle.Partner;
        p.Status = "partner";
        p.PartnershipStatus = PartnerCrmLifecycle.PartPartner;
        PartnerCrmLifecycle.AppendTimelineEvent(p, "partner", "Marked as partner (partnership only)", DateTime.UtcNow);
        PartnerCrmLifecycle.NormalizeAcquisitionDimensions(p);
        await _db.SaveAsync(p);
        await TryAuditAsync(actor, "partner_outreach.convert_partner", "partner_prospect", prospectId, null,
            new { p.CrmLifecycle, p.PartnershipStatus });
        return new { p.ProspectId, p.CrmLifecycle, p.Status, p.PartnershipStatus, note = "partnership_only" };
    }

    public async Task<object> MarkInterestedAsync(string prospectId, string actor)
    {
        var p = await _db.LoadAsync<PartnerProspect>(prospectId) ?? throw new KeyNotFoundException("Prospect not found");
        p.CrmLifecycle = PartnerCrmLifecycle.Interested;
        p.Status = "interested";
        p.PartnershipStatus = PartnerCrmLifecycle.PartInterested;
        p.AcquisitionStatus = PartnerCrmLifecycle.AcqInterested;
        PartnerCrmLifecycle.AppendTimelineEvent(p, "interested", "Marked interested (partnership)", DateTime.UtcNow);
        PartnerCrmLifecycle.NormalizeAcquisitionDimensions(p);
        await _db.SaveAsync(p);
        await TryAuditAsync(actor, "partner_outreach.mark_interested", "partner_prospect", prospectId, null,
            new { p.CrmLifecycle, p.PartnershipStatus, p.AcquisitionStatus });
        return new { p.ProspectId, p.CrmLifecycle, p.Status, p.PartnershipStatus, p.AcquisitionStatus };
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
        if (row.MinAcquisitionScore <= 0) row.MinAcquisitionScore = PartnerOutreachRules.DefaultMinAcquisitionScore;
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
            p.AcquisitionStatus = PartnerCrmLifecycle.AcqContactable;
            PartnerCrmLifecycle.AppendTimelineEvent(p, "contact_found", "Public contact verified", DateTime.UtcNow,
                new { p.Email, p.ContactSourceUrl });
            PartnerCrmLifecycle.NormalizeAcquisitionDimensions(p);
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

    public async Task<object> ResearchContactsBulkAsync(IEnumerable<string> prospectIds, string actor, int max = 20, bool force = false)
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
                results.Add(await ResearchContactAsync(id, actor, force));
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

    public async Task<object> RecordPartnerAttributionAsync(string partnerOrRefCode, string eventType, long? revenueCents = null, bool isDirectCustomer = false)
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
                p.CustomerStatus = PartnerCrmLifecycle.CustRegistered;
                p.SignupAt ??= DateTime.UtcNow;
                p.AcquisitionStatus = PartnerCrmLifecycle.AcqConverted;
                p.DistributionStatus = PartnerCrmLifecycle.DistActiveSource;
                PartnerCrmLifecycle.AppendTimelineEvent(p, "signup", "Customer registered", DateTime.UtcNow,
                    new { isDirectCustomer });
                break;
            case "activated":
                p.ActivatedUsers++;
                p.CustomerStatus = PartnerCrmLifecycle.CustActivated;
                p.ActivatedAt ??= DateTime.UtcNow;
                p.AcquisitionStatus = PartnerCrmLifecycle.AcqConverted;
                p.DistributionStatus = PartnerCrmLifecycle.DistActiveSource;
                PartnerCrmLifecycle.AppendTimelineEvent(p, "activated", "Customer activated", DateTime.UtcNow,
                    new { isDirectCustomer });
                break;
            case "paid":
                p.PaidCustomers++;
                p.CustomerStatus = PartnerCrmLifecycle.CustPaying;
                p.FirstPurchaseAt ??= DateTime.UtcNow;
                p.AcquisitionStatus = PartnerCrmLifecycle.AcqConverted;
                p.DistributionStatus = PartnerCrmLifecycle.DistActiveSource;
                if (revenueCents is > 0)
                {
                    if (isDirectCustomer)
                        p.DirectRevenueCents += revenueCents.Value;
                    else
                        p.AttributedRevenueCents += revenueCents.Value;
                }
                PartnerCrmLifecycle.AppendTimelineEvent(p, "paid", "Paying customer", DateTime.UtcNow,
                    new { isDirectCustomer, revenueCents });
                break;
        }
        p.LastEvaluatedAt = DateTime.UtcNow;
        PartnerCrmLifecycle.NormalizeAcquisitionDimensions(p);
        await _db.SaveAsync(p);
        return new
        {
            ok = true,
            prospectId = p.ProspectId,
            partnerCode = p.PartnerCode,
            evt,
            isDirectCustomer,
            p.ReferralSignups,
            p.ActivatedUsers,
            p.PaidCustomers,
            p.AttributedRevenueCents,
            p.DirectRevenueCents,
            p.CustomerStatus,
            p.SignupAt,
            p.ActivatedAt,
            p.FirstPurchaseAt,
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

    public async Task<object> RescoreProspectAsync(string prospectId)
    {
        var p = await _db.LoadAsync<PartnerProspect>(prospectId) ?? throw new KeyNotFoundException("Prospect not found");
        ApplyScoreToProspect(p);
        await _db.SaveAsync(p);
        return new
        {
            p.ProspectId,
            p.AcquisitionScore,
            p.FitScore,
            p.AudienceFitScore,
            p.MarketRelevanceScore,
            p.CommunityFitScore,
            p.ContactQualityScore,
            p.HistoricalCategoryScore,
            p.ScoreExplanation,
            p.WhySelected,
        };
    }

    public async Task<object> RescoreLowScoreProspectsAsync(int max = 50)
    {
        if (max <= 0) max = 50;
        var queue = await ListQueueAsync(null);
        var draftOrApprovedIds = queue
            .Where(q => q.FollowUpNumber == 0 && q.Status is "draft" or "approved" or "approved_for_next_send" or "queued")
            .Select(q => q.ProspectId)
            .ToHashSet(StringComparer.Ordinal);
        var prospects = await ListProspectsAsync(null);
        var targets = prospects
            .Where(p => draftOrApprovedIds.Contains(p.ProspectId)
                && (p.AcquisitionScore == 0 || p.FitScore == 0))
            .Take(max)
            .ToList();
        var rescored = new List<object>();
        foreach (var p in targets)
        {
            ApplyScoreToProspect(p);
            await _db.SaveAsync(p);
            rescored.Add(new
            {
                p.ProspectId,
                p.OrganizationName,
                p.AcquisitionScore,
                p.FitScore,
                p.WhySelected,
            });
        }
        return new { count = rescored.Count, rescored };
    }

    public async Task<object> RegenerateObsoleteUnsentDraftsAsync(string actor, bool forceAllUnsentInitial = false)
    {
        var queue = await ListQueueAsync(null);
        var candidates = queue
            .Where(q =>
                q.FollowUpNumber == 0
                && q.SentAt == null
                && q.Status is "draft" or "approved" or "approved_for_next_send" or "queued" or "scheduled")
            .ToList();

        var found = candidates
            .Where(q => forceAllUnsentInitial
                || PartnerOutreachRules.ContainsObsoleteOutreachCopy(q.Subject, q.BodyText, q.BodyHtml)
                || !string.Equals(q.TemplateVersion, PartnerOutreachRules.TemplateVersion, StringComparison.Ordinal))
            .ToList();

        var regenerated = new List<object>();
        foreach (var item in found)
        {
            var p = await _db.LoadAsync<PartnerProspect>(item.ProspectId);
            if (p == null) continue;

            ApplyScoreToProspect(p);
            if (string.IsNullOrWhiteSpace(p.Email) || !p.Email.Contains('@'))
            {
                regenerated.Add(new
                {
                    item.QueueId,
                    p.OrganizationName,
                    regenerated = false,
                    error = "no_verified_email",
                });
                continue;
            }

            var campaignId = string.IsNullOrWhiteSpace(item.CampaignId) ? p.CampaignId : item.CampaignId;
            var landing = !string.IsNullOrWhiteSpace(item.PartnerUrl)
                ? item.PartnerUrl
                : PartnerEmailMime.AppendPartnerUtm(p.LandingUrl ?? "", campaignId, p.PartnerCode);
            var unsub = BuildUnsubUrl(p.ProspectId);
            var marketLabel = string.IsNullOrWhiteSpace(p.Metro) ? p.City : p.Metro;
            var copy = PartnerEmailMime.RenderForProspect(p, landing, unsub, Postal, marketLabel);
            var fp = PartnerOutreachRules.Fingerprint(p.Email, copy.Subject, copy.Text, landing, campaignId ?? "");

            var before = new { item.Status, item.Subject, item.ApprovalId, item.BodyText };
            item.Recipient = p.Email.Trim();
            item.OrganizationName = p.OrganizationName;
            item.Subject = copy.Subject;
            item.BodyText = copy.Text;
            item.BodyHtml = copy.Html;
            item.PartnerUrl = landing;
            item.Fingerprint = fp;
            item.TemplateVersion = PartnerOutreachRules.TemplateVersion;
            item.Status = "draft";
            item.ApprovalId = "";
            item.ApprovedAt = null;
            item.ApprovedBy = null;
            item.LastError = null;
            item.MessageVersion = Math.Max(1, item.MessageVersion) + 1;
            await _db.SaveAsync(item);

            p.Email = item.Recipient;
            p.Status = "draft";
            p.EmailState = "AWAITING_APPROVAL";
            p.AcquisitionStatus = PartnerCrmLifecycle.AcqAwaitingApproval;
            PartnerCrmLifecycle.AppendTimelineEvent(p, "draft_regenerated",
                "Obsolete outreach copy regenerated; approval invalidated", DateTime.UtcNow,
                new { item.QueueId, template = PartnerOutreachRules.TemplateVersion, actor });
            PartnerCrmLifecycle.NormalizeAcquisitionDimensions(p);
            await _db.SaveAsync(p);

            await TryAuditAsync(actor, "regenerate_obsolete_draft", "queue", item.QueueId, before,
                new { item.Status, item.Subject, item.TemplateVersion, item.MessageVersion });

            regenerated.Add(new
            {
                item.QueueId,
                p.OrganizationName,
                regenerated = true,
                status = "draft",
                acquisitionScore = p.AcquisitionScore,
                subject = item.Subject,
            });
        }

        // Normalize settings so leftover OFF mode is not the operational default.
        var settings = await LoadSettingsAsync();
        if (string.Equals(settings.OutreachMode, "off", StringComparison.OrdinalIgnoreCase))
        {
            settings.OutreachMode = "live";
            await _db.SaveAsync(settings);
        }

        return new
        {
            obsoleteUnsentFound = found.Count,
            regenerated = regenerated.Count,
            items = regenerated,
            templateVersion = PartnerOutreachRules.TemplateVersion,
            outreachModeNormalized = settings.OutreachMode,
            pauseAllOutreach = settings.PauseAllOutreach,
        };
    }

    /// <summary>
    /// Returns a needsOverride payload when score is below campaign min and override not confirmed; otherwise null.
    /// Always recalculates when AcquisitionScore is exactly 0.
    /// </summary>
    async Task<object?> EnsureAcquisitionScoreForSendAsync(PartnerProspect prospect, string campaignId, bool confirmOverride)
    {
        var campaign = !string.IsNullOrWhiteSpace(campaignId)
            ? await _db.LoadAsync<PartnerCampaign>(campaignId)
            : null;
        var minScore = campaign?.MinAcquisitionScore > 0
            ? campaign.MinAcquisitionScore
            : PartnerOutreachRules.DefaultMinAcquisitionScore;

        var recalculated = false;
        if (prospect.AcquisitionScore == 0 || prospect.FitScore == 0)
        {
            ApplyScoreToProspect(prospect);
            await _db.SaveAsync(prospect);
            recalculated = true;
        }

        if (prospect.AcquisitionScore >= minScore)
            return null;

        if (confirmOverride)
            return null;

        return new
        {
            approved = false,
            sent = false,
            needsOverride = true,
            error = "acquisition_score_below_minimum",
            acquisitionScore = prospect.AcquisitionScore,
            minAcquisitionScore = minScore,
            recalculated,
            confirmOverrideRequired = true,
        };
    }

    static void ApplyScoreToProspect(PartnerProspect p)
    {
        var hasEmail = !string.IsNullOrWhiteSpace(p.Email) && p.Email.Contains('@');
        var scored = AutomatedMarketDiscoveryService.ScoreProspect(new DiscoveredOrganization
        {
            OrganizationName = p.OrganizationName,
            OrganizationType = p.OrganizationType,
            DiscoverySource = p.DiscoverySource ?? "",
            Market = p.Metro ?? p.City ?? "",
        }, hasEmail);
        p.AcquisitionScore = scored.AcquisitionScore;
        p.AudienceFitScore = scored.AudienceFitScore;
        p.MarketRelevanceScore = scored.MarketRelevanceScore;
        p.CommunityFitScore = scored.CommunityFitScore;
        p.ContactQualityScore = scored.ContactQualityScore;
        p.ContactabilityScore = Math.Max(p.ContactabilityScore, scored.ContactQualityScore);
        p.HistoricalCategoryScore = scored.HistoricalCategoryScore;
        p.ScoreExplanation = scored.ScoreExplanation;
        p.FitScore = scored.AcquisitionScore;
        p.WhySelected = scored.ScoreExplanation;
        p.LastEvaluatedAt = DateTime.UtcNow;
        if (string.IsNullOrWhiteSpace(p.ProspectKind))
            p.ProspectKind = PartnerCrmLifecycle.NormalizeProspectKind(p.OrganizationType);
    }

    async Task<PartnerOutreachSettingsRow> LoadSettingsAsync()
    {
        var row = await _db.LoadAsync<PartnerOutreachSettingsRow>("default")
            ?? new PartnerOutreachSettingsRow();
        if (string.IsNullOrWhiteSpace(row.OutreachMode) || string.Equals(row.OutreachMode, "off", StringComparison.OrdinalIgnoreCase))
            row.OutreachMode = "live";
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
