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
}

public sealed class WebsiteProbeResult
{
    public WebsiteProbeStatus Status { get; init; }
    public VerifiedPublicContact? Contact { get; init; }
    public string? Detail { get; init; }
    public string? SampleUrl { get; init; }
}

/// <summary>
/// Fetches organization-controlled pages and extracts exact public business emails.
/// Never infers addresses (no info@domain guessing without HTML evidence).
/// </summary>
public sealed class PublicBusinessContactVerifier
{
    static readonly Regex EmailRx = new(
        @"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    static readonly Regex MailtoRx = new(
        @"mailto:([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})",
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    static readonly string[] ContactPaths =
    {
        // Homepage first — catch Wix/parked domains before scraping contact paths.
        "/",
        "/contact", "/contact-us", "/contactus", "/about/contact", "/about-us/contact",
        "/get-in-touch", "/connect", "/staff", "/coaches", "/our-team", "/pages/contact",
        "/en/contact", "/?page_id=contact",
        "/about", "/about-us", "/team", "/locations",
    };

    static readonly HashSet<string> RejectLocalParts = new(StringComparer.OrdinalIgnoreCase)
    {
        "noreply", "no-reply", "donotreply", "do-not-reply", "postmaster", "abuse",
        "privacy", "unsubscribe", "mailer-daemon", "bounce", "newsletter",
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
            };
        }

        var host = officialWebsite.Host.ToLowerInvariant();
        if (host.StartsWith("www.")) host = host[4..];

        var paths = maxContactPaths is > 0
            ? ContactPaths.Take(maxContactPaths.Value)
            : ContactPaths;

        var anySuccess = false;
        string? parkingDetail = null;
        string? sampleUrl = null;

        foreach (var path in paths)
        {
            var pageUrl = new Uri(officialWebsite, path).ToString();
            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, pageUrl);
                req.Headers.TryAddWithoutValidation("User-Agent", "GetTrainMatePartnerDiscovery/1.0 (+https://gettrainmate.com/contact)");
                using var res = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
                if (!res.IsSuccessStatusCode) continue;
                var html = await res.Content.ReadAsStringAsync(ct);
                if (string.IsNullOrWhiteSpace(html)) continue;

                anySuccess = true;
                sampleUrl ??= pageUrl;

                if (IsParkingOrDisconnectedHtml(html))
                {
                    parkingDetail ??= DetectParkingDetail(html);
                    // Parking homepage: no point scraping more paths on a disconnected domain.
                    if (path is "/" or "")
                    {
                        return new WebsiteProbeResult
                        {
                            Status = WebsiteProbeStatus.ParkingOrDisconnected,
                            Detail = parkingDetail ?? "Domain parking / not connected to a site.",
                            SampleUrl = pageUrl,
                        };
                    }
                    continue;
                }

                var found = TryVerifyFromHtml(html, host, pageUrl);
                if (found != null)
                {
                    return new WebsiteProbeResult
                    {
                        Status = WebsiteProbeStatus.EmailFound,
                        Contact = found,
                        SampleUrl = pageUrl,
                    };
                }
            }
            catch (Exception ex)
            {
                _log.LogDebug(ex, "Contact page fetch failed for {Url}", pageUrl);
            }
        }

        // Also probe homepage explicitly if not already covered as last path — ContactPaths includes "/".
        if (!anySuccess)
        {
            return new WebsiteProbeResult
            {
                Status = WebsiteProbeStatus.Unreachable,
                Detail = "Could not reach the website (DNS, timeout, or all pages failed).",
                SampleUrl = officialWebsite.ToString(),
            };
        }

        if (parkingDetail != null)
        {
            return new WebsiteProbeResult
            {
                Status = WebsiteProbeStatus.ParkingOrDisconnected,
                Detail = parkingDetail,
                SampleUrl = sampleUrl,
            };
        }

        return new WebsiteProbeResult
        {
            Status = WebsiteProbeStatus.LiveNoEmail,
            Detail = "Website is reachable but no public business email was found on contact/about pages.",
            SampleUrl = sampleUrl,
        };
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
        var officialHost = (host ?? "").Trim().ToLowerInvariant();
        if (officialHost.StartsWith("www.")) officialHost = officialHost[4..];

        foreach (var candidate in ExtractCandidateContacts(html, officialHost, pageUrl))
        {
            return new VerifiedPublicContact
            {
                Email = candidate.Email,
                SourceUrl = pageUrl,
                SourceType = candidate.SourceType,
                ContactName = candidate.ContactName,
                VerifiedOnUtc = DateTime.UtcNow,
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
        officialHost = (officialHost ?? "").Trim().ToLowerInvariant();
        if (officialHost.StartsWith("www.")) officialHost = officialHost[4..];

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
    }

    static bool IsAcceptableLocalAndDomainShape(string email)
    {
        if (!email.Contains('@')) return false;
        var parts = email.Split('@');
        if (parts.Length != 2) return false;
        var local = parts[0];
        var domain = parts[1].ToLowerInvariant();
        if (RejectLocalParts.Contains(local)) return false;
        if (domain.Contains("example.") || domain.EndsWith(".png") || domain.EndsWith(".jpg")) return false;
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
            || pathAndQuery.Contains("about", StringComparison.Ordinal);
    }

    static bool DomainMatchesOfficial(string emailDomain, string officialHost)
    {
        emailDomain = emailDomain.Trim().ToLowerInvariant();
        officialHost = officialHost.Trim().ToLowerInvariant();
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
}
