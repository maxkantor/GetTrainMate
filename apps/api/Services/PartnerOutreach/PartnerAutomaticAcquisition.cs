using Amazon.DynamoDBv2.DataModel;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Microsoft.Extensions.DependencyInjection;

namespace GetTrainMate.Api.Services.PartnerOutreach;

public sealed partial class PartnerOutreachService
{
    public const string Partner001Id = "PARTNER-001";

    public async Task<object> BootstrapProductionCampaignAsync()
    {
        var settings = await LoadSettingsAsync();
        var campaign = await EnsurePartner001Async();
        return new
        {
            ok = true,
            campaignId = campaign.CampaignId,
            name = campaign.Name,
            enabled = campaign.Status == "active",
            automatic = settings.AutomaticSending,
            dryRun = settings.DryRun,
            dailyLimit = settings.DailyLimit,
            autoDiscoverProspects = settings.AutoDiscoverProspects,
            autoDiscoverContacts = settings.AutoDiscoverContacts,
            autoPrepareMessages = settings.AutoPrepareMessages,
            followUpsEnabled = settings.FollowUpsEnabled,
            sendQualifiedAutomatically = settings.SendQualifiedAutomatically,
        };
    }

    public async Task<string> WhyNotSentAsync(string prospectId)
    {
        var p = await _db.LoadAsync<PartnerProspect>(prospectId);
        if (p == null) return WhyNotSent.DiscoveryPending;
        var settings = await LoadSettingsAsync();
        var queue = await ListQueueAsync(null);
        var email = (p.Email ?? "").Trim().ToLowerInvariant();
        var suppress = string.IsNullOrWhiteSpace(email) ? null : await _db.LoadAsync<PartnerSuppression>(email);
        var alreadySent = queue.Any(q =>
            string.Equals(q.ProspectId, prospectId, StringComparison.Ordinal)
            && (q.SentAt != null || q.Status is "sent" or "delivered" or "replied"));
        var hasDraft = queue.Any(q =>
            string.Equals(q.ProspectId, prospectId, StringComparison.Ordinal)
            && q.FollowUpNumber == 0
            && q.Status is "draft" or "approved" or "approved_for_next_send");
        var reason = suppress?.Reason ?? "";
        return WhyNotSent.ForProspect(
            new PartnerProspectState
            {
                HasUsableEmail = ContactDiscoveryRules.HasUsableEmail(p),
                ContactDiscoveryStatus = p.ContactDiscoveryStatus,
                EmailVerificationStatus = p.EmailVerificationStatus,
            },
            hasDraft,
            alreadySent,
            reason is "opt_out" or "unsubscribe" or "list_unsubscribe",
            reason is "hard_bounce" or "bounce",
            reason == "complaint",
            reason is "manual" or "owner",
            settings.AutomaticSending && settings.SendQualifiedAutomatically,
            settings.DryRun,
            settings.PauseAllOutreach || settings.ComplaintPause,
            p.QualificationScore > 0 ? p.QualificationScore : p.AcquisitionScore,
            PartnerOutreachRules.DefaultMinAcquisitionScore);
    }

    public async Task<object> RunAutomaticAcquisitionAsync(string actor, bool? dryRunOverride = null)
    {
        var started = DateTime.UtcNow;
        var deadline = started.AddSeconds(45);
        var settings = await LoadSettingsAsync();
        var campaign = await EnsurePartner001Async();
        var dryRun = dryRunOverride ?? settings.DryRun;

        var prospectsEvaluated = 0;
        var newProspects = 0;
        var publicContacts = 0;
        var validContacts = 0;
        var qualified = 0;
        var draftsPrepared = 0;
        var sesAttempted = 0;
        var sesAccepted = 0;
        var sesRejected = 0;
        var skipped = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        void Skip(string reason)
        {
            skipped[reason] = skipped.TryGetValue(reason, out var n) ? n + 1 : 1;
        }

        SesSendQuota? quota = null;
        try { quota = await _email.GetSendQuotaAsync(); } catch { /* optional */ }

        var queue = await ListQueueAsync(null);
        var todayEt = PartnerOutreachRules.EasternNowDate();
        var sentToday = queue.Count(q => q.SentAt != null && PartnerOutreachRules.ToEasternDate(q.SentAt.Value) == todayEt);
        var campaignRemaining = Math.Max(0, settings.DailyLimit - sentToday);
        var sesRemaining = quota != null ? (int)Math.Floor(quota.Remaining24Hours) : int.MaxValue;
        var remaining = Math.Min(campaignRemaining, sesRemaining);

        object? discovery = null;
        object? contacts = null;

        if (settings.AutoDiscoverContacts && DateTime.UtcNow < deadline)
        {
            try
            {
                contacts = await ResearchContactNeededBatchAsync(settings.ResearchContactsPerRun, actor);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Automatic contact discovery failed");
            }
        }

        if (settings.AutoDiscoverProspects && DateTime.UtcNow < deadline)
        {
            try
            {
                var discoverySvc = _services.GetRequiredService<AutomatedMarketDiscoveryService>();
                var maxProspects = Math.Min(Math.Max(settings.ProspectsPerRun, 8), 20);
                if (settings.KeepPipelineFull)
                {
                    var pipelineNow = await GetPipelineCountersAsync();
                    var eligible = pipelineNow.GetType().GetProperty("eligibleUnsent")?.GetValue(pipelineNow) is int e
                        ? e
                        : 0;
                    var target = settings.TargetProspectInventory > 0 ? settings.TargetProspectInventory : 200;
                    var deficit = Math.Max(0, target - eligible);
                    if (deficit > 0)
                        maxProspects = Math.Max(maxProspects, Math.Min(deficit, 40));
                }
                var report = await discoverySvc.RunLimitedAsync(
                    maxProspects: maxProspects,
                    maxResearchAttempts: settings.ResearchAttemptsPerRun,
                    maxDrafts: settings.DraftsPerRun,
                    prepareDrafts: settings.AutoPrepareMessages);
                discovery = report;
                newProspects = report.OrganizationsDiscovered;
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Automatic prospect discovery failed");
            }
        }

        var prospects = await ListProspectsAsync(null);
        prospectsEvaluated = prospects.Count;
        queue = await ListQueueAsync(null);

        foreach (var p in prospects)
        {
            if (ContactDiscoveryRules.HasUsableEmail(p))
            {
                publicContacts++;
                validContacts++;
                var score = p.QualificationScore > 0 ? p.QualificationScore : p.AcquisitionScore;
                if (score >= PartnerOutreachRules.DefaultMinAcquisitionScore)
                {
                    qualified++;
                    if (p.QualifiedAt == null)
                    {
                        p.QualificationScore = score;
                        p.QualificationReasons = p.ScoreExplanation ?? p.WhySelected;
                        p.QualifiedAt = DateTime.UtcNow;
                        p.EmailNormalized = (p.Email ?? "").Trim().ToLowerInvariant();
                        await _db.SaveAsync(p);
                    }
                }
            }
        }

        if (settings.AutoPrepareMessages && DateTime.UtcNow < deadline)
        {
            var unsent = prospects.Where(p =>
                ContactDiscoveryRules.HasUsableEmail(p)
                && (p.QualificationScore >= PartnerOutreachRules.DefaultMinAcquisitionScore
                    || p.AcquisitionScore >= PartnerOutreachRules.DefaultMinAcquisitionScore)
                && p.LastContactedAt == null
                && !queue.Any(q =>
                    string.Equals(q.ProspectId, p.ProspectId, StringComparison.Ordinal)
                    && q.FollowUpNumber == 0)).Take(settings.DraftsPerRun).ToList();
            foreach (var p in unsent)
            {
                if (DateTime.UtcNow >= deadline) break;
                try
                {
                    await CreateDraftAndQueuePreviewAsync(p.ProspectId, p.CampaignId ?? campaign.CampaignId);
                    draftsPrepared++;
                }
                catch (Exception ex)
                {
                    Skip(ex.Message);
                    _log.LogDebug(ex, "Draft prepare skipped {Id}", p.ProspectId);
                }
            }
            queue = await ListQueueAsync(null);
        }

        var sendable = queue
            .Where(q => q.FollowUpNumber == 0 && q.Status is "draft" or "approved" or "approved_for_next_send")
            .OrderBy(q => q.CreatedAt)
            .ToList();

        if (!settings.AutomaticSending || !settings.SendQualifiedAutomatically)
        {
            foreach (var _ in sendable) Skip(WhyNotSent.ManualApprovalRequired);
        }
        else if (settings.PauseAllOutreach || settings.ComplaintPause)
        {
            foreach (var _ in sendable) Skip(WhyNotSent.SafetyPaused);
        }
        else
        {
            foreach (var item in sendable)
            {
                if (DateTime.UtcNow >= deadline) break;
                if (remaining <= 0)
                {
                    Skip(sesRemaining <= 0 ? WhyNotSent.SesQuotaReached : WhyNotSent.DailyLimitReached);
                    continue;
                }

                var gate = await BuildGateAsync(item, settings, scheduled: false);
                gate.AutomaticQualifiedSend = true;
                gate.DryRun = dryRun;
                gate.SesQuotaExhausted = quota != null && quota.Remaining24Hours < 1;
                var code = PartnerOutreachRules.EvaluateSendGate(gate);
                if (code != null)
                {
                    Skip(WhyNotSent.FromGateCode(code, gate));
                    continue;
                }

                if (dryRun)
                {
                    Skip(WhyNotSent.DryRun);
                    continue;
                }

                try
                {
                    if (string.IsNullOrWhiteSpace(item.ApprovalId))
                        await StampAutomaticApprovalAsync(item, actor);
                    sesAttempted++;
                    await SendQueueItemAsync(item);
                    sesAccepted++;
                    remaining--;
                    settings.SentCount++;
                    await _db.SaveAsync(settings);
                }
                catch (Exception ex)
                {
                    sesRejected++;
                    Skip("SES_ERROR");
                    item.Status = "failed";
                    item.LastError = "send_failed";
                    await _db.SaveAsync(item);
                    _log.LogError(ex, "Automatic send failed {Id}", item.QueueId);
                }
            }
        }

        object? followUps = null;
        if (settings.FollowUpsEnabled && !dryRun && DateTime.UtcNow < deadline)
        {
            followUps = await DispatchDueAsync(scheduledCursorAutomation: false);
        }

        var counters = await GetPipelineCountersAsync();
        return new
        {
            ok = true,
            dryRun,
            automatic = settings.AutomaticSending,
            dailyLimit = settings.DailyLimit,
            sentToday,
            remaining = Math.Max(0, remaining),
            campaignRemaining,
            ses = new
            {
                tracked = quota != null,
                remaining = quota == null ? (int?)null : sesRemaining,
                max24HourSend = quota?.Max24HourSend,
                sentLast24Hours = quota?.SentLast24Hours,
            },
            discovery = new
            {
                prospectsEvaluated,
                newProspects,
                publicContactsFound = publicContacts,
                validContacts,
                qualified,
                draftsPrepared,
                raw = discovery,
                contactResearch = contacts,
            },
            sending = new { sesAttempted, sesAccepted, sesRejected },
            skipped,
            followUps,
            pipeline = counters,
            elapsedMs = (int)(DateTime.UtcNow - started).TotalMilliseconds,
        };
    }

    async Task<PartnerCampaign> EnsurePartner001Async()
    {
        var row = await _db.LoadAsync<PartnerCampaign>(Partner001Id);
        if (row == null)
        {
            row = new PartnerCampaign
            {
                CampaignId = Partner001Id,
                Name = "GetTrainMate Partner Acquisition",
                DisplayName = "GetTrainMate Partner Acquisition",
                Status = "active",
                Country = "us",
                Market = "multi",
                PrimaryMode = "CROSS_MODE",
                Timezone = "America/New_York",
                Languages = new List<string> { "en", "es", "ru" },
                DailyOutreachLimit = 100,
                DailyDiscoveryLimit = 40,
                SendingMode = "automatic",
                SendQualifiedAutomatically = true,
                AutoDiscoverProspects = true,
                AutoDiscoverContacts = true,
                AutoPrepareMessages = true,
                FollowUpsEnabled = true,
                MinAcquisitionScore = PartnerOutreachRules.DefaultMinAcquisitionScore,
                FollowUpDays = new List<int> { 4, 9 },
                MaxFollowUps = 2,
                UtmSource = "partner_outreach",
                UtmMedium = "email",
                UtmCampaign = Partner001Id,
            };
            await _db.SaveAsync(row);
        }
        else
        {
            var dirty = false;
            if (row.Status != "active") { row.Status = "active"; dirty = true; }
            if (row.DailyOutreachLimit < 100) { row.DailyOutreachLimit = 100; dirty = true; }
            if (!string.Equals(row.SendingMode, "automatic", StringComparison.OrdinalIgnoreCase))
            {
                row.SendingMode = "automatic";
                dirty = true;
            }
            row.SendQualifiedAutomatically = true;
            row.AutoDiscoverProspects = true;
            row.AutoDiscoverContacts = true;
            row.AutoPrepareMessages = true;
            row.FollowUpsEnabled = true;
            if (dirty) await _db.SaveAsync(row);
        }
        return row;
    }

    async Task StampAutomaticApprovalAsync(PartnerQueueItem item, string actor)
    {
        var approval = new PartnerApproval
        {
            CampaignId = item.CampaignId,
            ProspectId = item.ProspectId,
            Recipient = item.Recipient,
            Subject = item.Subject,
            BodyText = item.BodyText,
            PartnerUrl = item.PartnerUrl,
            Fingerprint = item.Fingerprint,
            TemplateVersion = item.TemplateVersion,
            Approver = string.IsNullOrWhiteSpace(actor) ? "automatic" : actor,
            Status = "automatic",
        };
        await _db.SaveAsync(approval);
        item.ApprovalId = approval.ApprovalId;
        item.ApprovedBy = approval.Approver;
        item.ApprovedAt = DateTime.UtcNow;
        item.Status = "approved";
        await _db.SaveAsync(item);
    }
}
