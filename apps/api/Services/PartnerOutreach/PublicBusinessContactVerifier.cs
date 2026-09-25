using System.Diagnostics;
using System.Net;
using System.Text.RegularExpressions;

namespace GetTrainMate.Api.Services.PartnerOutreach;

public enum WebsiteProbeStatus
{
    /// <summary>Fetched at least one page; email extracted.</summary>
    EmailFound,
    /// <summary>Site responded with real content but no public business email.</summary>
    LiveNoEmail,
    /// <summary>Domain parking / Wix “not connected” / similar placeholder.</summary>
    ParkingOrDisconnected,
    /// <summary>All fetches failed (DNS, timeout, non-success).</summary>
    Unreachable,
    /// <summary>Official site returned HTTP 429.</summary>
    RateLimited,
    /// <summary>Official site returned a transient 5xx / timeout.</summary>
    TemporaryFailure,
    /// <summary>No email published, but a public contact form was found (never submitted).</summary>
    ContactFormFound,
}

/// <summary>How strongly the extracted email is attributed to the official business.</summary>
public enum ContactConfidence
{
    Low,
    Medium,
    High,
}

/// <summary>Machine-readable outcome codes for contact discovery.</summary>
public static class ContactDiscoveryReason
{
    public const string EmailFound = "email_found";
    public const string ContactFormFound = "contact_form_found";
    public const string Parking = "parking";
    public const string Unreachable = "unreachable";
    public const string NoPublicContact = "no_public_contact";
    public const string ReviewRequired = "review_required";
    public const string RateLimited = "rate_limited";
    public const string TemporaryFailure = "temporary_failure";
}

public sealed class WebsiteProbeResult
{
    public WebsiteProbeStatus Status { get; init; }
    public VerifiedPublicContact? Contact { get; init; }
    public string? Detail { get; init; }
    public string? SampleUrl { get; init; }

    /// <summary>Attribution strength of <see cref="Contact"/> (Low when there is no contact).</summary>
    public ContactConfidence Confidence { get; init; } = ContactConfidence.Low;
    /// <summary>Machine-readable reason code — see <see cref="ContactDiscoveryReason"/>.</summary>
    public string? ReasonCode { get; init; }
    /// <summary>Page that hosts a public contact form (never submitted).</summary>
    public string? ContactFormUrl { get; init; }
    /// <summary>First public phone number seen on the site, if any.</summary>
    public string? PhoneFound { get; init; }
    /// <summary>Public social profile URLs found on the site.</summary>
    public IReadOnlyList<string> SocialUrls { get; init; } = Array.Empty<string>();
    /// <summary>Every URL the probe attempted, in order.</summary>
    public IReadOnlyList<string> PagesChecked { get; init; } = Array.Empty<string>();
    /// <summary>Human-readable coverage summary, e.g. "Official website + 7 internal pages".</summary>
    public string? SourcesCheckedSummary { get; init; }
}

/// <summary>
/// Fetches organization-controlled pages and extracts exact public business emails.
/// Never infers addresses (no info@domain guessing without HTML evidence).
/// </summary>
public sealed class PublicBusinessContactVerifier
{
    const int MaxPageFetches = 28;
    const int MaxDiscoveryFollows = 8;
    const int MaxSocialFollows = 2;
    const int MaxHtmlChars = 600_000;
    static readonly TimeSpan ProbeBudget = TimeSpan.FromSeconds(45);

    static readonly Regex EmailRx = new(
        @"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    static readonly Regex MailtoRx = new(
        @"mailto:([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})",
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    // name [at] domain [dot] com / name (at) domain.com / name &#64; domain.com
    static readonly Regex BracketObfuscatedRx = new(
        @"(?<local>[A-Za-z0-9._%+\-]{1,64})\s*(?:\[\s*(?:at|@)\s*\]|\(\s*(?:at|@)\s*\)|\{\s*(?:at|@)\s*\}|&#0*64;|&#x0*40;)\s*(?<domain>[A-Za-z0-9\-]+(?:\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\{\s*dot\s*\}|\s+dot\s+|\.)\s*[A-Za-z0-9\-]+)+)",
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    // name AT domain DOT com — the spelled-out "at" only counts when the dots are spelled out too,
    // otherwise prose like "available at www.example.com" would look like an address.
    static readonly Regex WordObfuscatedRx = new(
        @"(?<local>[A-Za-z0-9._%+\-]{1,64})\s+at\s+(?<domain>[A-Za-z0-9\-]+(?:\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\{\s*dot\s*\}|\s+dot\s+)\s*[A-Za-z0-9\-]+)+)",
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    static readonly Regex ObfuscatedDotRx = new(
        @"\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\{\s*dot\s*\}|\s+dot\s+|\.)\s*",
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    static readonly Regex DomainShapeRx = new(
        @"^[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    static readonly Regex AnchorRx = new(
        @"<a\b[^>]*?href\s*=\s*(?:""(?<href>[^""]*)""|'(?<href>[^']*)'|(?<href>[^\s""'>]+))[^>]*>(?<text>.*?)</a>",
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.CultureInvariant);

    static readonly Regex TagRx = new(@"<[^>]+>", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    static readonly Regex FormTagRx = new(@"<form\b[^>]*>", RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    static readonly Regex FormActionRx = new(
        @"action\s*=\s*(?:""(?<a>[^""]*)""|'(?<a>[^']*)'|(?<a>[^\s""'>]+))",
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    static readonly Regex ContactInputRx = new(
        @"<(?:input|textarea)\b[^>]*?(?:type\s*=\s*[""']?email|name\s*=\s*[""']?(?:email|e-mail|your-email|your_email|message|your-message|your_message|comments?)\b)",
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    static readonly Regex TelHrefRx = new(
        @"tel:\s*(?<num>\+?[0-9][0-9\-\.\s\(\)]{6,19})",
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    static readonly Regex PhoneTextRx = new(
        @"(?:\+?1[\s\-\.])?\(?\b\d{3}\)?[\s\-\.]\d{3}[\s\-\.]\d{4}\b",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    static readonly Regex SocialUrlRx = new(
        @"https?://(?:[A-Za-z0-9\-]+\.)?(?:facebook\.com|fb\.com|instagram\.com|linkedin\.com|youtube\.com|youtu\.be)/[^\s""'<>\\)]+",
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    static readonly string[] ContactPaths =
    {
        // Homepage first — catch Wix/parked domains before scraping contact paths.
        "/",
        "/contact", "/contact-us", "/about", "/about-us", "/team", "/staff", "/coaches",
        "/locations", "/membership", "/partners", "/partnerships", "/sponsorship",
        "/media", "/press", "/get-in-touch", "/connect", "/our-team", "/pages/contact",
        "/contactus", "/en/contact",
        "/community", "/inquiry", "/business", "/collaborate", "/join",
    };

    static readonly string[] DiscoveryKeywords =
    {
        "contact", "about", "team", "staff", "coach", "owner", "manager", "membership",
        "partner", "business", "media", "press", "sponsor", "connect", "get-in-touch",
        "getintouch", "reach-us", "our-people", "leadership", "directory",
    };

    static readonly HashSet<string> RejectLocalParts = new(StringComparer.OrdinalIgnoreCase)
    {
        "noreply", "no-reply", "donotreply", "do-not-reply", "postmaster", "abuse",
        "privacy", "unsubscribe", "mailer-daemon", "bounce", "newsletter",
        "youremail", "your-email", "someone", "username", "yourname",
    };

    static readonly HashSet<string> RejectDomains = new(StringComparer.OrdinalIgnoreCase)
    {
        "sentry.io", "sentry.wixpress.com", "wixpress.com", "example.com", "example.org",
        "domain.com", "yourdomain.com", "email.com", "mysite.com", "sentry-next.wixpress.com",
        "schema.org", "w3.org", "godaddy.com",
    };

    static readonly string[] AssetSuffixes =
    {
        ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js", ".ico", ".woff", ".woff2",
    };

    readonly HttpClient _http;
    readonly ILogger<PublicBusinessContactVerifier> _log;

    public PublicBusinessContactVerifier(HttpClient http, ILogger<PublicBusinessContactVerifier> log)
    {
        _http = http;
        _log = log;
    }

    public async Task<VerifiedPublicContact?> TryVerifyAsync(
        Uri officialWebsite,
        CancellationToken ct = default,
        int? maxContactPaths = null)
    {
        var probe = await ProbeAsync(officialWebsite, ct, maxContactPaths);
        return probe.Contact;
    }

    public async Task<WebsiteProbeResult> ProbeAsync(
        Uri officialWebsite,
        CancellationToken ct = default,
        int? maxContactPaths = null)
    {
        if (!officialWebsite.Scheme.StartsWith("http", StringComparison.OrdinalIgnoreCase))
        {
            return new WebsiteProbeResult
            {
                Status = WebsiteProbeStatus.Unreachable,
                Detail = "Website URL is not http(s).",
                ReasonCode = ContactDiscoveryReason.Unreachable,
                SourcesCheckedSummary = "No pages checked (unsupported URL scheme).",
            };
        }

        var host = NormalizeHost(officialWebsite.Host);
        var maxFollows = maxContactPaths is > 0
            ? Math.Clamp(maxContactPaths.Value, 1, MaxDiscoveryFollows)
            : MaxDiscoveryFollows;

        var queue = new List<Uri>();
        var queued = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var paths = maxContactPaths is > 0 ? ContactPaths.Take(maxContactPaths.Value) : ContactPaths;
        foreach (var path in paths)
        {
            if (Uri.TryCreate(officialWebsite, path, out var pageUri) && queued.Add(Canonical(pageUri)))
                queue.Add(pageUri);
        }

        var pagesChecked = new List<string>();
        var socials = new List<string>();
        var socialSeen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var clock = Stopwatch.StartNew();

        var fetchedOk = 0;
        var followsUsed = 0;
        var sawRateLimit = false;
        var sawTemporary = false;
        string? sampleUrl = null;
        string? parkingDetail = null;
        string? parkingUrl = null;
        string? contactFormUrl = null;
        string? phone = null;
        Candidate? best = null;

        for (var i = 0; i < queue.Count; i++)
        {
            if (pagesChecked.Count >= MaxPageFetches || clock.Elapsed > ProbeBudget) break;
            ct.ThrowIfCancellationRequested();

            var pageUri = queue[i];
            var pageUrl = pageUri.ToString();
            var isHomepage = i == 0;
            pagesChecked.Add(pageUrl);

            var (html, fetchKind) = await FetchAsync(pageUri, ct);
            if (fetchKind == "rate_limited") sawRateLimit = true;
            if (fetchKind == "temporary") sawTemporary = true;
            if (string.IsNullOrWhiteSpace(html)) continue;

            fetchedOk++;
            sampleUrl ??= pageUrl;

            if (IsParkingOrDisconnectedHtml(html))
            {
                parkingDetail ??= DetectParkingDetail(html);
                parkingUrl ??= pageUrl;
                // Parking homepage: no point scraping more paths on a disconnected domain.
                if (isHomepage)
                {
                    return new WebsiteProbeResult
                    {
                        Status = WebsiteProbeStatus.ParkingOrDisconnected,
                        Detail = parkingDetail ?? "Domain parking / not connected to a site.",
                        SampleUrl = pageUrl,
                        ReasonCode = ContactDiscoveryReason.Parking,
                        PagesChecked = pagesChecked.ToArray(),
                        SourcesCheckedSummary = BuildSourcesSummary(fetchedOk, 0),
                    };
                }
                continue;
            }

            foreach (var social in ExtractSocialUrls(html))
            {
                if (socialSeen.Add(social)) socials.Add(social);
            }

            phone ??= ExtractPhone(html);
            contactFormUrl ??= FindContactFormUrl(html, pageUrl);

            foreach (var candidate in ExtractCandidateContacts(html, host, pageUrl))
            {
                var confidence = ScoreEmailConfidence(candidate.Email, host, candidate.SourceType, pageUrl);
                var scored = new Candidate(candidate.Email, candidate.SourceType, candidate.ContactName, confidence, pageUrl);
                if (best == null || scored.Confidence > best.Confidence) best = scored;
            }

            // A high-confidence hit is as good as it gets — stop burning requests.
            if (best is { Confidence: ContactConfidence.High }) break;

            if (followsUsed < maxFollows && queue.Count < MaxPageFetches)
            {
                foreach (var link in ExtractSameHostDiscoveryLinks(html, pageUri))
                {
                    if (followsUsed >= maxFollows) break;
                    if (!queued.Add(Canonical(link))) continue;
                    queue.Add(link);
                    followsUsed++;
                }
            }
        }

        // Best effort: public social pages sometimes list the business email. Never log in, never retry.
        var socialPagesChecked = 0;
        if (best == null && socials.Count > 0 && clock.Elapsed < ProbeBudget)
        {
            foreach (var social in socials.Take(MaxSocialFollows))
            {
                if (!Uri.TryCreate(social, UriKind.Absolute, out var socialUri)) continue;
                pagesChecked.Add(social);
                var (html, _) = await FetchAsync(socialUri, ct);
                if (string.IsNullOrWhiteSpace(html)) continue;
                socialPagesChecked++;
                foreach (var candidate in ExtractCandidateContacts(html, host, social))
                {
                    var confidence = ScoreEmailConfidence(candidate.Email, host, candidate.SourceType, social);
                    var scored = new Candidate(candidate.Email, "social_page", candidate.ContactName, confidence, social);
                    if (best == null || scored.Confidence > best.Confidence) best = scored;
                }
                if (best is { Confidence: ContactConfidence.High }) break;
            }
        }

        var summary = BuildSourcesSummary(fetchedOk, socialPagesChecked);
        var pages = pagesChecked.ToArray();
        var socialList = socials.ToArray();

        if (best != null)
        {
            var reason = best.Confidence == ContactConfidence.Low
                ? ContactDiscoveryReason.ReviewRequired
                : ContactDiscoveryReason.EmailFound;
            var contact = new VerifiedPublicContact
            {
                Email = best.Email,
                SourceUrl = best.PageUrl,
                SourceType = best.SourceType,
                ContactName = best.ContactName,
                VerifiedOnUtc = DateTime.UtcNow,
                Confidence = best.Confidence,
                ReasonCode = reason,
                ContactFormUrl = contactFormUrl,
                PhoneFound = phone,
                SocialUrls = socialList,
                PagesChecked = pages,
                SourcesCheckedSummary = summary,
            };
            return new WebsiteProbeResult
            {
                Status = WebsiteProbeStatus.EmailFound,
                Contact = contact,
                SampleUrl = best.PageUrl,
                Confidence = best.Confidence,
                ReasonCode = reason,
                ContactFormUrl = contactFormUrl,
                PhoneFound = phone,
                SocialUrls = socialList,
                PagesChecked = pages,
                SourcesCheckedSummary = summary,
                Detail = $"Public email found on {best.PageUrl} ({best.SourceType}, {best.Confidence.ToString().ToLowerInvariant()} confidence).",
            };
        }

        if (fetchedOk == 0)
        {
            if (sawRateLimit)
            {
                return new WebsiteProbeResult
                {
                    Status = WebsiteProbeStatus.RateLimited,
                    Detail = "Official website returned HTTP 429 (rate limited). Backing off.",
                    SampleUrl = officialWebsite.ToString(),
                    ReasonCode = ContactDiscoveryReason.RateLimited,
                    PagesChecked = pages,
                    SourcesCheckedSummary = summary,
                };
            }
            if (sawTemporary)
            {
                return new WebsiteProbeResult
                {
                    Status = WebsiteProbeStatus.TemporaryFailure,
                    Detail = "Official website returned a temporary error (5xx or timeout). Retry later.",
                    SampleUrl = officialWebsite.ToString(),
                    ReasonCode = ContactDiscoveryReason.TemporaryFailure,
                    PagesChecked = pages,
                    SourcesCheckedSummary = summary,
                };
            }
            return new WebsiteProbeResult
            {
                Status = WebsiteProbeStatus.Unreachable,
                Detail = "Could not reach the website (DNS, timeout, or all pages failed).",
                SampleUrl = officialWebsite.ToString(),
                ReasonCode = ContactDiscoveryReason.Unreachable,
                PagesChecked = pages,
                SourcesCheckedSummary = summary,
            };
        }

        if (parkingDetail != null)
        {
            return new WebsiteProbeResult
            {
                Status = WebsiteProbeStatus.ParkingOrDisconnected,
                Detail = parkingDetail,
                SampleUrl = parkingUrl ?? sampleUrl,
                ReasonCode = ContactDiscoveryReason.Parking,
                PagesChecked = pages,
                SourcesCheckedSummary = summary,
            };
        }

        if (!string.IsNullOrWhiteSpace(contactFormUrl))
        {
            return new WebsiteProbeResult
            {
                Status = WebsiteProbeStatus.ContactFormFound,
                Detail = $"No public email published, but a contact form is available at {contactFormUrl}.",
                SampleUrl = contactFormUrl,
                ReasonCode = ContactDiscoveryReason.ContactFormFound,
                ContactFormUrl = contactFormUrl,
                PhoneFound = phone,
                SocialUrls = socialList,
                PagesChecked = pages,
                SourcesCheckedSummary = summary,
            };
        }

        return new WebsiteProbeResult
        {
            Status = WebsiteProbeStatus.LiveNoEmail,
            Detail = "Website is reachable but no public business email was found on contact/about pages.",
            SampleUrl = sampleUrl,
            ReasonCode = ContactDiscoveryReason.NoPublicContact,
            PhoneFound = phone,
            SocialUrls = socialList,
            PagesChecked = pages,
            SourcesCheckedSummary = summary,
        };
    }

    sealed record Candidate(
        string Email,
        string SourceType,
        string? ContactName,
        ContactConfidence Confidence,
        string PageUrl);

    async Task<(string? Html, string? Kind)> FetchAsync(Uri url, CancellationToken ct)
    {
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.TryAddWithoutValidation("User-Agent", "GetTrainMatePartnerDiscovery/1.0 (+https://gettrainmate.com/contact)");
            req.Headers.TryAddWithoutValidation("Accept", "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5");
            using var res = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
            if ((int)res.StatusCode == 429) return (null, "rate_limited");
            if ((int)res.StatusCode >= 500) return (null, "temporary");
            if (!res.IsSuccessStatusCode) return (null, null);

            var mediaType = res.Content.Headers.ContentType?.MediaType;
            if (!string.IsNullOrEmpty(mediaType)
                && !mediaType.Contains("html", StringComparison.OrdinalIgnoreCase)
                && !mediaType.Contains("text/plain", StringComparison.OrdinalIgnoreCase)
                && !mediaType.Contains("xml", StringComparison.OrdinalIgnoreCase))
                return (null, null);

            var html = await res.Content.ReadAsStringAsync(ct);
            if (string.IsNullOrWhiteSpace(html)) return (null, null);
            return (html.Length > MaxHtmlChars ? html[..MaxHtmlChars] : html, null);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (TaskCanceledException)
        {
            return (null, "temporary");
        }
        catch (Exception ex)
        {
            _log.LogDebug(ex, "Contact page fetch failed for {Url}", url);
            return (null, "temporary");
        }
    }

    static string BuildSourcesSummary(int fetchedPages, int socialPages)
    {
        string core = fetchedPages switch
        {
            <= 0 => "No reachable pages on the official website",
            1 => "Official website homepage only",
            2 => "Official website + 1 internal page",
            _ => $"Official website + {fetchedPages - 1} internal pages",
        };
        if (socialPages == 1) core += " + 1 public social page";
        else if (socialPages > 1) core += $" + {socialPages} public social pages";
        return core;
    }

    static string Canonical(Uri uri) =>
        new UriBuilder(uri) { Fragment = "" }.Uri.ToString().TrimEnd('/');

    static string NormalizeHost(string? host)
    {
        var h = (host ?? "").Trim().ToLowerInvariant();
        return h.StartsWith("www.") ? h[4..] : h;
    }

    /// <summary>True for Wix/GoDaddy/etc. placeholder pages with no real business content.</summary>
    public static bool IsParkingOrDisconnectedHtml(string html)
    {
        if (string.IsNullOrWhiteSpace(html)) return false;
        var lower = html.ToLowerInvariant();
        if (lower.Contains("this domain isn't connected to a site", StringComparison.Ordinal)
            || lower.Contains("this domain is not connected to a site", StringComparison.Ordinal)
            || lower.Contains("head to the domains page in your wix dashboard", StringComparison.Ordinal)
            || lower.Contains("claim one now on wix", StringComparison.Ordinal))
            return true;
        if (lower.Contains("domain is parked", StringComparison.Ordinal)
            || lower.Contains("parked domain", StringComparison.Ordinal)
            || lower.Contains("this domain is for sale", StringComparison.Ordinal))
            return true;
        if (lower.Contains("wixstatic.com", StringComparison.Ordinal)
            && lower.Contains("isn't connected", StringComparison.Ordinal))
            return true;
        return false;
    }

    static string DetectParkingDetail(string html)
    {
        var lower = html.ToLowerInvariant();
        if (lower.Contains("wix", StringComparison.Ordinal))
            return "Website is a Wix placeholder — domain is not connected to a live site.";
        if (lower.Contains("parked", StringComparison.Ordinal) || lower.Contains("for sale", StringComparison.Ordinal))
            return "Website is a parked / for-sale domain page.";
        return "Website appears disconnected or parked (no live business site).";
    }

    /// <summary>Extract a verified public contact from already-fetched HTML (for tests and offline reuse).</summary>
    public static VerifiedPublicContact? TryVerifyFromHtml(string html, string host, string pageUrl)
    {
        if (string.IsNullOrWhiteSpace(html)) return null;
        if (IsParkingOrDisconnectedHtml(html)) return null;
        var officialHost = NormalizeHost(host);

        foreach (var candidate in ExtractCandidateContacts(html, officialHost, pageUrl))
        {
            var confidence = ScoreEmailConfidence(candidate.Email, officialHost, candidate.SourceType, pageUrl);
            return new VerifiedPublicContact
            {
                Email = candidate.Email,
                SourceUrl = pageUrl,
                SourceType = candidate.SourceType,
                ContactName = candidate.ContactName,
                VerifiedOnUtc = DateTime.UtcNow,
                Confidence = confidence,
                ReasonCode = confidence == ContactConfidence.Low
                    ? ContactDiscoveryReason.ReviewRequired
                    : ContactDiscoveryReason.EmailFound,
                ContactFormUrl = FindContactFormUrl(html, pageUrl),
                PhoneFound = ExtractPhone(html),
                SocialUrls = ExtractSocialUrls(html).ToArray(),
                PagesChecked = string.IsNullOrWhiteSpace(pageUrl) ? Array.Empty<string>() : new[] { pageUrl },
            };
        }
        return null;
    }

    public static IEnumerable<string> ExtractCandidates(string html, string officialHost) =>
        ExtractCandidateContacts(html, officialHost, pageUrl: null).Select(c => c.Email);

    public static IEnumerable<(string Email, string SourceType, string? ContactName)> ExtractCandidateContacts(
        string html,
        string officialHost,
        string? pageUrl)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        officialHost = NormalizeHost(officialHost);

        foreach (Match m in MailtoRx.Matches(html))
        {
            var email = m.Groups[1].Value.Trim().ToLowerInvariant();
            if (!IsAcceptableLocalAndDomainShape(email)) continue;
            if (!seen.Add(email)) continue;
            var name = GuessContactNameNearMailto(html, m.Index);
            yield return (email, "website_mailto", name);
        }

        foreach (Match m in EmailRx.Matches(html))
        {
            var email = m.Value.Trim().ToLowerInvariant();
            if (!IsAcceptableLocalAndDomainShape(email)) continue;
            if (!IsAcceptableBareText(email, officialHost, pageUrl)) continue;
            if (!seen.Add(email)) continue;
            yield return (email, "website_page", null);
        }

        // Obfuscation is a deliberate act of publishing an address, so it counts on any page.
        foreach (var email in DeobfuscateEmails(html))
        {
            if (!seen.Add(email)) continue;
            yield return (email, "website_obfuscated", null);
        }
    }

    /// <summary>
    /// Recovers emails written as "name [at] domain [dot] com", "name (at) domain.com" or
    /// "name AT domain DOT com". Only returns addresses literally present in the HTML.
    /// </summary>
    public static IReadOnlyList<string> DeobfuscateEmails(string html)
    {
        var found = new List<string>();
        if (string.IsNullOrWhiteSpace(html)) return found;
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var rx in new[] { BracketObfuscatedRx, WordObfuscatedRx })
        {
            foreach (Match m in rx.Matches(html))
            {
                var local = m.Groups["local"].Value.Trim().Trim('.').ToLowerInvariant();
                var domain = NormalizeObfuscatedDomain(m.Groups["domain"].Value);
                if (local.Length == 0 || domain.Length == 0) continue;
                if (!DomainShapeRx.IsMatch(domain)) continue;
                var email = local + "@" + domain;
                if (!EmailRx.IsMatch(email)) continue;
                if (!IsAcceptableLocalAndDomainShape(email)) continue;
                if (seen.Add(email)) found.Add(email);
            }
        }
        return found;
    }

    static string NormalizeObfuscatedDomain(string raw)
    {
        var normalized = ObfuscatedDotRx.Replace(raw ?? "", ".");
        normalized = normalized.Replace(" ", "").Replace("\t", "").Replace("\r", "").Replace("\n", "");
        return normalized.Trim('.').ToLowerInvariant();
    }

    /// <summary>
    /// Returns <paramref name="pageUrl"/> when the HTML contains a public contact form
    /// (contact/mail action, or an email/message input). Forms are never submitted.
    /// </summary>
    public static string? FindContactFormUrl(string html, string pageUrl)
    {
        if (string.IsNullOrWhiteSpace(html)) return null;
        var forms = FormTagRx.Matches(html);
        if (forms.Count == 0) return null;

        foreach (Match form in forms)
        {
            var action = FormActionRx.Match(form.Value).Groups["a"].Value.ToLowerInvariant();
            if (action.Contains("contact", StringComparison.Ordinal) || action.Contains("mail", StringComparison.Ordinal))
                return string.IsNullOrWhiteSpace(pageUrl) ? null : pageUrl;
        }

        if (ContactInputRx.IsMatch(html))
            return string.IsNullOrWhiteSpace(pageUrl) ? null : pageUrl;

        return null;
    }

    /// <summary>
    /// Same-host links whose href or anchor text suggests a contact/about/team/partnership page.
    /// </summary>
    public static IReadOnlyList<Uri> ExtractSameHostDiscoveryLinks(string html, Uri baseUri)
    {
        var links = new List<Uri>();
        if (string.IsNullOrWhiteSpace(html) || baseUri == null) return links;
        var baseHost = NormalizeHost(baseUri.Host);
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (Match m in AnchorRx.Matches(html))
        {
            var href = WebUtility.HtmlDecode(m.Groups["href"].Value ?? "").Trim();
            if (href.Length == 0) continue;
            if (href.StartsWith("#", StringComparison.Ordinal)) continue;
            if (href.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase)
                || href.StartsWith("tel:", StringComparison.OrdinalIgnoreCase)
                || href.StartsWith("javascript:", StringComparison.OrdinalIgnoreCase)) continue;

            if (!Uri.TryCreate(baseUri, href, out var abs)) continue;
            if (abs.Scheme != Uri.UriSchemeHttp && abs.Scheme != Uri.UriSchemeHttps) continue;
            if (!HostMatches(NormalizeHost(abs.Host), baseHost)) continue;
            if (AssetSuffixes.Any(s => abs.AbsolutePath.EndsWith(s, StringComparison.OrdinalIgnoreCase))) continue;

            var anchorText = WebUtility.HtmlDecode(TagRx.Replace(m.Groups["text"].Value ?? "", " ")).Trim();
            var haystack = (abs.AbsolutePath + " " + abs.Query + " " + anchorText).ToLowerInvariant();
            if (!DiscoveryKeywords.Any(k => haystack.Contains(k, StringComparison.Ordinal))) continue;

            var clean = new UriBuilder(abs) { Fragment = "" }.Uri;
            if (!seen.Add(clean.ToString().TrimEnd('/'))) continue;
            links.Add(clean);
            if (links.Count >= 24) break;
        }
        return links;
    }

    /// <summary>
    /// HIGH when the email domain is the official domain, or a mailto published on an official page.
    /// MEDIUM for weaker but still real attribution. LOW for off-site or unattributed evidence.
    /// </summary>
    public static ContactConfidence ScoreEmailConfidence(string email, string officialHost, string sourceType, string? pageUrl)
    {
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@')) return ContactConfidence.Low;
        var parts = email.Split('@');
        if (parts.Length != 2) return ContactConfidence.Low;

        var emailDomain = parts[1].Trim().ToLowerInvariant();
        var host = NormalizeHost(officialHost);
        var source = (sourceType ?? "").Trim().ToLowerInvariant();

        if (host.Length > 0 && DomainMatchesOfficial(emailDomain, host)) return ContactConfidence.High;

        var onOfficialPage = PageIsOnOfficialHost(pageUrl, host);
        if (onOfficialPage)
        {
            // A mailto link on the organization's own page is an explicit "write to us here".
            if (source.Contains("mailto", StringComparison.Ordinal)) return ContactConfidence.High;
            return ContactConfidence.Medium;
        }

        if (string.IsNullOrWhiteSpace(pageUrl) && source.Contains("mailto", StringComparison.Ordinal))
            return ContactConfidence.Medium;

        return ContactConfidence.Low;
    }

    static bool PageIsOnOfficialHost(string? pageUrl, string officialHost)
    {
        if (string.IsNullOrWhiteSpace(pageUrl) || officialHost.Length == 0) return false;
        if (!Uri.TryCreate(pageUrl, UriKind.Absolute, out var uri)) return false;
        return HostMatches(NormalizeHost(uri.Host), officialHost);
    }

    static bool HostMatches(string host, string officialHost) =>
        host == officialHost || host.EndsWith("." + officialHost, StringComparison.Ordinal);

    static IReadOnlyList<string> ExtractSocialUrls(string html)
    {
        var found = new List<string>();
        if (string.IsNullOrWhiteSpace(html)) return found;
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (Match m in SocialUrlRx.Matches(html))
        {
            var url = WebUtility.HtmlDecode(m.Value).TrimEnd('"', '\'', ')', ',', '.', ';');
            var lower = url.ToLowerInvariant();
            if (lower.Contains("/sharer", StringComparison.Ordinal)
                || lower.Contains("share.php", StringComparison.Ordinal)
                || lower.Contains("/plugins/", StringComparison.Ordinal)
                || lower.Contains("/intent/", StringComparison.Ordinal)) continue;
            if (!Uri.TryCreate(url, UriKind.Absolute, out _)) continue;
            if (seen.Add(url)) found.Add(url);
            if (found.Count >= 12) break;
        }
        return found;
    }

    static string? ExtractPhone(string html)
    {
        if (string.IsNullOrWhiteSpace(html)) return null;
        var tel = TelHrefRx.Match(html);
        if (tel.Success)
        {
            var num = WebUtility.HtmlDecode(tel.Groups["num"].Value).Trim();
            if (num.Count(char.IsDigit) >= 7) return num;
        }
        var text = TagRx.Replace(html, " ");
        var phone = PhoneTextRx.Match(text);
        return phone.Success ? phone.Value.Trim() : null;
    }

    static bool IsAcceptableLocalAndDomainShape(string email)
    {
        if (!email.Contains('@')) return false;
        var parts = email.Split('@');
        if (parts.Length != 2) return false;
        var local = parts[0];
        var domain = parts[1].ToLowerInvariant();
        if (local.Length == 0 || domain.Length == 0) return false;
        if (RejectLocalParts.Contains(local)) return false;
        if (RejectDomains.Contains(domain)) return false;
        if (domain.Contains("example.") || AssetSuffixes.Any(s => domain.EndsWith(s, StringComparison.Ordinal))) return false;
        return true;
    }

    static bool IsAcceptableBareText(string email, string officialHost, string? pageUrl)
    {
        var domain = email.Split('@')[1].ToLowerInvariant();
        if (DomainMatchesOfficial(domain, officialHost)) return true;
        if (string.IsNullOrWhiteSpace(pageUrl)) return false;
        if (!Uri.TryCreate(pageUrl, UriKind.Absolute, out var uri)) return false;
        var pathAndQuery = (uri.AbsolutePath + uri.Query).ToLowerInvariant();
        return pathAndQuery.Contains("contact", StringComparison.Ordinal)
            || pathAndQuery.Contains("about", StringComparison.Ordinal)
            || pathAndQuery.Contains("team", StringComparison.Ordinal)
            || pathAndQuery.Contains("staff", StringComparison.Ordinal)
            || pathAndQuery.Contains("coach", StringComparison.Ordinal)
            || pathAndQuery.Contains("membership", StringComparison.Ordinal)
            || pathAndQuery.Contains("partner", StringComparison.Ordinal)
            || pathAndQuery.Contains("sponsor", StringComparison.Ordinal)
            || pathAndQuery.Contains("press", StringComparison.Ordinal)
            || pathAndQuery.Contains("media", StringComparison.Ordinal)
            || pathAndQuery.Contains("connect", StringComparison.Ordinal);
    }

    static bool DomainMatchesOfficial(string emailDomain, string officialHost)
    {
        emailDomain = emailDomain.Trim().ToLowerInvariant();
        officialHost = officialHost.Trim().ToLowerInvariant();
        if (emailDomain.Length == 0 || officialHost.Length == 0) return false;
        if (emailDomain == officialHost) return true;
        if (emailDomain.EndsWith("." + officialHost, StringComparison.Ordinal)) return true;
        var emailBase = emailDomain.StartsWith("www.") ? emailDomain[4..] : emailDomain;
        var hostBase = officialHost.StartsWith("www.") ? officialHost[4..] : officialHost;
        return emailBase == hostBase;
    }

    static string? GuessContactNameNearMailto(string html, int mailtoIndex)
    {
        var afterLen = Math.Min(160, html.Length - mailtoIndex);
        if (afterLen > 0)
        {
            var after = html.Substring(mailtoIndex, afterLen);
            var anchorText = Regex.Match(after, @"mailto:[^""'\s>]+[^>]*>\s*([^<]{2,80}?)\s*<", RegexOptions.IgnoreCase);
            if (anchorText.Success && LooksLikePersonName(anchorText.Groups[1].Value))
                return WebUtility.HtmlDecode(anchorText.Groups[1].Value).Trim();
        }

        var start = Math.Max(0, mailtoIndex - 120);
        var before = html.Substring(start, mailtoIndex - start);
        var beforeMatch = Regex.Match(
            before,
            @"([A-Z][a-zA-Z'\-]+(?:\s+[A-Z][a-zA-Z'\-]+){0,3})\s*<\s*a\b",
            RegexOptions.IgnoreCase | RegexOptions.RightToLeft);
        if (beforeMatch.Success && LooksLikePersonName(beforeMatch.Groups[1].Value))
            return WebUtility.HtmlDecode(beforeMatch.Groups[1].Value).Trim();
        return null;
    }

    static bool LooksLikePersonName(string raw)
    {
        var name = WebUtility.HtmlDecode(raw ?? "").Trim();
        if (name.Length is < 2 or > 80) return false;
        if (name.Contains('@') || name.Contains('<') || name.Contains('>')) return false;
        if (name.Equals("email", StringComparison.OrdinalIgnoreCase)
            || name.Equals("contact", StringComparison.OrdinalIgnoreCase)
            || name.Equals("mail", StringComparison.OrdinalIgnoreCase)
            || name.Equals("here", StringComparison.OrdinalIgnoreCase)
            || name.Equals("us", StringComparison.OrdinalIgnoreCase))
            return false;
        return Regex.IsMatch(name, @"^[A-Za-z][A-Za-z'\-]*(?:\s+[A-Za-z][A-Za-z'\-]*){0,3}$");
    }
}

public sealed class VerifiedPublicContact
{
    public string Email { get; set; } = "";
    public string SourceUrl { get; set; } = "";
    public string? SourceType { get; set; }
    public string? ContactName { get; set; }
    public DateTime VerifiedOnUtc { get; set; }

    /// <summary>Attribution strength — see <see cref="PublicBusinessContactVerifier.ScoreEmailConfidence"/>.</summary>
    public ContactConfidence Confidence { get; set; } = ContactConfidence.Low;
    /// <summary>Machine-readable reason code — see <see cref="ContactDiscoveryReason"/>.</summary>
    public string? ReasonCode { get; set; }
    public string? ContactFormUrl { get; set; }
    public string? PhoneFound { get; set; }
    public IReadOnlyList<string> SocialUrls { get; set; } = Array.Empty<string>();
    public IReadOnlyList<string> PagesChecked { get; set; } = Array.Empty<string>();
    public string? SourcesCheckedSummary { get; set; }
}
