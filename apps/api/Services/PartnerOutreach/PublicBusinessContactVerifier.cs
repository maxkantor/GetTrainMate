using System.Net;
using System.Text.RegularExpressions;

namespace GetTrainMate.Api.Services.PartnerOutreach;

/// <summary>
/// Fetches organization-controlled pages and extracts exact public business emails.
/// Never infers addresses (no info@domain guessing without HTML evidence).
/// </summary>
public sealed class PublicBusinessContactVerifier
{
    static readonly Regex EmailRx = new(
        @"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    static readonly string[] ContactPaths =
    {
        "/contact", "/contact-us", "/contactus", "/about/contact", "/about-us/contact",
        "/about", "/about-us", "/team", "/locations", "/",
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

    public async Task<VerifiedPublicContact?> TryVerifyAsync(Uri officialWebsite, CancellationToken ct = default)
    {
        if (!officialWebsite.Scheme.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            return null;
        var host = officialWebsite.Host.ToLowerInvariant();
        if (host.StartsWith("www.")) host = host[4..];

        foreach (var path in ContactPaths)
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

                foreach (var email in ExtractCandidates(html, host))
                {
                    return new VerifiedPublicContact
                    {
                        Email = email,
                        SourceUrl = pageUrl,
                        VerifiedOnUtc = DateTime.UtcNow,
                    };
                }
            }
            catch (Exception ex)
            {
                _log.LogDebug(ex, "Contact page fetch failed for {Url}", pageUrl);
            }
        }

        return null;
    }

    public static IEnumerable<string> ExtractCandidates(string html, string officialHost)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        // mailto: links first (strongest signal)
        foreach (Match m in Regex.Matches(html, @"mailto:([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})", RegexOptions.IgnoreCase))
        {
            var email = m.Groups[1].Value.Trim().ToLowerInvariant();
            if (IsAcceptable(email, officialHost) && seen.Add(email))
                yield return email;
        }
        foreach (Match m in EmailRx.Matches(html))
        {
            var email = m.Value.Trim().ToLowerInvariant();
            if (IsAcceptable(email, officialHost) && seen.Add(email))
                yield return email;
        }
    }

    static bool IsAcceptable(string email, string officialHost)
    {
        if (!email.Contains('@')) return false;
        var parts = email.Split('@');
        if (parts.Length != 2) return false;
        var local = parts[0];
        var domain = parts[1].ToLowerInvariant();
        if (RejectLocalParts.Contains(local)) return false;
        if (domain.Contains("example.") || domain.EndsWith(".png") || domain.EndsWith(".jpg")) return false;
        if (!DomainMatchesOfficial(domain, officialHost)) return false;
        return true;
    }

    static bool DomainMatchesOfficial(string emailDomain, string officialHost)
    {
        emailDomain = emailDomain.Trim().ToLowerInvariant();
        officialHost = officialHost.Trim().ToLowerInvariant();
        if (emailDomain == officialHost) return true;
        if (emailDomain.EndsWith("." + officialHost, StringComparison.Ordinal)) return true;
        // Allow www. mismatch only when registrable host matches
        var emailBase = emailDomain.StartsWith("www.") ? emailDomain[4..] : emailDomain;
        var hostBase = officialHost.StartsWith("www.") ? officialHost[4..] : officialHost;
        return emailBase == hostBase;
    }
}

public sealed class VerifiedPublicContact
{
    public string Email { get; set; } = "";
    public string SourceUrl { get; set; } = "";
    public DateTime VerifiedOnUtc { get; set; }
}
