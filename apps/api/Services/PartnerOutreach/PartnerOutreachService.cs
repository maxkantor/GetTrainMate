using Amazon.DynamoDBv2.DataModel;
using Amazon.DynamoDBv2.DocumentModel;
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
}

public sealed class PartnerOutreachService : IPartnerOutreachService
{
    private readonly IDynamoDBContext _db;
    private readonly IEmailService _email;
    private readonly IConfiguration _cfg;
    private readonly ILogger<PartnerOutreachService> _log;

    public PartnerOutreachService(
        IDynamoDBContext db,
        IEmailService email,
        IConfiguration cfg,
        ILogger<PartnerOutreachService> log)
    {
        _db = db;
        _email = email;
        _cfg = cfg;
        _log = log;
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

        var email = (prospect.Email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email))
        {
            prospect.Email = "";
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
            prospect.Status = "prospect";
            prospect.EmailVerifiedOn = DateTime.UtcNow.ToString("yyyy-MM-dd");
            try { prospect.OfficialDomain = new Uri("mailto:" + email).ToString().Contains('@') ? email.Split('@')[1] : prospect.OfficialDomain; }
            catch { /* keep provided domain */ }
            if (string.IsNullOrWhiteSpace(prospect.OfficialDomain) && email.Contains('@'))
                prospect.OfficialDomain = email.Split('@')[1];
        }
        prospect.CreatedAt = DateTime.UtcNow;
        prospect.Owner = string.IsNullOrWhiteSpace(prospect.Owner) ? actor : prospect.Owner;
        await _db.SaveAsync(prospect);
        return prospect;
    }

    public async Task<List<PartnerProspect>> ListProspectsAsync(string? status)
    {
        var all = await _db.ScanAsync<PartnerProspect>(new List<ScanCondition>()).GetRemainingAsync();
        if (!string.IsNullOrWhiteSpace(status))
            all = all.Where(p => string.Equals(p.Status, status, StringComparison.OrdinalIgnoreCase)).ToList();
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
        await _db.SaveAsync(existing);
        return existing;
    }

    public async Task<PartnerQueueItem> CreateDraftAndQueuePreviewAsync(string prospectId, string campaignId)
    {
        var p = await _db.LoadAsync<PartnerProspect>(prospectId) ?? throw new KeyNotFoundException("Prospect not found");
        if (string.IsNullOrWhiteSpace(p.Email) || !p.Email.Contains('@'))
            throw new InvalidOperationException("No verified public business email. Do not infer addresses. Prospect stays discovered until an org-controlled email is pasted.");
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
                Status = "candidate",
                Country = p.Country,
                Market = MarketCampaignCatalog.Slug(p.Metro),
                DisplayName = p.Metro,
                PrimaryMode = p.Mode,
                Timezone = p.Timezone ?? "",
                Languages = new List<string> { p.CampaignLanguage }
            };
            await _db.SaveAsync(campaign);
        }
        if (string.IsNullOrWhiteSpace(p.LandingUrl) || string.IsNullOrWhiteSpace(p.PartnerCode))
            throw new InvalidOperationException("Partner landing URL and code are required.");
        var unsub = BuildUnsubUrl(p.ProspectId);
        var marketLabel = string.IsNullOrWhiteSpace(p.Metro) ? p.City : p.Metro;
        var copy = PartnerEmailMime.RenderDefault(p.OrganizationName, p.LandingUrl, p.PartnerCode, unsub, Postal, marketLabel, p.CampaignLanguage);
        var fp = PartnerOutreachRules.Fingerprint(p.Email, copy.Subject, copy.Text, p.LandingUrl, campaignId);
        var item = new PartnerQueueItem
        {
            ProspectId = p.ProspectId,
            CampaignId = campaignId,
            Recipient = p.Email,
            OrganizationName = p.OrganizationName,
            Subject = copy.Subject,
            BodyText = copy.Text,
            BodyHtml = copy.Html,
            PartnerUrl = p.LandingUrl,
            Fingerprint = fp,
            Status = "draft"
        };
        await _db.SaveAsync(item);
        p.Status = "draft";
        await _db.SaveAsync(p);
        return item;
    }

    public async Task<PartnerApproval> ApproveAsync(string queueId, string approver, bool confirm)
    {
        if (!confirm) throw new InvalidOperationException("Explicit confirmation is required.");
        var item = await _db.LoadAsync<PartnerQueueItem>(queueId) ?? throw new KeyNotFoundException("Queue item not found");
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
        await _db.SaveAsync(item);
        var p = await _db.LoadAsync<PartnerProspect>(item.ProspectId);
        if (p != null) { p.Status = "approved"; await _db.SaveAsync(p); }
        return approval;
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
        var tz = PartnerOutreachRules.EasternTimeZone();
        var now = DateTime.UtcNow;
        if (!PartnerOutreachRules.IsDispatchWindow(now, tz))
            return new { sent = 0, error = "outside_dispatch_window" };

        var approved = (await ListQueueAsync("approved")).OrderBy(x => x.CreatedAt).ToList();
        var sent = 0;
        var skippedUnsub = 0;
        var errors = new List<string>();
        var usedEmails = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var usedOrgs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in approved)
        {
            if (sent >= DailyLimit)
                break;
            var emailKey = item.Recipient.Trim().ToLowerInvariant();
            if (usedEmails.Contains(emailKey) || usedOrgs.Contains(item.OrganizationName.Trim()))
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
        var orgDup = all.Any(x =>
            x.QueueId != item.QueueId
            && string.Equals(x.OrganizationName, item.OrganizationName, StringComparison.OrdinalIgnoreCase)
            && x.Status is "sent" or "delivered" or "replied");
        var recent = all.Any(x =>
            string.Equals(x.Recipient, item.Recipient, StringComparison.OrdinalIgnoreCase)
            && x.SentAt != null
            && x.SentAt > DateTime.UtcNow.AddDays(-PartnerOutreachRules.MinContactGapDays));
        var todayEt = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, PartnerOutreachRules.EasternTimeZone()).Date;
        var sentToday = all.Count(x => x.SentAt != null && TimeZoneInfo.ConvertTimeFromUtc(x.SentAt.Value, PartnerOutreachRules.EasternTimeZone()).Date == todayEt);
        var current = PartnerOutreachRules.Fingerprint(item.Recipient, item.Subject, item.BodyText, item.PartnerUrl, item.CampaignId);
        var bounceRate = settings.SentCount > 20 && settings.BounceCount / (double)settings.SentCount > 0.08;
        return new PartnerSendContext
        {
            SendEnabled = SendEnabled,
            ScheduledCursorAutomation = scheduled,
            PostalAddress = Postal,
            FromEmail = FromEmail,
            ReplyToEmail = ReplyTo,
            ComplaintPause = settings.ComplaintPause,
            Approved = !string.IsNullOrWhiteSpace(item.ApprovalId),
            ApprovalFingerprint = item.Fingerprint,
            CurrentFingerprint = current,
            OptedOut = suppress != null && suppress.Reason is "opt_out" or "unsubscribe" or "list_unsubscribe",
            Complained = suppress?.Reason == "complaint",
            HardBounced = suppress?.Reason is "hard_bounce" or "bounce",
            DuplicateOrganizationInitial = orgDup,
            AlreadySentThisRecipient = all.Any(x =>
                x.QueueId != item.QueueId
                && string.Equals(x.Recipient, item.Recipient, StringComparison.OrdinalIgnoreCase)
                && x.Status is "sent" or "delivered" or "replied" or "queued"),
            RecentlyContacted = recent,
            AlreadyQueuedOrSentSameRecipient = all.Any(x =>
                x.QueueId != item.QueueId
                && string.Equals(x.Recipient, item.Recipient, StringComparison.OrdinalIgnoreCase)
                && x.Status is "sent" or "queued" or "delivered" or "replied"),
            SentToday = sentToday,
            DailyLimit = DailyLimit,
            UnsafeBounceHealth = bounceRate
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
            p.LastContactedAt = DateTime.UtcNow;
            await _db.SaveAsync(p);
        }
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
        switch (eventType.ToLowerInvariant())
        {
            case "delivery":
                item.Status = "delivered";
                break;
            case "bounce":
                item.Status = "bounced";
                settings.BounceCount++;
                await _db.SaveAsync(new PartnerSuppression { Email = item.Recipient.ToLowerInvariant(), Reason = "hard_bounce" });
                break;
            case "complaint":
                item.Status = "complained";
                settings.ComplaintCount++;
                settings.ComplaintPause = true;
                await _db.SaveAsync(new PartnerSuppression { Email = item.Recipient.ToLowerInvariant(), Reason = "complaint" });
                break;
            case "reject":
            case "rendering failure":
                item.Status = "failed";
                break;
            case "delivery delay":
                item.Status = "deferred";
                break;
        }
        await _db.SaveAsync(item);
        await _db.SaveAsync(settings);
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
            maxActiveMarkets = MarketCampaignCatalog.MaxActiveMarkets,
            approvedOutreachLanguages = MarketCampaignCatalog.ApprovedOutreachLanguages,
            pendingOutreachLanguages = MarketCampaignCatalog.PendingOutreachLanguages
        };
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
                Status = seed.Status,
                PrimaryMode = seed.PrimaryMode,
                Timezone = seed.Timezone,
                Languages = seed.Languages.ToList()
            };
        }
        return byId.Values
            .OrderBy(c => c.Status == "active" ? 0 : c.Status == "paused" ? 1 : 2)
            .ThenBy(c => c.DisplayName)
            .ToList();
    }

    public async Task<PartnerCampaign> SetCampaignStatusAsync(string campaignId, string status)
    {
        status = (status ?? "").Trim().ToLowerInvariant();
        if (status is not ("active" or "paused" or "candidate"))
            throw new InvalidOperationException("Status must be active, paused, or candidate.");
        var all = await ListCampaignsAsync();
        var active = all.Count(c => c.Status == "active" && !string.Equals(c.CampaignId, campaignId, StringComparison.OrdinalIgnoreCase));
        if (status == "active" && active >= MarketCampaignCatalog.MaxActiveMarkets)
            throw new InvalidOperationException($"At most {MarketCampaignCatalog.MaxActiveMarkets} markets can be active.");
        var row = await _db.LoadAsync<PartnerCampaign>(campaignId)
            ?? all.FirstOrDefault(c => string.Equals(c.CampaignId, campaignId, StringComparison.OrdinalIgnoreCase))
            ?? throw new KeyNotFoundException("Campaign not found");
        row.CampaignId = campaignId;
        row.Status = status;
        await _db.SaveAsync(row);
        return row;
    }

    public async Task<object> DiscoverAsync(string? country, string? market, string? language, string? mode)
    {
        country = MarketCampaignCatalog.Slug(country);
        market = MarketCampaignCatalog.Slug(market);
        mode = string.IsNullOrWhiteSpace(mode) ? "TRAIN" : mode.Trim().ToUpperInvariant();
        if (mode != "TRAIN")
            return new
            {
                created = Array.Empty<object>(),
                skipped = 0,
                note = "First partner campaign is TRAIN only. VIBE and DATE stay available in the app but are not mixed into this outreach campaign."
            };

        var targets = MarketCampaignCatalog.Candidates.AsEnumerable();
        if (!string.IsNullOrWhiteSpace(country) || !string.IsNullOrWhiteSpace(market))
        {
            targets = targets.Where(c =>
                (string.IsNullOrWhiteSpace(country) || c.Country == country)
                && (string.IsNullOrWhiteSpace(market) || c.Market == market));
        }

        var created = new List<object>();
        var skipped = 0;
        var notes = new List<string>();
        var existing = await ListProspectsAsync(null);

        foreach (var campaign in targets)
        {
            if (campaign.Country == "us" && campaign.Market == "atlanta")
            {
                foreach (var org in MarketCampaignCatalog.AtlantaTrainOrgWebsites)
                {
                    if (existing.Any(p =>
                            string.Equals(p.PartnerCode, org.PartnerCode, StringComparison.OrdinalIgnoreCase)
                            || string.Equals(p.Website, org.Website, StringComparison.OrdinalIgnoreCase)))
                    {
                        skipped++;
                        continue;
                    }
                    var row = await CreateProspectAsync(new PartnerProspect
                    {
                        OrganizationName = org.OrganizationName,
                        OrganizationType = org.OrganizationType,
                        Website = org.Website,
                        SourceUrl = org.Website,
                        PartnerCode = org.PartnerCode,
                        Country = "us",
                        City = "Atlanta",
                        Metro = "Atlanta",
                        Timezone = campaign.Timezone,
                        PrimaryLanguage = "en",
                        CampaignLanguage = "en",
                        Mode = "TRAIN",
                        CampaignId = campaign.CampaignId,
                        LandingUrl = "https://gettrainmate.com" + MarketCampaignCatalog.PartnerPath("us", "atlanta", org.PartnerCode),
                        Email = "",
                        EmailSource = "public_listing"
                    }, "discovery");
                    created.Add(new { row.ProspectId, row.OrganizationName, row.Website, row.Status, campaign = campaign.CampaignId });
                }
                notes.Add("Atlanta: website-only identities. Paste public business emails before queueing.");
            }
            else
            {
                notes.Add($"{campaign.DisplayName}: no verified org catalog yet — add prospects manually from official websites.");
            }
        }

        if (!targets.Any())
            notes.Add("No matching market campaign. Use country + market slugs from the campaign list.");

        return new
        {
            created,
            skipped,
            country = string.IsNullOrWhiteSpace(country) ? null : country,
            market = string.IsNullOrWhiteSpace(market) ? null : market,
            language,
            mode,
            note = string.Join(" ", notes) + " Emails are never inferred."
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
        return await _db.LoadAsync<PartnerOutreachSettingsRow>("default")
            ?? new PartnerOutreachSettingsRow();
    }
}
