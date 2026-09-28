using GetTrainMate.Api.Services.PartnerOutreach;
using Xunit;

namespace GetTrainMate.Api.Tests;

public class DiscoveryInventoryTests
{
    [Fact]
    public void ExpandDiscoverableMarkets_skips_multi_and_covers_all_bounds()
    {
        var expanded = AutomatedMarketDiscoveryService.ExpandDiscoverableMarkets(
            MarketCampaignCatalog.Candidates);

        Assert.DoesNotContain(expanded, m =>
            string.Equals(m.Market, "multi", StringComparison.OrdinalIgnoreCase));
        Assert.True(expanded.Count >= MarketBounds.ByMarket.Count);
        foreach (var market in MarketBounds.ByMarket.Keys)
            Assert.Contains(expanded, m => string.Equals(m.Market, market, StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void First_miss_status_stays_contact_needed_not_no_public()
    {
        var signals = new ContactProbeSignals
        {
            WebsiteStatus = nameof(WebsiteProbeStatus.LiveNoEmail),
            Detail = "No public business email",
        };
        Assert.Equal(
            ContactDiscoveryRules.DiscoveryContactNeeded,
            ContactDiscoveryRules.DiscoveryStatusFor(signals, researchAttempts: 1));
        Assert.Equal(
            ContactDiscoveryRules.DiscoveryNoPublicContact,
            ContactDiscoveryRules.DiscoveryStatusFor(signals, researchAttempts: ContactDiscoveryRules.ExhaustedAttempts));
    }

    [Fact]
    public void ScoreProspect_still_scores_without_email()
    {
        var scored = AutomatedMarketDiscoveryService.ScoreProspect(
            new DiscoveredOrganization
            {
                OrganizationName = "Atlanta Pickleball Club",
                OrganizationType = "pickleball",
                DiscoverySource = "overpass_osm",
                Market = "atlanta",
            },
            hasEmail: false);
        Assert.True(scored.AcquisitionScore >= PartnerOutreachRules.DefaultMinAcquisitionScore);
        Assert.Equal(0, scored.ContactQualityScore);
    }
}
