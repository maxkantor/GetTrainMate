namespace GetTrainMate.Api.Services.PartnerOutreach;

/// <summary>Authoritative pre-SES / send-state reasons. Do not invent these in the UI.</summary>
public static class WhyNotSent
{
    public const string DiscoveryPending = "DISCOVERY_PENDING";
    public const string NoPublicEmail = "NO_PUBLIC_EMAIL_FOUND";
    public const string InvalidEmail = "INVALID_EMAIL";
    public const string NotQualified = "NOT_QUALIFIED";
    public const string DuplicateEmail = "DUPLICATE_EMAIL";
    public const string DuplicateOrganization = "DUPLICATE_ORGANIZATION";
    public const string AlreadyContacted = "ALREADY_CONTACTED";
    public const string Cooldown = "COOLDOWN";
    public const string Unsubscribed = "GLOBAL_SUPPRESSION_UNSUBSCRIBED";
    public const string Bounced = "GLOBAL_SUPPRESSION_BOUNCED";
    public const string Complaint = "GLOBAL_SUPPRESSION_COMPLAINT";
    public const string ManualSuppression = "MANUAL_SUPPRESSION";
    public const string CampaignDisabled = "CAMPAIGN_DISABLED";
    public const string DryRun = "DRY_RUN";
    public const string ManualApprovalRequired = "MANUAL_APPROVAL_REQUIRED";
    public const string DailyLimitReached = "DAILY_LIMIT_REACHED";
    public const string SesQuotaReached = "SES_QUOTA_REACHED";
    public const string SafetyPaused = "SAFETY_PAUSED";
    public const string ReadyToSend = "READY_TO_SEND";

    public static string FromGateCode(string? code, PartnerSendContext? ctx = null)
    {
        return code switch
        {
            null => ReadyToSend,
            "dry_run" => DryRun,
            "pause_all_outreach" or "bounce_health_pause" or "complaint_pause" => SafetyPaused,
            "missing_authorization_record" => ManualApprovalRequired,
            "daily_send_limit" => DailyLimitReached,
            "ses_quota_reached" => SesQuotaReached,
            "duplicate_recipient" => DuplicateEmail,
            "duplicate_organization" => DuplicateOrganization,
            "recent_contact" => Cooldown,
            "campaign_not_active" => CampaignDisabled,
            "suppressed" when ctx?.OptedOut == true => Unsubscribed,
            "suppressed" when ctx?.HardBounced == true => Bounced,
            "suppressed" when ctx?.Complained == true => Complaint,
            "suppressed" => ManualSuppression,
            _ => code.ToUpperInvariant(),
        };
    }

    public static string ForProspect(
        PartnerProspectState p,
        bool hasUnsentDraft,
        bool alreadySent,
        bool suppressedUnsub,
        bool suppressedBounce,
        bool suppressedComplaint,
        bool suppressedManual,
        bool automaticSending,
        bool dryRun,
        bool paused,
        int score,
        int minScore)
    {
        if (paused) return SafetyPaused;
        if (suppressedUnsub) return Unsubscribed;
        if (suppressedBounce) return Bounced;
        if (suppressedComplaint) return Complaint;
        if (suppressedManual) return ManualSuppression;
        if (alreadySent) return AlreadyContacted;
        if (!p.HasUsableEmail)
        {
            if (string.Equals(p.ContactDiscoveryStatus, "NO_PUBLIC_CONTACT", StringComparison.OrdinalIgnoreCase)
                || string.Equals(p.ContactDiscoveryStatus, "CONTACT_FORM_FOUND", StringComparison.OrdinalIgnoreCase))
                return NoPublicEmail;
            if (string.Equals(p.EmailVerificationStatus, "invalid", StringComparison.OrdinalIgnoreCase))
                return InvalidEmail;
            return DiscoveryPending;
        }
        if (score > 0 && score < minScore) return NotQualified;
        if (dryRun) return DryRun;
        if (hasUnsentDraft && automaticSending) return ReadyToSend;
        if (hasUnsentDraft && !automaticSending) return ManualApprovalRequired;
        return DiscoveryPending;
    }
}

public sealed class PartnerProspectState
{
    public bool HasUsableEmail { get; set; }
    public string? ContactDiscoveryStatus { get; set; }
    public string? EmailVerificationStatus { get; set; }
}
