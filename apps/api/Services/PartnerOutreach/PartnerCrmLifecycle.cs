using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services.PartnerOutreach;

/// <summary>
/// Normalizes legacy Status values into CrmLifecycle / ContactState / EmailState
/// when the new CRM fields are empty (backward compatible reads).
/// </summary>
public static class PartnerCrmLifecycle
{
    public const string New = "NEW";
    public const string Qualified = "QUALIFIED";
    public const string Contacted = "CONTACTED";
    public const string FollowUp = "FOLLOW_UP";
    public const string Replied = "REPLIED";
    public const string Interested = "INTERESTED";
    public const string Partner = "PARTNER";
    public const string Closed = "CLOSED";

    public const string ContactUnknown = "UNKNOWN";
    public const string ContactResearching = "RESEARCHING";
    public const string ContactFound = "CONTACT_FOUND";
    public const string ContactNeeded = "CONTACT_NEEDED";
    public const string ContactInvalid = "INVALID";
    public const string NoPublicContact = "NO_PUBLIC_CONTACT";
    public const string RetryLater = "RETRY_LATER";
    public const string ManualReview = "MANUAL_REVIEW";

    static readonly HashSet<string> KnownContactabilityStates = new(StringComparer.OrdinalIgnoreCase)
    {
        ContactNeeded, ContactResearching, ContactFound, NoPublicContact, RetryLater, ManualReview, ContactUnknown, ContactInvalid,
    };

    public static void ApplyLegacyNormalization(PartnerProspect p)
    {
        if (p == null) return;
        var status = (p.Status ?? "").Trim().ToLowerInvariant();
        var hasEmail = !string.IsNullOrWhiteSpace(p.Email) && p.Email.Contains('@');

        if (string.IsNullOrWhiteSpace(p.CrmLifecycle) || string.IsNullOrWhiteSpace(p.ContactState))
        {
            switch (status)
            {
                case "no_verified_public_email":
                    p.CrmLifecycle ??= New;
                    p.ContactState ??= ContactNeeded;
                    break;
                case "discovered":
                    p.CrmLifecycle ??= New;
                    p.ContactState ??= ContactUnknown;
                    break;
                case "prospect":
                    p.CrmLifecycle ??= Qualified;
                    p.ContactState ??= hasEmail ? ContactFound : ContactNeeded;
                    break;
                case "draft":
                    p.CrmLifecycle ??= Qualified;
                    p.ContactState ??= hasEmail ? ContactFound : ContactNeeded;
                    p.EmailState ??= "AWAITING_APPROVAL";
                    break;
                case "approved":
                    p.CrmLifecycle ??= Qualified;
                    p.ContactState ??= hasEmail ? ContactFound : ContactNeeded;
                    p.EmailState ??= "APPROVED";
                    break;
                case "sent":
                    p.CrmLifecycle ??= Contacted;
                    p.ContactState ??= ContactFound;
                    p.EmailState ??= "SENT";
                    break;
                case "delivered":
                    p.CrmLifecycle ??= Contacted;
                    p.ContactState ??= ContactFound;
                    p.EmailState ??= "DELIVERED";
                    break;
                case "replied":
                    p.CrmLifecycle ??= Replied;
                    p.ContactState ??= ContactFound;
                    break;
                case "opted_out":
                    p.CrmLifecycle ??= Closed;
                    p.EmailState ??= "OPTED_OUT";
                    break;
                case "bounced":
                    p.CrmLifecycle ??= string.IsNullOrWhiteSpace(p.CrmLifecycle) ? Contacted : p.CrmLifecycle;
                    if (string.IsNullOrWhiteSpace(p.CrmLifecycle)) p.CrmLifecycle = Contacted;
                    p.EmailState ??= "BOUNCED";
                    break;
                case "complained":
                    p.CrmLifecycle ??= Closed;
                    p.EmailState ??= "COMPLAINED";
                    break;
                case "qualified_language_unavailable":
                    p.CrmLifecycle ??= Qualified;
                    p.ContactState ??= hasEmail ? ContactFound : ContactNeeded;
                    if (string.IsNullOrWhiteSpace(p.Notes) || !p.Notes.Contains("language", StringComparison.OrdinalIgnoreCase))
                        p.Notes = string.IsNullOrWhiteSpace(p.Notes)
                            ? "Qualified prospect — language template unavailable"
                            : p.Notes;
                    break;
                case "interested":
                    p.CrmLifecycle ??= Interested;
                    break;
                case "partner":
                    p.CrmLifecycle ??= Partner;
                    break;
                default:
                    if (string.IsNullOrWhiteSpace(p.CrmLifecycle))
                        p.CrmLifecycle = hasEmail ? Qualified : New;
                    if (string.IsNullOrWhiteSpace(p.ContactState))
                        p.ContactState = hasEmail ? ContactFound : ContactUnknown;
                    break;
            }
        }

        // Mirror / normalize ContactabilityState from ContactState and known research outcomes
        if (string.IsNullOrWhiteSpace(p.ContactabilityState))
        {
            p.ContactabilityState = NormalizeContactabilityState(p.ContactState, hasEmail, status);
        }
        else
        {
            p.ContactabilityState = NormalizeContactabilityState(p.ContactabilityState, hasEmail, status);
            // Keep ContactState aligned for research terminal states
            if (p.ContactabilityState is NoPublicContact or RetryLater or ManualReview or ContactResearching)
                p.ContactState = p.ContactabilityState is ContactResearching ? ContactResearching : ContactNeeded;
            else if (p.ContactabilityState == ContactFound)
                p.ContactState = ContactFound;
            else if (p.ContactabilityState == ContactNeeded)
                p.ContactState = ContactNeeded;
        }

        if (string.IsNullOrWhiteSpace(p.ProspectKind) && !string.IsNullOrWhiteSpace(p.OrganizationType))
            p.ProspectKind = NormalizeProspectKind(p.OrganizationType);

        if (string.IsNullOrWhiteSpace(p.EmailState))
        {
            p.EmailState = status switch
            {
                "draft" => "AWAITING_APPROVAL",
                "approved" => "APPROVED",
                "sent" => "SENT",
                "delivered" => "DELIVERED",
                "bounced" => "BOUNCED",
                "complained" => "COMPLAINED",
                "opted_out" => "OPTED_OUT",
                "failed" => "FAILED",
                "scheduled" => "SCHEDULED",
                _ => p.EmailState
            };
        }
    }

    public static string? NormalizeContactabilityState(string? raw, bool hasEmail = false, string? legacyStatus = null)
    {
        var s = (raw ?? "").Trim().ToUpperInvariant();
        if (KnownContactabilityStates.Contains(s))
            return s switch
            {
                "UNKNOWN" => hasEmail ? ContactFound : ContactNeeded,
                "INVALID" => ManualReview,
                _ => s
            };

        if (hasEmail) return ContactFound;
        var status = (legacyStatus ?? "").Trim().ToLowerInvariant();
        if (status == "no_verified_public_email") return ContactNeeded;
        return string.IsNullOrWhiteSpace(s) ? (hasEmail ? ContactFound : ContactNeeded) : ContactNeeded;
    }

    /// <summary>Maps stored OrganizationType (snake_case) to ProspectKind enum-like values.</summary>
    public static string NormalizeProspectKind(string? organizationType)
    {
        var t = (organizationType ?? "").Trim().ToLowerInvariant().Replace(' ', '_').Replace('-', '_');
        return t switch
        {
            "gym" or "fitness_centre" or "fitness_center" => "GYM",
            "studio" or "yoga_studio" or "pilates" => "STUDIO",
            "pickleball" or "tennis" or "soccer" or "volleyball" or "swimming"
                or "sports_club" or "sport_club" or "outdoor_club" or "hiking"
                or "cycling" or "crossfit_hyrox" or "rec_sports" => "SPORTS_CLUB",
            "run_club" or "running" or "running_club" => "RUN_CLUB",
            "rec_league" or "league" or "softball" => "REC_LEAGUE",
            "coach" or "coaching" => "COACH",
            "personal_trainer" or "trainer" or "pt" => "TRAINER",
            "creator" or "influencer" => "CREATOR",
            "community" or "community_centre" or "community_center" => "COMMUNITY",
            "event_organizer" or "event" or "events" or "race" => "EVENT_ORGANIZER",
            _ => "OTHER",
        };
    }

    public static void ApplyToList(IEnumerable<PartnerProspect> prospects)
    {
        foreach (var p in prospects)
            ApplyLegacyNormalization(p);
    }

    public static string NormalizeCampaignStatus(string? status)
    {
        var s = (status ?? "").Trim().ToLowerInvariant();
        return s switch
        {
            "candidate" => "draft",
            "draft" or "active" or "paused" or "completed" => s,
            _ => s
        };
    }
}
