using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services.PartnerOutreach;
using Xunit;

namespace GetTrainMate.Api.Tests;

public class ManualContactRulesTests
{
    [Theory]
    [InlineData("Manager@Gym.Example", "manager@gym.example")]
    [InlineData("  a@b.co  ", "a@b.co")]
    public void NormalizeEmail_lowercases_and_trims(string raw, string expected)
    {
        Assert.Equal(expected, ManualContactRules.NormalizeEmail(raw));
    }

    [Theory]
    [InlineData("not-an-email")]
    [InlineData("")]
    [InlineData("missing@domain")]
    [InlineData("@nodomain.com")]
    public void Invalid_email_syntax_rejected(string raw)
    {
        Assert.False(ManualContactRules.IsValidEmailSyntax(raw));
    }

    [Fact]
    public void Valid_email_syntax_accepted()
    {
        Assert.True(ManualContactRules.IsValidEmailSyntax("manager@planetfitness.example"));
    }

    [Fact]
    public void ApplyManualContact_sets_manual_source_and_clears_contact_needed()
    {
        var p = new PartnerProspect
        {
            ProspectId = "p1",
            OrganizationName = "Planet Fitness",
            Status = "no_verified_public_email",
            ContactabilityState = PartnerCrmLifecycle.RetryLater,
            ContactState = PartnerCrmLifecycle.ContactNeeded,
            AcquisitionStatus = PartnerCrmLifecycle.AcqContactNeeded,
            CrmLifecycle = PartnerCrmLifecycle.New,
            EmailVerificationStatus = "no_verified_public_email",
        };

        ManualContactRules.ApplyManualContact(
            p,
            "manager@pf.example",
            "Alex Manager",
            "GM",
            "555-0100",
            "https://pf.example/contact",
            "Found on site footer",
            "admin@gettrainmate.com",
            new DateTime(2026, 9, 21, 15, 0, 0, DateTimeKind.Utc));

        Assert.Equal("manager@pf.example", p.Email);
        Assert.Equal(ManualContactRules.EmailSourceManualAdmin, p.EmailSource);
        Assert.Equal(ManualContactRules.ContactSourceTypeManualAdmin, p.ContactSourceType);
        Assert.Equal(ManualContactRules.VerificationManualUnverified, p.EmailVerificationStatus);
        Assert.Null(p.EmailVerifiedOn);
        Assert.Equal("Alex Manager", p.ContactName);
        Assert.Equal("GM", p.ContactRole);
        Assert.Equal("555-0100", p.Phone);
        Assert.Equal("https://pf.example/contact", p.ContactSourceUrl);
        Assert.Equal(PartnerCrmLifecycle.ContactFound, p.ContactabilityState);
        Assert.Equal(PartnerCrmLifecycle.ContactFound, p.ContactState);
        Assert.NotEqual(PartnerCrmLifecycle.AcqContactNeeded, p.AcquisitionStatus);
        Assert.Equal(PartnerCrmLifecycle.AcqContactable, p.AcquisitionStatus);
        Assert.Equal(PartnerCrmLifecycle.Qualified, p.CrmLifecycle);
        Assert.Equal("prospect", p.Status);
        Assert.Null(p.NextResearchAt);
        Assert.Contains("Manual contact", p.Notes ?? "", StringComparison.OrdinalIgnoreCase);
        Assert.Contains("manual_contact_added", p.TimelineJson ?? "", StringComparison.OrdinalIgnoreCase);
        Assert.Equal(ContactDiscoveryRules.DiscoveryManualContact, p.ContactDiscoveryStatus);
        Assert.Equal(ContactDiscoveryRules.ConfidenceHigh, p.ContactConfidence);
    }

    [Fact]
    public void ApplyManualContact_clears_a_candidate_awaiting_review()
    {
        var p = new PartnerProspect
        {
            ProspectId = "p1",
            OrganizationName = "Gym",
            ContactDiscoveryStatus = ContactDiscoveryRules.DiscoveryReviewRequired,
            PendingReviewEmail = "info@franchise-corp.example",
            PendingReviewSourceUrl = "https://gym.example/contact",
            PendingReviewConfidence = ContactDiscoveryRules.ConfidenceMedium,
        };

        ManualContactRules.ApplyManualContact(
            p,
            "manager@gym.example",
            null,
            null,
            null,
            null,
            null,
            "admin@gettrainmate.com",
            DateTime.UtcNow);

        Assert.Equal("manager@gym.example", p.Email);
        Assert.Equal(ContactDiscoveryRules.DiscoveryManualContact, p.ContactDiscoveryStatus);
        Assert.Null(p.PendingReviewEmail);
        Assert.Null(p.PendingReviewSourceUrl);
        Assert.Null(p.PendingReviewConfidence);
    }

    [Fact]
    public void ApplyManualContact_replace_audits_previous_email_in_timeline()
    {
        var p = new PartnerProspect
        {
            ProspectId = "p1",
            OrganizationName = "Gym",
            Email = "old@gym.example",
            ContactabilityState = PartnerCrmLifecycle.ContactFound,
            AcquisitionStatus = PartnerCrmLifecycle.AcqContactable,
        };

        ManualContactRules.ApplyManualContact(
            p,
            "new@gym.example",
            null,
            null,
            null,
            null,
            null,
            "admin@gettrainmate.com",
            DateTime.UtcNow);

        Assert.Equal("new@gym.example", p.Email);
        Assert.Contains("manual_contact_replaced", p.TimelineJson ?? "", StringComparison.OrdinalIgnoreCase);
        Assert.Contains("old@gym.example", p.TimelineJson ?? "", StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ComputeNextAction_after_manual_email_is_create_outreach_not_research()
    {
        var p = new PartnerProspect
        {
            ProspectId = "p1",
            OrganizationName = "Planet Fitness",
            Email = "manager@pf.example",
            EmailSource = ManualContactRules.EmailSourceManualAdmin,
            ContactSourceType = ManualContactRules.ContactSourceTypeManualAdmin,
            EmailVerificationStatus = ManualContactRules.VerificationManualUnverified,
            ContactabilityState = PartnerCrmLifecycle.ContactFound,
            ContactState = PartnerCrmLifecycle.ContactFound,
            AcquisitionStatus = PartnerCrmLifecycle.AcqContactable,
            AcquisitionScore = 60,
            CrmLifecycle = PartnerCrmLifecycle.Qualified,
            CustomerStatus = PartnerCrmLifecycle.CustNotCustomer,
        };

        dynamic next = PartnerCrmLifecycle.ComputeNextAction(p, null);
        Assert.Equal(PartnerCrmLifecycle.ActionCreateOutreach, (string)next.key);
    }
}
