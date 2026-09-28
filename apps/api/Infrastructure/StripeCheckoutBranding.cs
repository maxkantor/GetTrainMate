using Stripe.Checkout;

namespace GetTrainMate.Api.Infrastructure;

/// <summary>
/// Per-Checkout-Session branding for GetTrainMate on the shared MK AI Stripe account.
/// Session-scoped only — never mutates Stripe Account / Dashboard branding.
/// Appearance matches LuckyNumbersLab: display_name + icon only (no background/button overrides),
/// so Checkout keeps the shared account's light pale gray/green left panel + white payment form.
/// </summary>
public static class StripeCheckoutBranding
{
    public const string DisplayName = "GetTrainMate";

    /// <summary>Public HTTPS path for the small Checkout identity icon (not ProductData.Images).</summary>
    public const string IconPath = "/brand/gettrainmate-stripe-icon.jpg";

    /// <summary>
    /// Absolute URL for <c>branding_settings.icon</c> (type=url). Falls back to production CDN host.
    /// </summary>
    public static string ResolveIconUrl(string? frontendBaseUrl)
    {
        var baseUrl = string.IsNullOrWhiteSpace(frontendBaseUrl)
            ? "https://gettrainmate.com"
            : frontendBaseUrl.Trim().TrimEnd('/');
        return $"{baseUrl}{IconPath}";
    }

    /// <summary>Checkout line-item name: GetTrainMate + package + credits.</summary>
    public static string CreditPackProductName(string packTitle, int credits) =>
        $"GetTrainMate — {packTitle} ({credits} Credits)";

    /// <summary>Short description of what credits unlock (TRAIN / VIBE / DATE — not fitness-only).</summary>
    public static string CreditPackProductDescription(int credits) =>
        $"Add {credits} credits for chats, boosts, and AI across GetTrainMate TRAIN, VIBE, and DATE.";

    /// <summary>
    /// Same shape as LuckyNumbersLab <c>BuildStripeCheckoutBranding</c>: DisplayName + Icon only.
    /// Do not set BackgroundColor/ButtonColor — that forced GetTrainMate's black left panel.
    /// </summary>
    public static SessionBrandingSettingsOptions CreateBrandingSettings(string? frontendBaseUrl)
    {
        return new SessionBrandingSettingsOptions
        {
            DisplayName = DisplayName,
            Icon = new SessionBrandingSettingsIconOptions
            {
                Type = "url",
                Url = ResolveIconUrl(frontendBaseUrl),
            },
        };
    }
}