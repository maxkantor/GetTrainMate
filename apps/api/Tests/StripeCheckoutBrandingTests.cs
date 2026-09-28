using GetTrainMate.Api.Infrastructure;
using Xunit;

namespace GetTrainMate.Api.Tests;

public class StripeCheckoutBrandingTests
{
    [Fact]
    public void ResolveIconUrl_UsesFrontendBase_AndStablePath()
    {
        Assert.Equal(
            "https://gettrainmate.com/brand/gettrainmate-stripe-icon.jpg",
            StripeCheckoutBranding.ResolveIconUrl("https://gettrainmate.com/"));
    }

    [Fact]
    public void CreateBrandingSettings_MatchesLuckyNumbersLabShape_DisplayNameAndIconOnly()
    {
        var branding = StripeCheckoutBranding.CreateBrandingSettings("https://gettrainmate.com");
        Assert.Equal("GetTrainMate", branding.DisplayName);
        // Same as LuckyNumbersLab: omit colors so shared-account light Checkout theme applies.
        Assert.Null(branding.BackgroundColor);
        Assert.Null(branding.ButtonColor);
        Assert.NotNull(branding.Icon);
        Assert.Equal("url", branding.Icon!.Type);
        Assert.Equal(
            "https://gettrainmate.com/brand/gettrainmate-stripe-icon.jpg",
            branding.Icon.Url);
        Assert.Null(branding.Logo);
    }

    [Fact]
    public void CreditPackCopy_IncludesGetTrainMate_AndCredits_NotFitnessOnly()
    {
        var name = StripeCheckoutBranding.CreditPackProductName("Best Value", 30);
        var desc = StripeCheckoutBranding.CreditPackProductDescription(30);
        Assert.Equal("GetTrainMate — Best Value (30 Credits)", name);
        Assert.Contains("TRAIN", desc);
        Assert.Contains("VIBE", desc);
        Assert.Contains("DATE", desc);
        Assert.DoesNotContain("fitness", desc, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("workout credits", desc, StringComparison.OrdinalIgnoreCase);
    }
}
