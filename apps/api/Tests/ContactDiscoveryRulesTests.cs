using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services.PartnerOutreach;
using Xunit;

namespace GetTrainMate.Api.Tests;

public class ContactDiscoveryRulesTests
{
    static ContactProbeSignals Probe(
        WebsiteProbeStatus status,
        string? email = null,
        ContactConfidence confidence = ContactConfidence.Low,
        string? contactFormUrl = null,
        string? detail = null)
    {
        const string page = "https://atlantastrength.example/contact";
        var probe = new WebsiteProbeResult
        {
            Status = status,
            Confidence = confidence,
            ContactFormUrl = contactFormUrl,
            Detail = detail,
            SampleUrl = page,
            PagesChecked = new[] { "https://atlantastrength.example/", page },
            SourcesCheckedSummary = "Official website + 1 internal page",
            Contact = email is null
                ? null
                : new VerifiedPublicContact
                {
                    Email = email,
                    SourceUrl = page,
                    SourceType = "website_mailto",
                    Confidence = confidence,
                    VerifiedOnUtc = new DateTime(2026, 9, 20, 12, 0, 0, DateTimeKind.Utc),
                },
        };
        return ContactDiscoveryRules.FromProbe(probe);
    }

    [Theory]
    [InlineData("https://www.Gym.Example/contact", "gym.example")]
    [InlineData("gym.example", "gym.example")]
    [InlineData("http://sub.gym.example", "sub.gym.example")]
    public void NormalizeHost_strips_scheme_and_www(string raw, string expected)
    {
        Assert.Equal(expected, ContactDiscoveryRules.NormalizeHost(raw));
    }

    [Fact]
    public void NormalizeHost_returns_null_for_blank()
    {
        Assert.Null(ContactDiscoveryRules.NormalizeHost(null));
        Assert.Null(ContactDiscoveryRules.NormalizeHost("   "));
    }

    [Theory]
    [InlineData("gym.example", "https://www.gym.example", true)]
    [InlineData("mail.gym.example", "https://gym.example", true)]
    [InlineData("gym.co.uk", "https://www.gym.co.uk", true)]
    [InlineData("planetfitness.com", "https://atlantastrength.example", false)]
    [InlineData("gmail.com", "https://gym.example", false)]
    public void DomainMatchesHost_only_accepts_same_registered_domain(string emailDomain, string site, bool expected)
    {
        Assert.Equal(expected, ContactDiscoveryRules.DomainMatchesHost(emailDomain, site));
    }

    [Fact]
    public void FromProbe_carries_verifier_confidence_pages_and_form()
    {
        var high = Probe(WebsiteProbeStatus.EmailFound, "hello@atlantastrength.example", ContactConfidence.High);
        Assert.Equal(nameof(WebsiteProbeStatus.EmailFound), high.WebsiteStatus);
        Assert.True(high.HasEmail);
        Assert.Equal(ContactDiscoveryRules.ConfidenceHigh, high.Confidence);
        Assert.False(high.HasContactForm);
        Assert.Equal(2, high.PagesCheckedCount);
        Assert.Equal("Official website + 1 internal page", high.SourcesCheckedSummary);

        var medium = Probe(WebsiteProbeStatus.EmailFound, "info@franchise-corp.example", ContactConfidence.Medium);
        Assert.Equal(ContactDiscoveryRules.ConfidenceMedium, medium.Confidence);

        var form = Probe(WebsiteProbeStatus.ContactFormFound, contactFormUrl: "https://atlantastrength.example/contact");
        Assert.True(form.HasContactForm);
        Assert.False(form.HasEmail);
    }

    [Fact]
    public void FromProbe_treats_missing_probe_as_unreachable()
    {
        var signals = ContactDiscoveryRules.FromProbe(null);
        Assert.Equal(nameof(WebsiteProbeStatus.Unreachable), signals.WebsiteStatus);
        Assert.False(signals.HasEmail);
        Assert.Equal(ContactDiscoveryRules.ConfidenceLow, signals.Confidence);
        Assert.Equal(ContactDiscoveryReason.Unreachable, signals.ReasonCode);
    }

    [Fact]
    public void Confidence_enum_maps_to_stored_strings()
    {
        Assert.Equal(ContactDiscoveryRules.ConfidenceHigh, ContactDiscoveryRules.FromContactConfidence(ContactConfidence.High));
        Assert.Equal(ContactDiscoveryRules.ConfidenceMedium, ContactDiscoveryRules.FromContactConfidence(ContactConfidence.Medium));
        Assert.Equal(ContactDiscoveryRules.ConfidenceLow, ContactDiscoveryRules.FromContactConfidence(ContactConfidence.Low));
    }

    [Fact]
    public void High_confidence_email_is_saved_and_medium_goes_to_review()
    {
        var high = Probe(WebsiteProbeStatus.EmailFound, "hello@atlantastrength.example", ContactConfidence.High);
        Assert.Equal(ContactDiscoveryRules.DiscoveryEmailFound, ContactDiscoveryRules.DiscoveryStatusFor(high, 1));
        Assert.Equal(ContactDiscoveryRules.ReasonContactFound, ContactDiscoveryRules.ReasonFor(high));

        var medium = Probe(WebsiteProbeStatus.EmailFound, "info@franchise-corp.example", ContactConfidence.Medium);
        Assert.Equal(ContactDiscoveryRules.DiscoveryReviewRequired, ContactDiscoveryRules.DiscoveryStatusFor(medium, 1));
        Assert.Equal(ContactDiscoveryRules.ReasonReviewRequired, ContactDiscoveryRules.ReasonFor(medium));

        var weak = Probe(WebsiteProbeStatus.EmailFound, "hello@gmail.com", ContactConfidence.Low);
        Assert.Equal(ContactDiscoveryRules.DiscoveryReviewRequired, ContactDiscoveryRules.DiscoveryStatusFor(weak, 1));
    }

    [Fact]
    public void Parked_site_is_no_public_contact_immediately()
    {
        var parked = Probe(WebsiteProbeStatus.ParkingOrDisconnected, detail: "Wix placeholder.");
        Assert.Equal(ContactDiscoveryRules.DiscoveryNoPublicContact, ContactDiscoveryRules.DiscoveryStatusFor(parked, 1));
        Assert.Equal(ContactDiscoveryRules.ReasonWebsiteDead, ContactDiscoveryRules.ReasonFor(parked));
    }

    [Fact]
    public void Live_site_without_email_escalates_to_no_public_contact_after_exhausted_attempts()
    {
        var live = Probe(WebsiteProbeStatus.LiveNoEmail);
        Assert.Equal(ContactDiscoveryRules.DiscoveryContactNeeded, ContactDiscoveryRules.DiscoveryStatusFor(live, 1));
        Assert.Equal(
            ContactDiscoveryRules.DiscoveryNoPublicContact,
            ContactDiscoveryRules.DiscoveryStatusFor(live, ContactDiscoveryRules.ExhaustedAttempts));
        Assert.Equal(ContactDiscoveryRules.ReasonNoPublicEmail, ContactDiscoveryRules.ReasonFor(live));

        var unreachable = Probe(WebsiteProbeStatus.Unreachable);
        Assert.Equal(ContactDiscoveryRules.ReasonWebsiteUnreachable, ContactDiscoveryRules.ReasonFor(unreachable));
    }

    [Fact]
    public void Contact_form_only_is_not_reported_as_no_public_contact()
    {
        var signals = Probe(
            WebsiteProbeStatus.ContactFormFound,
            contactFormUrl: "https://gym.example/contact#form",
            detail: "Contact form only.");

        Assert.Equal(ContactDiscoveryRules.DiscoveryContactFormFound, ContactDiscoveryRules.DiscoveryStatusFor(signals, 4));
        Assert.Equal(ContactDiscoveryRules.ReasonContactFormOnly, ContactDiscoveryRules.ReasonFor(signals));
        Assert.Contains("contact form", ContactDiscoveryRules.MessageFor(signals), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Research_summary_records_pages_checked_and_detail()
    {
        var signals = new ContactProbeSignals
        {
            WebsiteStatus = nameof(WebsiteProbeStatus.LiveNoEmail),
            PagesChecked = new[] { "/", "/contact", "/about" },
            PagesCheckedCount = 3,
            Detail = "No public business email on contact pages.",
        };

        var summary = ContactDiscoveryRules.BuildResearchSummary(signals, new DateTime(2026, 9, 21, 0, 0, 0, DateTimeKind.Utc));
        Assert.Contains("2026-09-21", summary, StringComparison.Ordinal);
        Assert.Contains("3 page(s)", summary, StringComparison.Ordinal);
        Assert.Contains("/contact", summary, StringComparison.Ordinal);
        Assert.Contains("No public business email", summary, StringComparison.Ordinal);
    }

    [Fact]
    public void NextResearchAt_is_cleared_for_terminal_statuses_and_backs_off_otherwise()
    {
        var now = new DateTime(2026, 9, 21, 0, 0, 0, DateTimeKind.Utc);
        Assert.Null(ContactDiscoveryRules.NextResearchAtFor(ContactDiscoveryRules.DiscoveryEmailFound, 1, now));
        Assert.Null(ContactDiscoveryRules.NextResearchAtFor(ContactDiscoveryRules.DiscoveryReviewRequired, 1, now));
        Assert.Null(ContactDiscoveryRules.NextResearchAtFor(ContactDiscoveryRules.DiscoveryContactFormFound, 1, now));
        Assert.Null(ContactDiscoveryRules.NextResearchAtFor(ContactDiscoveryRules.DiscoveryNoPublicContact, 3, now));
        Assert.Equal(now.AddDays(4), ContactDiscoveryRules.NextResearchAtFor(ContactDiscoveryRules.DiscoveryContactNeeded, 2, now));
    }

    [Fact]
    public void Cached_contact_is_reused_only_when_high_fresh_and_on_the_same_domain()
    {
        var now = new DateTime(2026, 9, 21, 0, 0, 0, DateTimeKind.Utc);
        var prospect = new PartnerProspect { ProspectId = "p1", Website = "https://www.gym.example/" };
        var fresh = new PartnerDomainContactCache
        {
            Domain = "gym.example",
            Email = "hello@gym.example",
            Confidence = ContactDiscoveryRules.ConfidenceHigh,
            SourceUrl = "https://gym.example/contact",
            CheckedAt = now.AddDays(-2),
        };

        Assert.True(ContactDiscoveryRules.CanReuseCachedContact(prospect, fresh, now));

        var stale = new PartnerDomainContactCache
        {
            Domain = "gym.example",
            Email = "hello@gym.example",
            Confidence = ContactDiscoveryRules.ConfidenceHigh,
            CheckedAt = now.AddDays(-30),
        };
        Assert.False(ContactDiscoveryRules.CanReuseCachedContact(prospect, stale, now));

        var medium = new PartnerDomainContactCache
        {
            Domain = "gym.example",
            Email = "hello@gym.example",
            Confidence = ContactDiscoveryRules.ConfidenceMedium,
            CheckedAt = now.AddDays(-1),
        };
        Assert.False(ContactDiscoveryRules.CanReuseCachedContact(prospect, medium, now));
        Assert.False(ContactDiscoveryRules.CanReuseCachedContact(prospect, null, now));
    }

    [Fact]
    public void Franchise_corporate_email_is_never_reused_across_organizations()
    {
        var now = new DateTime(2026, 9, 21, 0, 0, 0, DateTimeKind.Utc);
        var prospect = new PartnerProspect { ProspectId = "p2", Website = "https://atlanta-pf.example" };
        var corporate = new PartnerDomainContactCache
        {
            Domain = "atlanta-pf.example",
            Email = "franchise@planetfitness.com",
            Confidence = ContactDiscoveryRules.ConfidenceHigh,
            CheckedAt = now.AddDays(-1),
        };

        Assert.False(ContactDiscoveryRules.CanReuseCachedContact(prospect, corporate, now));

        var otherHost = new PartnerDomainContactCache
        {
            Domain = "someothergym.example",
            Email = "hello@someothergym.example",
            Confidence = ContactDiscoveryRules.ConfidenceHigh,
            CheckedAt = now.AddDays(-1),
        };
        Assert.False(ContactDiscoveryRules.CanReuseCachedContact(prospect, otherHost, now));
    }

    [Fact]
    public void Batch_candidates_need_a_website_and_skip_pending_review()
    {
        var now = DateTime.UtcNow;
        var missingEmail = new PartnerProspect { ProspectId = "a", Website = "https://gym.example" };
        Assert.True(ContactDiscoveryRules.IsBatchCandidate(missingEmail, true, true, now));

        var noWebsite = new PartnerProspect { ProspectId = "b" };
        Assert.False(ContactDiscoveryRules.IsBatchCandidate(noWebsite, true, true, now));

        var hasEmail = new PartnerProspect { ProspectId = "c", Website = "https://gym.example", Email = "hi@gym.example" };
        Assert.False(ContactDiscoveryRules.IsBatchCandidate(hasEmail, true, true, now));
        Assert.True(ContactDiscoveryRules.IsBatchCandidate(hasEmail, false, true, now));

        var awaitingReview = new PartnerProspect
        {
            ProspectId = "d",
            Website = "https://gym.example",
            PendingReviewEmail = "info@corp.example",
            ContactDiscoveryStatus = ContactDiscoveryRules.DiscoveryReviewRequired,
        };
        Assert.False(ContactDiscoveryRules.IsBatchCandidate(awaitingReview, true, true, now));
    }

    [Fact]
    public void Batch_without_force_respects_cooldown_and_attempt_limits()
    {
        var now = DateTime.UtcNow;
        var cooling = new PartnerProspect
        {
            ProspectId = "a",
            Website = "https://gym.example",
            NextResearchAt = now.AddDays(3),
        };
        Assert.False(ContactDiscoveryRules.IsBatchCandidate(cooling, true, force: false, now));
        Assert.True(ContactDiscoveryRules.IsBatchCandidate(cooling, true, force: true, now));

        var exhausted = new PartnerProspect { ProspectId = "b", Website = "https://gym.example", ResearchAttempts = 5 };
        Assert.False(ContactDiscoveryRules.IsBatchCandidate(exhausted, true, force: false, now));
        Assert.True(ContactDiscoveryRules.IsBatchCandidate(exhausted, true, force: true, now));
    }

    [Fact]
    public void Existing_email_keeps_a_found_status_so_discovery_never_downgrades_it()
    {
        var verified = new PartnerProspect { ProspectId = "a", Email = "hi@gym.example", EmailSource = "public_listing" };
        Assert.True(ContactDiscoveryRules.HasUsableEmail(verified));
        Assert.Equal(ContactDiscoveryRules.DiscoveryEmailFound, ContactDiscoveryRules.StatusForExistingEmail(verified));

        var manual = new PartnerProspect
        {
            ProspectId = "b",
            Email = "hi@gym.example",
            EmailSource = ManualContactRules.EmailSourceManualAdmin,
        };
        Assert.Equal(ContactDiscoveryRules.DiscoveryManualContact, ContactDiscoveryRules.StatusForExistingEmail(manual));

        Assert.False(ContactDiscoveryRules.HasUsableEmail(new PartnerProspect { ProspectId = "c" }));
    }

    [Theory]
    [InlineData(0, 50)]
    [InlineData(-5, 50)]
    [InlineData(10, 10)]
    [InlineData(500, 200)]
    public void Batch_max_is_clamped(int requested, int expected)
    {
        Assert.Equal(expected, ContactDiscoveryRules.ClampBatchMax(requested));
    }

    [Theory]
    [InlineData("high", "HIGH")]
    [InlineData(" Medium ", "MEDIUM")]
    [InlineData("low", "LOW")]
    [InlineData("bogus", "")]
    [InlineData(null, "")]
    public void Confidence_normalization(string? raw, string expected)
    {
        Assert.Equal(expected, ContactDiscoveryRules.NormalizeConfidence(raw));
    }
}
