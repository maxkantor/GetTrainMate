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
        if (string.IsNullOrWhiteSpace(ctx.PostalAddress)) return "postal_address_missing";
        if (!string.Equals(ctx.FromEmail, PartnerFromEmail, StringComparison.OrdinalIgnoreCase))
            return "from_identity_invalid";
        if (ctx.ReplyToEmail.Contains("gmail.com", StringComparison.OrdinalIgnoreCase)
            || ctx.FromEmail.Contains("noreply@", StringComparison.OrdinalIgnoreCase))
            return "gmail_or_noreply_forbidden";
        if (ctx.ComplaintPause) return "complaint_pause";
        if (!ctx.Approved) return "missing_authorization_record";
        if (ctx.ApprovalFingerprint != ctx.CurrentFingerprint) return "approval_invalidated";
        if (ctx.OptedOut || ctx.Complained || ctx.HardBounced) return "suppressed";
        if (ctx.DuplicateOrganizationInitial) return "duplicate_organization";
        if (ctx.RecentlyContacted) return "recent_contact";
        if (ctx.AlreadyQueuedOrSentSameRecipient) return "duplicate_recipient";
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
    public bool RecentlyContacted { get; set; }
    public bool AlreadyQueuedOrSentSameRecipient { get; set; }
    public int SentToday { get; set; }
    public int DailyLimit { get; set; } = PartnerOutreachRules.DefaultDailyLimit;
    public bool UnsafeBounceHealth { get; set; }
}
