using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services.PartnerOutreach;

public class DiscoverContactRequest
{
    /// <summary>Admin clicks always bypass the research cooldown by default.</summary>
    public bool Force { get; set; } = true;
    /// <summary>Probe only — nothing is persisted on the prospect.</summary>
    public bool DryRun { get; set; }
}

public class DiscoverContactsBatchRequest
{
    /// <summary>When empty, candidates are selected from the prospect list.</summary>
    public IEnumerable<string>? ProspectIds { get; set; }
    /// <summary>Only consider prospects that have a website but no email.</summary>
    public bool FilterMissingOnly { get; set; } = true;
    public int Max { get; set; } = 50;
    public bool DryRun { get; set; }
    public bool Force { get; set; } = true;
}

/// <summary>Probe output flattened into the strings the prospect record and admin UI use.</summary>
public sealed class ContactProbeSignals
{
    public string WebsiteStatus { get; init; } = nameof(WebsiteProbeStatus.LiveNoEmail);
    public string? Email { get; init; }
    public string? SourceUrl { get; init; }
    public string? SourceType { get; init; }
    public string? ContactName { get; init; }
    public string? ContactFormUrl { get; init; }
    /// <summary>HIGH|MEDIUM|LOW</summary>
    public string Confidence { get; init; } = ContactDiscoveryRules.ConfidenceLow;
    /// <summary>Verifier reason code — see ContactDiscoveryReason.</summary>
    public string? ReasonCode { get; init; }
    public IReadOnlyList<string> PagesChecked { get; init; } = Array.Empty<string>();
    public int PagesCheckedCount { get; init; }
    public string? SourcesCheckedSummary { get; init; }
    public string? Detail { get; init; }
    public string? SampleUrl { get; init; }
    public DateTime VerifiedOnUtc { get; init; } = DateTime.UtcNow;

    public bool HasEmail => !string.IsNullOrWhiteSpace(Email) && Email!.Contains('@');
    public bool HasContactForm => !string.IsNullOrWhiteSpace(ContactFormUrl);
}

/// <summary>Outcome of a single contact-discovery attempt. Serialized directly to admin clients.</summary>
public sealed class ContactDiscoveryResult
{
    public bool Ok { get; set; } = true;
    public string ProspectId { get; set; } = "";
    public string OrganizationName { get; set; } = "";
    public string? Website { get; set; }
    public bool Found { get; set; }
    public bool Skipped { get; set; }
    public bool DryRun { get; set; }
    public bool FromCache { get; set; }
    public string? FoundEmail { get; set; }
    public string? ContactFormUrl { get; set; }
    public string? Confidence { get; set; }
    public string? SourceUrl { get; set; }
    public string? SourceType { get; set; }
    public string? ContactName { get; set; }
    /// <summary>Discovery status — see PartnerProspect.ContactDiscoveryStatus.</summary>
    public string Status { get; set; } = ContactDiscoveryRules.DiscoveryContactNeeded;
    public string? WebsiteStatus { get; set; }
    /// <summary>Verifier reason code — see ContactDiscoveryReason.</summary>
    public string? ReasonCode { get; set; }
    public List<string> PagesChecked { get; set; } = new();
    public int PagesCheckedCount { get; set; }
    public string? SourcesCheckedSummary { get; set; }
    public string? Detail { get; set; }
    public string? Reason { get; set; }
    public string? Message { get; set; }
    public string? Error { get; set; }
    public string? Summary { get; set; }
    public int ResearchAttempts { get; set; }
    public string? ContactabilityState { get; set; }
    public DateTime? NextResearchAt { get; set; }
    public string? PendingReviewEmail { get; set; }
    public object? Draft { get; set; }
    /// <summary>Populated on dry runs with the prospect fields that would have been written.</summary>
    public object? WouldSave { get; set; }
}

/// <summary>
/// Pure rules for contact discovery: confidence, status progression, cache reuse and
/// batch candidate selection. No Dynamo or HTTP access.
/// </summary>
public static class ContactDiscoveryRules
{
    public const string DiscoveryContactNeeded = "CONTACT_NEEDED";
    public const string DiscoveryResearching = "RESEARCHING";
    public const string DiscoveryEmailFound = "EMAIL_FOUND";
    public const string DiscoveryContactFormFound = "CONTACT_FORM_FOUND";
    public const string DiscoveryReviewRequired = "REVIEW_REQUIRED";
    public const string DiscoveryNoPublicContact = "NO_PUBLIC_CONTACT";
    public const string DiscoveryManualContact = "MANUAL_CONTACT";

    public const string ConfidenceHigh = "HIGH";
    public const string ConfidenceMedium = "MEDIUM";
    public const string ConfidenceLow = "LOW";

    /// <summary>Cached domain contacts older than this are re-probed.</summary>
    public const int CacheFreshDays = 14;
    /// <summary>Per-site probe budget for a single admin request.</summary>
    public static readonly TimeSpan SingleProbeBudget = TimeSpan.FromSeconds(22);
    /// <summary>Tighter per-site budget inside a batch so one slow host cannot stall the run.</summary>
    public static readonly TimeSpan BatchProbeBudget = TimeSpan.FromSeconds(22);
    /// <summary>Batch stops after this much work and reports the rest as remaining.</summary>
    public static readonly TimeSpan BatchRunBudget = TimeSpan.FromSeconds(45);
    /// <summary>Attempts after which a site with no public contact is considered exhausted.</summary>
    public const int ExhaustedAttempts = 3;

    public const string ReasonContactFound = "contact_found";
    public const string ReasonReviewRequired = "review_required";
    public const string ReasonContactFormOnly = "contact_form_only";
    public const string ReasonWebsiteDead = "website_dead";
    public const string ReasonWebsiteUnreachable = "website_unreachable";
    public const string ReasonNoPublicEmail = "no_public_email";

    public static string? NormalizeHost(string? websiteOrHost)
    {
        var raw = (websiteOrHost ?? "").Trim();
        if (raw.Length == 0) return null;
        if (!raw.Contains("://", StringComparison.Ordinal)) raw = "https://" + raw;
        if (!Uri.TryCreate(raw, UriKind.Absolute, out var uri)) return null;
        var host = uri.Host.Trim().ToLowerInvariant();
        if (host.StartsWith("www.", StringComparison.Ordinal)) host = host[4..];
        return string.IsNullOrWhiteSpace(host) ? null : host;
    }

    public static string? EmailDomain(string? email)
    {
        var value = (email ?? "").Trim().ToLowerInvariant();
        if (!value.Contains('@')) return null;
        var domain = value.Split('@').Last().Trim();
        if (domain.StartsWith("www.", StringComparison.Ordinal)) domain = domain[4..];
        return string.IsNullOrWhiteSpace(domain) ? null : domain;
    }

    /// <summary>True when the email domain is the website host, a subdomain, or the same registered domain.</summary>
    public static bool DomainMatchesHost(string? emailDomain, string? host)
    {
        var domain = (emailDomain ?? "").Trim().ToLowerInvariant();
        var site = NormalizeHost(host);
        if (string.IsNullOrWhiteSpace(domain) || site is null) return false;
        if (domain == site) return true;
        if (domain.EndsWith("." + site, StringComparison.Ordinal)) return true;
        if (site.EndsWith("." + domain, StringComparison.Ordinal)) return true;
        return RegisteredDomain(domain) == RegisteredDomain(site);
    }

    /// <summary>Last two labels (three for known two-part public suffixes) — enough for same-org checks.</summary>
    public static string RegisteredDomain(string host)
    {
        var labels = (host ?? "").Trim().ToLowerInvariant().Split('.', StringSplitOptions.RemoveEmptyEntries);
        if (labels.Length <= 2) return string.Join('.', labels);
        var lastTwo = labels[^2] + "." + labels[^1];
        string[] twoPartSuffixes = { "co.uk", "org.uk", "ac.uk", "com.au", "co.nz", "com.br", "co.za", "com.mx" };
        if (twoPartSuffixes.Contains(lastTwo) && labels.Length >= 3)
            return labels[^3] + "." + lastTwo;
        return lastTwo;
    }

    public static string FromContactConfidence(ContactConfidence confidence) => confidence switch
    {
        ContactConfidence.High => ConfidenceHigh,
        ContactConfidence.Medium => ConfidenceMedium,
        _ => ConfidenceLow,
    };

    public static string NormalizeConfidence(string? raw) =>
        (raw ?? "").Trim().ToUpperInvariant() switch
        {
            "HIGH" => ConfidenceHigh,
            "MEDIUM" or "MED" => ConfidenceMedium,
            "LOW" => ConfidenceLow,
            _ => "",
        };

    public static string DiscoveryStatusFor(ContactProbeSignals signals, int researchAttempts)
    {
        if (signals.HasEmail)
            return signals.Confidence == ConfidenceHigh ? DiscoveryEmailFound : DiscoveryReviewRequired;
        if (signals.HasContactForm || signals.WebsiteStatus == nameof(WebsiteProbeStatus.ContactFormFound))
            return DiscoveryContactFormFound;
        if (signals.WebsiteStatus == nameof(WebsiteProbeStatus.ParkingOrDisconnected))
            return DiscoveryNoPublicContact;
        if (signals.WebsiteStatus == nameof(WebsiteProbeStatus.RateLimited)
            || signals.WebsiteStatus == nameof(WebsiteProbeStatus.TemporaryFailure))
            return DiscoveryContactNeeded;
        return researchAttempts >= ExhaustedAttempts ? DiscoveryNoPublicContact : DiscoveryContactNeeded;
    }

    public static string ReasonFor(ContactProbeSignals signals)
    {
        if (signals.HasEmail)
            return signals.Confidence == ConfidenceHigh ? ReasonContactFound : ReasonReviewRequired;
        if (signals.HasContactForm || signals.WebsiteStatus == nameof(WebsiteProbeStatus.ContactFormFound))
            return ReasonContactFormOnly;
        return signals.WebsiteStatus switch
        {
            nameof(WebsiteProbeStatus.ParkingOrDisconnected) => ReasonWebsiteDead,
            nameof(WebsiteProbeStatus.Unreachable) => ReasonWebsiteUnreachable,
            nameof(WebsiteProbeStatus.RateLimited) => "rate_limited",
            nameof(WebsiteProbeStatus.TemporaryFailure) => "temporary_failure",
            _ => ReasonNoPublicEmail,
        };
    }

    public static string MessageFor(ContactProbeSignals signals) => ReasonFor(signals) switch
    {
        ReasonContactFound => $"Found public email {signals.Email}.",
        ReasonReviewRequired =>
            $"Found {signals.Email} ({signals.Confidence.ToLowerInvariant()} confidence) — accept or reject before using it.",
        ReasonContactFormOnly =>
            "No public email — the site only offers a contact form. Use the form or enter contact manually.",
        ReasonWebsiteDead =>
            signals.Detail ?? "Website is not a live site — enter contact manually.",
        ReasonWebsiteUnreachable =>
            signals.Detail ?? "Website could not be reached — enter contact manually.",
        _ => signals.Detail ?? "No public email found on the website.",
    };

    /// <summary>One-line record of what was checked, stored on LastContactResearchSummary.</summary>
    public static string BuildResearchSummary(ContactProbeSignals signals, DateTime utcNow)
    {
        var count = signals.PagesCheckedCount > 0 ? signals.PagesCheckedCount : signals.PagesChecked.Count;
        var pageLabel = count > 0 ? $"{count} page(s)" : "site pages";
        var pages = signals.PagesChecked.Count > 0
            ? $" [{string.Join(", ", signals.PagesChecked.Take(8))}]"
            : signals.SampleUrl is null ? "" : $" [{signals.SampleUrl}]";
        var sources = string.IsNullOrWhiteSpace(signals.SourcesCheckedSummary)
            ? ""
            : " " + signals.SourcesCheckedSummary!.Trim() + ".";
        var detail = string.IsNullOrWhiteSpace(signals.Detail) ? "" : " " + signals.Detail!.Trim();
        return $"{utcNow:yyyy-MM-dd} {signals.WebsiteStatus}: checked {pageLabel}{pages}.{sources}{detail}".Trim();
    }

    public static DateTime? NextResearchAtFor(string discoveryStatus, int researchAttempts, DateTime utcNow) =>
        discoveryStatus switch
        {
            DiscoveryEmailFound or DiscoveryReviewRequired or DiscoveryContactFormFound => null,
            DiscoveryNoPublicContact => null,
            _ => utcNow.AddDays(Math.Max(1, researchAttempts * 2)),
        };

    public static bool IsCacheFresh(DateTime? checkedAt, DateTime utcNow, int maxAgeDays = CacheFreshDays) =>
        checkedAt is DateTime at && at <= utcNow.AddMinutes(5) && (utcNow - at).TotalDays < maxAgeDays;

    /// <summary>
    /// Cached contacts are only reused when the cached email belongs to the prospect's own host.
    /// This keeps a franchise/corporate address from being copied onto a different organization.
    /// </summary>
    public static bool CanReuseCachedContact(
        PartnerProspect prospect,
        PartnerDomainContactCache? cache,
        DateTime utcNow)
    {
        if (prospect is null || cache is null) return false;
        if (string.IsNullOrWhiteSpace(cache.Email) || !cache.Email!.Contains('@')) return false;
        if (NormalizeConfidence(cache.Confidence) != ConfidenceHigh) return false;
        if (!IsCacheFresh(cache.CheckedAt, utcNow)) return false;

        var host = NormalizeHost(prospect.Website);
        if (host is null) return false;
        if (!string.Equals(NormalizeHost(cache.Domain), host, StringComparison.Ordinal)) return false;
        return DomainMatchesHost(EmailDomain(cache.Email), host);
    }

    /// <summary>Prospects eligible for an automatic batch discovery pass.</summary>
    public static bool IsBatchCandidate(PartnerProspect p, bool filterMissingOnly, bool force, DateTime utcNow)
    {
        if (p is null || string.IsNullOrWhiteSpace(p.Website)) return false;
        if (NormalizeHost(p.Website) is null) return false;
        if (filterMissingOnly && HasUsableEmail(p)) return false;
        // A candidate already waiting on an admin accept/reject is not re-probed.
        if (!string.IsNullOrWhiteSpace(p.PendingReviewEmail)) return false;
        if (string.Equals(p.ContactDiscoveryStatus, DiscoveryReviewRequired, StringComparison.OrdinalIgnoreCase))
            return false;
        if (!force)
        {
            // Without force, do not spend a slot on a prospect the cooldown would skip anyway.
            if (p.NextResearchAt is DateTime next && next > utcNow) return false;
            if (p.ResearchAttempts >= 5) return false;
        }
        return true;
    }

    public static int ClampBatchMax(int max) => Math.Clamp(max <= 0 ? 50 : max, 1, 200);

    /// <summary>Discovery status for a prospect that already holds a usable email.</summary>
    public static string StatusForExistingEmail(PartnerProspect p) =>
        string.Equals(p.EmailSource, ManualContactRules.EmailSourceManualAdmin, StringComparison.OrdinalIgnoreCase)
            ? DiscoveryManualContact
            : DiscoveryEmailFound;

    public static bool HasUsableEmail(PartnerProspect p) =>
        !string.IsNullOrWhiteSpace(p?.Email) && p!.Email.Contains('@');

    /// <summary>Flattens a verifier probe result into the fields stored on the prospect.</summary>
    public static ContactProbeSignals FromProbe(WebsiteProbeResult? probe)
    {
        if (probe is null)
        {
            return new ContactProbeSignals
            {
                WebsiteStatus = nameof(WebsiteProbeStatus.Unreachable),
                ReasonCode = ContactDiscoveryReason.Unreachable,
                Detail = "Website probe produced no result.",
            };
        }

        var contact = probe.Contact;
        var email = contact?.Email?.Trim().ToLowerInvariant();
        var pages = (probe.PagesChecked ?? Array.Empty<string>())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim())
            .ToList();

        return new ContactProbeSignals
        {
            WebsiteStatus = probe.Status.ToString(),
            Email = email,
            SourceUrl = contact?.SourceUrl ?? probe.SampleUrl,
            SourceType = contact?.SourceType,
            ContactName = contact?.ContactName,
            ContactFormUrl = probe.ContactFormUrl,
            Confidence = string.IsNullOrWhiteSpace(email)
                ? ConfidenceLow
                : FromContactConfidence(probe.Confidence),
            ReasonCode = probe.ReasonCode,
            PagesChecked = pages,
            PagesCheckedCount = pages.Count,
            SourcesCheckedSummary = probe.SourcesCheckedSummary,
            Detail = probe.Detail,
            SampleUrl = probe.SampleUrl,
            VerifiedOnUtc = contact?.VerifiedOnUtc is DateTime on && on != default ? on : DateTime.UtcNow,
        };
    }
}
