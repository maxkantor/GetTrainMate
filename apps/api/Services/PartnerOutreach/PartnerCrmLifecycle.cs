using System.Text.Json;
using System.Text.Json.Nodes;
using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services.PartnerOutreach;

/// <summary>
/// Normalizes legacy Status values into CrmLifecycle / ContactState / EmailState
/// and customer-acquisition dimensions (backward compatible reads).
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

    // Entity type
    public const string EntityIndividual = "INDIVIDUAL";
    public const string EntityOrganization = "ORGANIZATION";

    // Acquisition status
    public const string AcqDiscovered = "DISCOVERED";
    public const string AcqContactNeeded = "CONTACT_NEEDED";
    public const string AcqContactable = "CONTACTABLE";
    public const string AcqQualified = "QUALIFIED";
    public const string AcqDraft = "DRAFT";
    public const string AcqAwaitingApproval = "AWAITING_APPROVAL";
    public const string AcqApproved = "APPROVED";
    public const string AcqQueued = "QUEUED";
    public const string AcqSent = "SENT";
    public const string AcqDelivered = "DELIVERED";
    public const string AcqOpened = "OPENED";
    public const string AcqClicked = "CLICKED";
    public const string AcqReplied = "REPLIED";
    public const string AcqInterested = "INTERESTED";
    public const string AcqConverted = "CONVERTED";
    public const string AcqNotQualified = "NOT_QUALIFIED";
    public const string AcqRejected = "REJECTED";
    public const string AcqOptedOut = "OPTED_OUT";
    public const string AcqBounced = "BOUNCED";

    // Customer status
    public const string CustNotCustomer = "NOT_CUSTOMER";
    public const string CustRegistered = "REGISTERED";
    public const string CustActivated = "ACTIVATED";
    public const string CustPaying = "PAYING_CUSTOMER";

    // Distribution status
    public const string DistNone = "NONE";
    public const string DistInviteCreated = "INVITE_CREATED";
    public const string DistSharing = "SHARING";
    public const string DistActiveSource = "ACTIVE_SOURCE";

    // Partnership status (not customer conversion)
    public const string PartNone = "NONE";
    public const string PartInterested = "INTERESTED";
    public const string PartPartner = "PARTNER";

    // Next-action keys
    public const string ActionResearchContact = "RESEARCH_CONTACT";
    public const string ActionQualify = "QUALIFY";
    public const string ActionCreateOutreach = "CREATE_OUTREACH";
    public const string ActionReviewApprove = "REVIEW_APPROVE";
    public const string ActionSendOrQueue = "SEND_OR_QUEUE";
    public const string ActionViewActivity = "VIEW_ACTIVITY";
    public const string ActionReadReply = "READ_REPLY";
    public const string ActionViewCustomer = "VIEW_CUSTOMER";

    const int MinQualifyScore = 50;
    const int MaxTimelineEvents = 50;

    static readonly HashSet<string> KnownContactabilityStates = new(StringComparer.OrdinalIgnoreCase)
    {
        ContactNeeded, ContactResearching, ContactFound, NoPublicContact, RetryLater, ManualReview, ContactUnknown, ContactInvalid,
    };

    static readonly JsonSerializerOptions TimelineJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
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

    /// <summary>
    /// Derives missing AcquisitionStatus / CustomerStatus / DistributionStatus / PartnershipStatus
    /// and EntityType from legacy Status / CrmLifecycle / ContactState / EmailState.
    /// </summary>
    public static void NormalizeAcquisitionDimensions(PartnerProspect p)
    {
        if (p == null) return;
        ApplyLegacyNormalization(p);

        var hasEmail = !string.IsNullOrWhiteSpace(p.Email) && p.Email.Contains('@');
        var status = (p.Status ?? "").Trim().ToLowerInvariant();
        var emailState = (p.EmailState ?? "").Trim().ToUpperInvariant();
        var crm = (p.CrmLifecycle ?? "").Trim().ToUpperInvariant();
        var contact = (p.ContactState ?? p.ContactabilityState ?? "").Trim().ToUpperInvariant();

        if (string.IsNullOrWhiteSpace(p.EntityType))
        {
            p.EntityType = string.Equals(p.ProspectType, "individual", StringComparison.OrdinalIgnoreCase)
                ? EntityIndividual
                : EntityOrganization;
        }

        if (string.IsNullOrWhiteSpace(p.CustomerStatus))
        {
            if (p.PaidCustomers > 0 || p.DirectRevenueCents > 0 || p.FirstPurchaseAt != null)
                p.CustomerStatus = CustPaying;
            else if (p.ActivatedUsers > 0 || p.ActivatedAt != null)
                p.CustomerStatus = CustActivated;
            else if (p.ReferralSignups > 0 || p.SignupAt != null)
                p.CustomerStatus = CustRegistered;
            else
                p.CustomerStatus = CustNotCustomer;
        }

        if (string.IsNullOrWhiteSpace(p.PartnershipStatus))
        {
            if (crm == Partner || status == "partner")
                p.PartnershipStatus = PartPartner;
            else if (crm == Interested || status == "interested")
                p.PartnershipStatus = PartInterested;
            else
                p.PartnershipStatus = PartNone;
        }

        if (string.IsNullOrWhiteSpace(p.DistributionStatus))
        {
            if (p.PaidCustomers > 0 || p.ActivatedUsers > 0 || p.ReferralSignups > 0
                || p.AttributedRevenueCents > 0 || p.DirectRevenueCents > 0)
                p.DistributionStatus = DistActiveSource;
            else if (status is "sent" or "delivered" or "replied")
                p.DistributionStatus = DistSharing;
            else if (!string.IsNullOrWhiteSpace(p.PartnerCode) || !string.IsNullOrWhiteSpace(p.LandingUrl))
                p.DistributionStatus = DistInviteCreated;
            else
                p.DistributionStatus = DistNone;
        }

        if (string.IsNullOrWhiteSpace(p.AcquisitionStatus))
        {
            p.AcquisitionStatus = DeriveAcquisitionStatus(p, hasEmail, status, emailState, crm, contact);
        }
    }

    static string DeriveAcquisitionStatus(
        PartnerProspect p, bool hasEmail, string status, string emailState, string crm, string contact)
    {
        if (status == "opted_out" || emailState == "OPTED_OUT") return AcqOptedOut;
        if (status == "bounced" || emailState == "BOUNCED") return AcqBounced;
        if (status == "complained") return AcqRejected;
        // CONVERTED is customer conversion only — partnership uses PartnershipStatus
        if (p.CustomerStatus is CustRegistered or CustActivated or CustPaying)
            return AcqConverted;
        if (crm == Interested || status == "interested" || crm == Partner || status == "partner")
            return AcqInterested;
        if (crm == Replied || status == "replied") return AcqReplied;
        if (emailState == "DELIVERED" || status == "delivered") return AcqDelivered;
        if (emailState is "SENT" or "SENDING" || status == "sent") return AcqSent;
        if (emailState == "SCHEDULED" || status is "queued" or "scheduled") return AcqQueued;
        if (emailState == "APPROVED" || status == "approved") return AcqApproved;
        if (emailState is "AWAITING_APPROVAL" or "DRAFT" || status == "draft") return AcqAwaitingApproval;
        if (!hasEmail || contact is ContactNeeded or NoPublicContact or RetryLater
            || status == "no_verified_public_email")
            return AcqContactNeeded;
        if (crm == Qualified || status == "prospect" || status == "qualified_language_unavailable")
            return hasEmail ? AcqContactable : AcqContactNeeded;
        if (status == "discovered" || crm == New)
            return hasEmail ? AcqContactable : AcqDiscovered;
        return hasEmail ? AcqContactable : AcqDiscovered;
    }

    /// <summary>
    /// Suggests the primary next operator action for a prospect (and optional draft/approved queue item).
    /// </summary>
    public static object ComputeNextAction(PartnerProspect p, PartnerQueueItem? draftOrApproved = null)
    {
        NormalizeAcquisitionDimensions(p);
        var hasEmail = !string.IsNullOrWhiteSpace(p.Email) && p.Email.Contains('@');
        var contactNeeded = !hasEmail
            || string.Equals(p.ContactState, ContactNeeded, StringComparison.OrdinalIgnoreCase)
            || string.Equals(p.ContactabilityState, ContactNeeded, StringComparison.OrdinalIgnoreCase)
            || string.Equals(p.AcquisitionStatus, AcqContactNeeded, StringComparison.OrdinalIgnoreCase)
            || string.Equals(p.Status, "no_verified_public_email", StringComparison.OrdinalIgnoreCase);

        var cust = (p.CustomerStatus ?? CustNotCustomer).Trim().ToUpperInvariant();
        var acq = (p.AcquisitionStatus ?? "").Trim().ToUpperInvariant();
        var crm = (p.CrmLifecycle ?? "").Trim().ToUpperInvariant();
        var queueStatus = (draftOrApproved?.Status ?? "").Trim().ToLowerInvariant();

        if (cust is CustRegistered or CustActivated or CustPaying)
        {
            return new
            {
                key = ActionViewCustomer,
                label = "View customer",
                primaryButton = "View customer",
            };
        }

        if (acq == AcqReplied || crm == Replied || string.Equals(p.Status, "replied", StringComparison.OrdinalIgnoreCase)
            || queueStatus == "replied")
        {
            return new
            {
                key = ActionReadReply,
                label = "Read reply",
                primaryButton = "View reply",
            };
        }

        if (acq is AcqSent or AcqDelivered or AcqOpened or AcqClicked
            || crm is Contacted or FollowUp
            || string.Equals(p.Status, "sent", StringComparison.OrdinalIgnoreCase)
            || string.Equals(p.Status, "delivered", StringComparison.OrdinalIgnoreCase)
            || queueStatus is "sent" or "delivered")
        {
            return new
            {
                key = ActionViewActivity,
                label = "View activity",
                primaryButton = "View activity",
            };
        }

        if (queueStatus == "approved" || acq == AcqApproved
            || string.Equals(p.Status, "approved", StringComparison.OrdinalIgnoreCase)
            || string.Equals(p.EmailState, "APPROVED", StringComparison.OrdinalIgnoreCase))
        {
            return new
            {
                key = ActionSendOrQueue,
                label = "Send or queue",
                primaryButton = "Send",
            };
        }

        if (queueStatus == "draft" || acq is AcqDraft or AcqAwaitingApproval
            || string.Equals(p.Status, "draft", StringComparison.OrdinalIgnoreCase)
            || string.Equals(p.EmailState, "AWAITING_APPROVAL", StringComparison.OrdinalIgnoreCase))
        {
            return new
            {
                key = ActionReviewApprove,
                label = "Review & approve",
                primaryButton = "Review",
            };
        }

        if (contactNeeded)
        {
            return new
            {
                key = ActionResearchContact,
                label = "Research contact",
                primaryButton = "Find contact",
            };
        }

        if (p.AcquisitionScore > 0 && p.AcquisitionScore < MinQualifyScore)
        {
            return new
            {
                key = ActionQualify,
                label = "Qualify prospect",
                primaryButton = "Qualify",
            };
        }

        return new
        {
            key = ActionCreateOutreach,
            label = "Create outreach",
            primaryButton = "Create draft",
        };
    }

    public static void AppendTimelineEvent(
        PartnerProspect prospect,
        string eventKey,
        string label,
        DateTime? at = null,
        object? meta = null)
    {
        if (prospect == null) return;
        var events = new JsonArray();
        if (!string.IsNullOrWhiteSpace(prospect.TimelineJson))
        {
            try
            {
                var parsed = JsonNode.Parse(prospect.TimelineJson);
                if (parsed is JsonArray arr)
                {
                    foreach (var node in arr)
                        if (node != null) events.Add(node.DeepClone());
                }
            }
            catch
            {
                events = new JsonArray();
            }
        }

        var entry = new JsonObject
        {
            ["eventKey"] = eventKey ?? "",
            ["label"] = label ?? "",
            ["at"] = (at ?? DateTime.UtcNow).ToString("o"),
        };
        if (meta != null)
        {
            try
            {
                entry["meta"] = JsonSerializer.SerializeToNode(meta, TimelineJsonOptions);
            }
            catch
            {
                entry["meta"] = meta.ToString();
            }
        }
        events.Add(entry);

        while (events.Count > MaxTimelineEvents)
            events.RemoveAt(0);

        prospect.TimelineJson = events.ToJsonString(TimelineJsonOptions);
    }

    public static List<object> ParseTimeline(PartnerProspect? prospect)
    {
        if (prospect == null || string.IsNullOrWhiteSpace(prospect.TimelineJson))
            return new List<object>();
        try
        {
            var nodes = JsonSerializer.Deserialize<List<JsonElement>>(prospect.TimelineJson);
            if (nodes == null) return new List<object>();
            return nodes.Select(n => (object)n).ToList();
        }
        catch
        {
            return new List<object>();
        }
    }

    public static bool IsCustomerStatus(string? customerStatus) =>
        (customerStatus ?? "").Trim().ToUpperInvariant() is CustRegistered or CustActivated or CustPaying;

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
            NormalizeAcquisitionDimensions(p);
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
