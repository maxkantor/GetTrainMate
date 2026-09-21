using System.Security.Cryptography;
using System.Text;

namespace GetTrainMate.Api.Services.PartnerOutreach;

public static class PartnerOutreachRules
{
    public const int DefaultDailyLimit = 3;
    public const int MinContactGapDays = 14;
    public const string PartnerFromEmail = "partners@gettrainmate.com";
    public const string PartnerFromName = "Max from GetTrainMate";
    public const string TemplateVersion = "partner-v3-2026-08-14";

    public static readonly string[] MojibakeMarkers = { "Â", "â€™", "â€œ", "â€", "â†’" };

    public static string Fingerprint(string recipient, string subject, string bodyText, string partnerUrl, string campaignId)
    {
        var canonical = string.Join('\n', new[]
        {
            recipient.Trim().ToLowerInvariant(),
            subject.Trim(),
            bodyText.Replace("\r\n", "\n").Trim(),
            partnerUrl.Trim(),
            campaignId.Trim()
        });
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(canonical));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    public static void AssertNoMojibake(string text, string label)
    {
        foreach (var marker in MojibakeMarkers)
        {
            if (text.Contains(marker, StringComparison.Ordinal))
                throw new InvalidOperationException($"Mojibake marker in {label}");
        }
    }

    public static bool IsWeekdayEastern(DateTime utc, TimeZoneInfo tz)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), tz);
        return local.DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday;
    }

    public static bool IsDispatchWindow(DateTime utc, TimeZoneInfo tz, int hour = 10)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), tz);
        return IsWeekdayEastern(utc, tz) && local.Hour == hour;
    }

    public static TimeZoneInfo EasternTimeZone()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("America/New_York"); }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Eastern Standard Time");
        }
    }

    public static string? EvaluateSendGate(PartnerSendContext ctx)
    {
        if (ctx.ScheduledCursorAutomation) return "scheduled_automation_blocked";
        if (!ctx.SendEnabled) return "send_disabled";
        if (ctx.PauseAllOutreach) return "pause_all_outreach";
        var mode = (ctx.OutreachMode ?? "off").Trim().ToLowerInvariant();
        if (mode is "off" or "")
            return "outreach_mode_off";
        if (mode == "test")
        {
            var recipient = (ctx.Recipient ?? "").Trim().ToLowerInvariant();
            var allowed = ctx.TestRecipients ?? new List<string>();
            if (!allowed.Any(r => string.Equals(r?.Trim(), recipient, StringComparison.OrdinalIgnoreCase)))
                return "test_recipient_not_allowed";
        }
        else if (mode != "live")
            return "outreach_mode_invalid";

        if (string.IsNullOrWhiteSpace(ctx.PostalAddress)) return "postal_address_missing";
        if (!string.Equals(ctx.FromEmail, PartnerFromEmail, StringComparison.OrdinalIgnoreCase))
            return "from_identity_invalid";
        if (ctx.ReplyToEmail.Contains("gmail.com", StringComparison.OrdinalIgnoreCase)
            || ctx.FromEmail.Contains("noreply@", StringComparison.OrdinalIgnoreCase))
            return "gmail_or_noreply_forbidden";
        if (ctx.ComplaintPause) return "complaint_pause";

        var isFollowUp = ctx.IsAutomatedFollowUp && ctx.FollowUpNumber > 0;
        if (isFollowUp)
        {
            if (!ctx.ParentWasApproved) return "missing_parent_approval";
            if (!ctx.CampaignActive) return "campaign_not_active";
            // Follow-up content differs from the parent approval fingerprint by design.
        }
        else
        {
            if (!ctx.Approved) return "missing_authorization_record";
            if (ctx.ApprovalFingerprint != ctx.CurrentFingerprint) return "approval_invalidated";
        }

        if (ctx.OptedOut || ctx.Complained || ctx.HardBounced) return "suppressed";
        if (ctx.AlreadySentThisRecipient && !isFollowUp) return "duplicate_recipient";
        if (ctx.DuplicateOrganizationInitial && !isFollowUp) return "duplicate_organization";
        if (ctx.RecentlyContacted && !isFollowUp) return "recent_contact";
        if (ctx.AlreadyQueuedOrSentSameRecipient && !isFollowUp) return "duplicate_recipient";
        if (ctx.SentToday >= ctx.DailyLimit) return "daily_send_limit";
        if (ctx.UnsafeBounceHealth) return "bounce_health_pause";
        return null;
    }

    public static bool ApprovalInvalidated(string storedFingerprint, string currentFingerprint)
        => !string.Equals(storedFingerprint, currentFingerprint, StringComparison.Ordinal);
}

public sealed class PartnerSendContext
{
    public bool SendEnabled { get; set; }
    public bool ScheduledCursorAutomation { get; set; }
    public string PostalAddress { get; set; } = "";
    public string FromEmail { get; set; } = PartnerOutreachRules.PartnerFromEmail;
    public string ReplyToEmail { get; set; } = PartnerOutreachRules.PartnerFromEmail;
    public bool ComplaintPause { get; set; }
    public bool Approved { get; set; }
    public string ApprovalFingerprint { get; set; } = "";
    public string CurrentFingerprint { get; set; } = "";
    public bool OptedOut { get; set; }
    public bool Complained { get; set; }
    public bool HardBounced { get; set; }
    public bool DuplicateOrganizationInitial { get; set; }
    public bool AlreadySentThisRecipient { get; set; }
    public bool RecentlyContacted { get; set; }
    public bool AlreadyQueuedOrSentSameRecipient { get; set; }
    public int SentToday { get; set; }
    public int DailyLimit { get; set; } = PartnerOutreachRules.DefaultDailyLimit;
    public bool UnsafeBounceHealth { get; set; }

    /// <summary>off | test | live</summary>
    public string OutreachMode { get; set; } = "off";
    public bool PauseAllOutreach { get; set; }
    public List<string> TestRecipients { get; set; } = new();
    public string Recipient { get; set; } = "";
    public bool IsAutomatedFollowUp { get; set; }
    public int FollowUpNumber { get; set; }
    public bool ParentWasApproved { get; set; }
    public bool CampaignActive { get; set; } = true;
}

public sealed class AcquisitionScoreResult
{
    public int AcquisitionScore { get; set; }
    public int AudienceFitScore { get; set; }
    public int MarketRelevanceScore { get; set; }
    public int CommunityFitScore { get; set; }
    public int ContactQualityScore { get; set; }
    public int HistoricalCategoryScore { get; set; }
    public string ScoreExplanation { get; set; } = "";
}
