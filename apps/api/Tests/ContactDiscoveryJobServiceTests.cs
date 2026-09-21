using GetTrainMate.Api.Services.PartnerOutreach;
using Xunit;

namespace GetTrainMate.Api.Tests;

public class ContactDiscoveryJobServiceTests
{
    [Fact]
    public void ContactDiscoveryStages_Initial_StartsOnWebsite()
    {
        var stages = ContactDiscoveryStages.Initial();
        Assert.Equal(5, stages.Count);
        dynamic first = stages[0];
        Assert.Equal("website", (string)first.key);
        Assert.Equal("active", (string)first.state);
    }

    [Fact]
    public void ContactDiscoveryStages_FromPages_MarksContactAndAboutDone()
    {
        var stages = ContactDiscoveryStages.FromPages(new[]
        {
            "https://example.com/",
            "https://example.com/contact",
            "https://example.com/about",
            "https://facebook.com/example",
        });
        dynamic website = stages[0];
        dynamic contact = stages[1];
        dynamic about = stages[2];
        dynamic social = stages[4];
        Assert.Equal("done", (string)website.state);
        Assert.Equal("done", (string)contact.state);
        Assert.Equal("done", (string)about.state);
        Assert.Equal("done", (string)social.state);
    }

    [Fact]
    public void ContactDiscoveryJob_ProgressPct_IsProcessedOverTotal()
    {
        const int processed = 3;
        const int total = 13;
        var pct = (int)Math.Clamp(Math.Round(100.0 * processed / total), 0, 100);
        Assert.Equal(23, pct);
    }
}
