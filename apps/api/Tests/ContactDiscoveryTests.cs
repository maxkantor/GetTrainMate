using System.Net;
using System.Text;
using GetTrainMate.Api.Services.PartnerOutreach;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace GetTrainMate.Api.Tests;

public class ContactDiscoveryTests
{
    const string Site = "https://exampleclub.org";

    // ---------- HTML-level extraction ----------

    [Fact]
    public void ContactDiscovery_extracts_mailto_with_high_confidence()
    {
        var html = "<a href=\"mailto:Coach@ExampleClub.org\">Email the coach</a>";
        var found = PublicBusinessContactVerifier.TryVerifyFromHtml(html, "exampleclub.org", Site + "/contact");
        Assert.NotNull(found);
        Assert.Equal("coach@exampleclub.org", found!.Email);
        Assert.Equal("website_mailto", found.SourceType);
        Assert.Equal(ContactConfidence.High, found.Confidence);
        Assert.Equal(ContactDiscoveryReason.EmailFound, found.ReasonCode);
    }

    [Fact]
    public void ContactDiscovery_extracts_visible_email_text()
    {
        var html = "<p>Membership questions? Write to memberships@exampleclub.org any time.</p>";
        var emails = PublicBusinessContactVerifier.ExtractCandidates(html, "exampleclub.org").ToList();
        Assert.Single(emails);
        Assert.Equal("memberships@exampleclub.org", emails[0]);

        var found = PublicBusinessContactVerifier.TryVerifyFromHtml(html, "exampleclub.org", Site + "/membership");
        Assert.NotNull(found);
        Assert.Equal("website_page", found!.SourceType);
    }

    [Theory]
    [InlineData("Reach us: info [at] exampleclub [dot] org", "info@exampleclub.org")]
    [InlineData("Reach us: hello (at) exampleclub.org", "hello@exampleclub.org")]
    [InlineData("Reach us: coach AT exampleclub DOT org", "coach@exampleclub.org")]
    [InlineData("Reach us: front.desk [AT] exampleclub [DOT] org", "front.desk@exampleclub.org")]
    public void ContactDiscovery_deobfuscates_public_email_patterns(string html, string expected)
    {
        var emails = PublicBusinessContactVerifier.DeobfuscateEmails(html);
        Assert.Contains(expected, emails);
    }

    [Fact]
    public void ContactDiscovery_deobfuscation_ignores_ordinary_prose()
    {
        // "available at www.exampleclub.org" is prose, not an obfuscated address.
        Assert.Empty(PublicBusinessContactVerifier.DeobfuscateEmails(
            "<p>Schedules are available at www.exampleclub.org and posted at the front desk.</p>"));
        Assert.Empty(PublicBusinessContactVerifier.DeobfuscateEmails("<p>Welcome to our gym.</p>"));
    }

    [Fact]
    public void ContactDiscovery_obfuscated_email_surfaces_as_candidate()
    {
        var html = "<p>Write to us: owner [at] exampleclub [dot] org</p>";
        var found = PublicBusinessContactVerifier.TryVerifyFromHtml(html, "exampleclub.org", Site + "/about");
        Assert.NotNull(found);
        Assert.Equal("owner@exampleclub.org", found!.Email);
        Assert.Equal("website_obfuscated", found.SourceType);
        Assert.Equal(ContactConfidence.High, found.Confidence);
    }

    // ---------- Confidence scoring ----------

    [Fact]
    public void ContactDiscovery_official_domain_email_is_high_confidence()
    {
        Assert.Equal(
            ContactConfidence.High,
            PublicBusinessContactVerifier.ScoreEmailConfidence(
                "info@exampleclub.org", "exampleclub.org", "website_page", Site + "/contact"));

        // Official domain still wins even when the evidence page is elsewhere.
        Assert.Equal(
            ContactConfidence.High,
            PublicBusinessContactVerifier.ScoreEmailConfidence(
                "info@exampleclub.org", "www.exampleclub.org", "social_page", "https://facebook.com/exampleclub/about"));
    }

    [Fact]
    public void ContactDiscovery_public_gmail_mailto_on_official_page_is_high_confidence()
    {
        Assert.Equal(
            ContactConfidence.High,
            PublicBusinessContactVerifier.ScoreEmailConfidence(
                "club.ops@gmail.com", "atlantapickleballclub.com", "website_mailto",
                "https://atlantapickleballclub.com/contact"));
    }

    [Fact]
    public void ContactDiscovery_offsite_or_weak_attribution_is_medium_or_low()
    {
        Assert.Equal(
            ContactConfidence.Medium,
            PublicBusinessContactVerifier.ScoreEmailConfidence(
                "hello@gmail.com", "exampleclub.org", "website_page", Site + "/about-us"));

        Assert.Equal(
            ContactConfidence.Low,
            PublicBusinessContactVerifier.ScoreEmailConfidence(
                "hello@gmail.com", "exampleclub.org", "social_page", "https://facebook.com/someclub/about"));
    }

    // ---------- Contact forms and link discovery ----------

    [Fact]
    public void ContactDiscovery_finds_contact_form_by_action_or_inputs()
    {
        var byAction = "<form action=\"/contact-submit\" method=\"post\"><input name=\"x\" /></form>";
        Assert.Equal(Site + "/contact", PublicBusinessContactVerifier.FindContactFormUrl(byAction, Site + "/contact"));

        var byInputs = "<form action=\"/wp/submit\"><input type=\"email\" /><textarea name=\"message\"></textarea></form>";
        Assert.Equal(Site + "/connect", PublicBusinessContactVerifier.FindContactFormUrl(byInputs, Site + "/connect"));

        var searchOnly = "<form action=\"/search\"><input type=\"text\" name=\"q\" /></form>";
        Assert.Null(PublicBusinessContactVerifier.FindContactFormUrl(searchOnly, Site + "/"));
        Assert.Null(PublicBusinessContactVerifier.FindContactFormUrl("<p>no forms here</p>", Site + "/"));
    }

    [Fact]
    public void ContactDiscovery_extracts_same_host_discovery_links_only()
    {
        var html = """
            <a href="/meet-our-coaches">Meet the coaches</a>
            <a href="/pages/partnership-inquiries">Partnerships</a>
            <a href="https://exampleclub.org/press-room">Press</a>
            <a href="https://facebook.com/exampleclub/about">Facebook</a>
            <a href="mailto:info@exampleclub.org">Email</a>
            <a href="/pricing">Pricing</a>
            <a href="/logo-about.png">Logo</a>
            <a href="#about">Skip</a>
            """;
        var links = PublicBusinessContactVerifier.ExtractSameHostDiscoveryLinks(html, new Uri(Site + "/"))
            .Select(u => u.ToString())
            .ToList();

        Assert.Contains(Site + "/meet-our-coaches", links);
        Assert.Contains(Site + "/pages/partnership-inquiries", links);
        Assert.Contains(Site + "/press-room", links);
        Assert.DoesNotContain(links, l => l.Contains("facebook.com"));
        Assert.DoesNotContain(links, l => l.Contains("pricing"));
        Assert.DoesNotContain(links, l => l.Contains(".png"));
    }

    // ---------- Full probe pipeline ----------

    [Fact]
    public async Task ContactDiscovery_probe_finds_homepage_email()
    {
        var verifier = Build(out var handler, new()
        {
            [Site + "/"] = "<html><body><a href=\"mailto:info@exampleclub.org\">Contact us</a></body></html>",
        });

        var probe = await verifier.ProbeAsync(new Uri(Site));

        Assert.Equal(WebsiteProbeStatus.EmailFound, probe.Status);
        Assert.Equal("info@exampleclub.org", probe.Contact!.Email);
        Assert.Equal(ContactConfidence.High, probe.Confidence);
        Assert.Equal(ContactDiscoveryReason.EmailFound, probe.ReasonCode);
        Assert.Equal("Official website homepage only", probe.SourcesCheckedSummary);
        Assert.Single(probe.PagesChecked);
        Assert.Single(handler.Requested);
    }

    [Fact]
    public async Task ContactDiscovery_probe_finds_contact_page_email()
    {
        var verifier = Build(out _, new()
        {
            [Site + "/"] = "<html><body><h1>Welcome to the club</h1></body></html>",
            [Site + "/contact"] = "<html><body><a href=\"mailto:frontdesk@exampleclub.org\">Email</a></body></html>",
        });

        var probe = await verifier.ProbeAsync(new Uri(Site));

        Assert.Equal(WebsiteProbeStatus.EmailFound, probe.Status);
        Assert.Equal("frontdesk@exampleclub.org", probe.Contact!.Email);
        Assert.Equal(Site + "/contact", probe.Contact.SourceUrl);
        Assert.Contains(Site + "/", probe.PagesChecked);
        Assert.Contains(Site + "/contact", probe.PagesChecked);
        Assert.Equal("Official website + 1 internal page", probe.SourcesCheckedSummary);
    }

    [Fact]
    public async Task ContactDiscovery_probe_finds_about_and_team_page_email()
    {
        var verifier = Build(out _, new()
        {
            [Site + "/"] = "<html><body><h1>Club</h1></body></html>",
            [Site + "/about"] = "<html><body><p>Founded in 2011.</p></body></html>",
            [Site + "/team"] = "<html><body><a href=\"mailto:Jane@exampleclub.org\">Jane Smith</a></body></html>",
        });

        var probe = await verifier.ProbeAsync(new Uri(Site));

        Assert.Equal(WebsiteProbeStatus.EmailFound, probe.Status);
        Assert.Equal("jane@exampleclub.org", probe.Contact!.Email);
        Assert.Equal("Jane Smith", probe.Contact.ContactName);
        Assert.Equal(Site + "/team", probe.Contact.SourceUrl);
    }

    [Fact]
    public async Task ContactDiscovery_probe_follows_homepage_links_to_unlisted_pages()
    {
        var verifier = Build(out var handler, new()
        {
            [Site + "/"] = """
                <html><body>
                  <a href="/meet-our-coaching-staff">Meet the coaching staff</a>
                  <a href="/pricing">Pricing</a>
                </body></html>
                """,
            [Site + "/meet-our-coaching-staff"] = "<html><body>Head coach: coach [at] exampleclub [dot] org</body></html>",
        });

        var probe = await verifier.ProbeAsync(new Uri(Site));

        Assert.Equal(WebsiteProbeStatus.EmailFound, probe.Status);
        Assert.Equal("coach@exampleclub.org", probe.Contact!.Email);
        Assert.Equal("website_obfuscated", probe.Contact.SourceType);
        Assert.Contains(Site + "/meet-our-coaching-staff", probe.PagesChecked);
        Assert.DoesNotContain(handler.Requested, u => u.Contains("/pricing"));
    }

    [Fact]
    public async Task ContactDiscovery_probe_prefers_high_confidence_email()
    {
        var verifier = Build(out _, new()
        {
            [Site + "/"] = "<html><body><h1>Club</h1></body></html>",
            [Site + "/contact"] = "<html><body><p>Email hello@gmail.com for details.</p></body></html>",
            [Site + "/about"] = "<html><body><p>Office: office@exampleclub.org</p></body></html>",
        });

        var probe = await verifier.ProbeAsync(new Uri(Site));

        Assert.Equal("office@exampleclub.org", probe.Contact!.Email);
        Assert.Equal(ContactConfidence.High, probe.Confidence);
    }

    [Fact]
    public async Task ContactDiscovery_probe_keeps_medium_confidence_email_when_no_high_match()
    {
        var verifier = Build(out _, new()
        {
            [Site + "/"] = "<html><body><h1>Club</h1></body></html>",
            [Site + "/contact"] = "<html><body><p>Email exampleclubinfo@gmail.com for details.</p></body></html>",
        });

        var probe = await verifier.ProbeAsync(new Uri(Site));

        Assert.Equal(WebsiteProbeStatus.EmailFound, probe.Status);
        Assert.Equal("exampleclubinfo@gmail.com", probe.Contact!.Email);
        Assert.Equal(ContactConfidence.Medium, probe.Confidence);
    }

    [Fact]
    public async Task ContactDiscovery_probe_reports_contact_form_phone_and_socials_when_no_email()
    {
        var verifier = Build(out _, new()
        {
            [Site + "/"] = """
                <html><body>
                  <a href="tel:+1 404-555-0111">Call us</a>
                  <a href="https://www.instagram.com/exampleclub">Instagram</a>
                  <a href="/contact">Contact</a>
                </body></html>
                """,
            [Site + "/contact"] = """
                <html><body>
                  <form action="/forms/contact" method="post">
                    <input type="email" name="email" />
                    <textarea name="message"></textarea>
                  </form>
                </body></html>
                """,
        });

        var probe = await verifier.ProbeAsync(new Uri(Site));

        Assert.Equal(WebsiteProbeStatus.ContactFormFound, probe.Status);
        Assert.Null(probe.Contact);
        Assert.Equal(ContactDiscoveryReason.ContactFormFound, probe.ReasonCode);
        Assert.Equal(Site + "/contact", probe.ContactFormUrl);
        Assert.Contains("404", probe.PhoneFound);
        Assert.Contains(probe.SocialUrls, s => s.Contains("instagram.com/exampleclub"));
    }

    [Fact]
    public async Task ContactDiscovery_probe_treats_wix_placeholder_as_no_contact()
    {
        var wix = """
            <html><body>
            <h1>This domain isn't connected to a site</h1>
            <p>If this domain is yours, head to the Domains page in your Wix dashboard.</p>
            </body></html>
            """;
        var verifier = Build(out var handler, new()
        {
            [Site + "/"] = wix,
            [Site + "/contact"] = "<html><body><a href=\"mailto:info@exampleclub.org\">Email</a></body></html>",
        });

        var probe = await verifier.ProbeAsync(new Uri(Site));

        Assert.Equal(WebsiteProbeStatus.ParkingOrDisconnected, probe.Status);
        Assert.Null(probe.Contact);
        Assert.Equal(ContactDiscoveryReason.Parking, probe.ReasonCode);
        // A disconnected domain must not be crawled further.
        Assert.Single(handler.Requested);
    }

    [Fact]
    public async Task ContactDiscovery_probe_never_invents_info_at_domain()
    {
        var verifier = Build(out _, new()
        {
            [Site + "/"] = "<html><body><h1>Welcome</h1><p>Drop in any time.</p></body></html>",
            [Site + "/about"] = "<html><body><p>We opened in 2014.</p></body></html>",
        });

        var probe = await verifier.ProbeAsync(new Uri(Site));

        Assert.Equal(WebsiteProbeStatus.LiveNoEmail, probe.Status);
        Assert.Null(probe.Contact);
        Assert.Equal(ContactDiscoveryReason.NoPublicContact, probe.ReasonCode);
        Assert.Null(probe.ContactFormUrl);
    }

    [Fact]
    public async Task ContactDiscovery_probe_finds_partnerships_page_email()
    {
        var verifier = Build(out _, new()
        {
            [Site + "/"] = "<html><body><h1>Club</h1></body></html>",
            [Site + "/partnerships"] = "<html><body><a href=\"mailto:partners@exampleclub.org\">Partner with us</a></body></html>",
        });

        var probe = await verifier.ProbeAsync(new Uri(Site));

        Assert.Equal(WebsiteProbeStatus.EmailFound, probe.Status);
        Assert.Equal("partners@exampleclub.org", probe.Contact!.Email);
        Assert.Equal(Site + "/partnerships", probe.Contact.SourceUrl);
    }

    [Fact]
    public async Task ContactDiscovery_probe_reports_rate_limit()
    {
        var verifier = BuildStatus(out _, new()
        {
            [Site + "/"] = HttpStatusCode.TooManyRequests,
            [Site + "/contact"] = HttpStatusCode.TooManyRequests,
        });

        var probe = await verifier.ProbeAsync(new Uri(Site));

        Assert.Equal(WebsiteProbeStatus.RateLimited, probe.Status);
        Assert.Equal(ContactDiscoveryReason.RateLimited, probe.ReasonCode);
        Assert.Null(probe.Contact);
    }

    [Fact]
    public async Task ContactDiscovery_probe_reports_temporary_5xx()
    {
        var verifier = BuildStatus(out _, new()
        {
            [Site + "/"] = HttpStatusCode.ServiceUnavailable,
            [Site + "/contact"] = HttpStatusCode.BadGateway,
        });

        var probe = await verifier.ProbeAsync(new Uri(Site));

        Assert.Equal(WebsiteProbeStatus.TemporaryFailure, probe.Status);
        Assert.Equal(ContactDiscoveryReason.TemporaryFailure, probe.ReasonCode);
        Assert.Null(probe.Contact);
    }

    [Fact]
    public async Task ContactDiscovery_probe_reports_unreachable_site()
    {
        var verifier = Build(out _, new());

        var probe = await verifier.ProbeAsync(new Uri(Site));

        Assert.Equal(WebsiteProbeStatus.Unreachable, probe.Status);
        Assert.Null(probe.Contact);
        Assert.Equal(ContactDiscoveryReason.Unreachable, probe.ReasonCode);
        Assert.Equal("No reachable pages on the official website", probe.SourcesCheckedSummary);
    }

    static PublicBusinessContactVerifier Build(out StubHandler handler, Dictionary<string, string> pages)
    {
        handler = new StubHandler(pages);
        var http = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(5) };
        return new PublicBusinessContactVerifier(http, NullLogger<PublicBusinessContactVerifier>.Instance);
    }

    static PublicBusinessContactVerifier BuildStatus(out StubHandler handler, Dictionary<string, HttpStatusCode> statuses)
    {
        handler = new StubHandler(new Dictionary<string, string>(), statuses);
        var http = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(5) };
        return new PublicBusinessContactVerifier(http, NullLogger<PublicBusinessContactVerifier>.Instance);
    }

    sealed class StubHandler : HttpMessageHandler
    {
        readonly Dictionary<string, string> _pages;
        readonly Dictionary<string, HttpStatusCode> _statuses;
        public List<string> Requested { get; } = new();

        public StubHandler(Dictionary<string, string> pages, Dictionary<string, HttpStatusCode>? statuses = null)
        {
            _pages = new Dictionary<string, string>(pages, StringComparer.OrdinalIgnoreCase);
            _statuses = statuses ?? new Dictionary<string, HttpStatusCode>(StringComparer.OrdinalIgnoreCase);
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var url = request.RequestUri!.ToString();
            Requested.Add(url);
            if (_statuses.TryGetValue(url, out var code))
                return Task.FromResult(new HttpResponseMessage(code));
            if (_pages.TryGetValue(url, out var html))
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(html, Encoding.UTF8, "text/html"),
                });
            }
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
        }
    }
}
