namespace GetTrainMate.Api.Services.PartnerOutreach;

/// <summary>
/// Initial market portfolio only. Not an exclusive worldwide list.
/// TRAIN is campaign priority for partner outreach; VIBE and DATE remain app modes.
/// </summary>
public static class MarketCampaignCatalog
{
    public const int MaxActiveMarkets = 3;

    public static readonly string[] ApprovedOutreachLanguages = { "en", "es", "ru" };
    public static readonly string[] PendingOutreachLanguages = Array.Empty<string>();

    public static IReadOnlyList<MarketCampaignSeed> Candidates { get; } = new[]
    {
        Seed("us_atlanta_train_partners", "us", "atlanta", "Atlanta", "America/New_York", new[] { "en" }, "active"),
        Seed("us_miami_train_partners", "us", "miami", "Miami / Fort Lauderdale", "America/New_York", new[] { "en", "es" }, "candidate"),
        Seed("us_new_york_train_partners", "us", "new-york", "New York City", "America/New_York", new[] { "en", "es", "ru" }, "candidate"),
        Seed("gb_london_train_partners", "gb", "london", "London", "Europe/London", new[] { "en" }, "candidate"),
        Seed("ca_toronto_train_partners", "ca", "toronto", "Toronto", "America/Toronto", new[] { "en" }, "candidate"),
    };

    public static bool IsApprovedOutreachLanguage(string? language) =>
        ApprovedOutreachLanguages.Contains((language ?? "").Trim().ToLowerInvariant());

    public static string CampaignId(string country, string market, string mode = "TRAIN") =>
        $"{Slug(country)}_{Slug(market)}_{Slug(mode)}_partners";

    public static string PartnerPath(string country, string market, string? inviteCode = null)
    {
        var path = $"/partners/{Slug(country)}/{Slug(market)}";
        return string.IsNullOrWhiteSpace(inviteCode) ? path : $"{path}/{Slug(inviteCode)}";
    }

    public static string Slug(string? raw)
    {
        var s = (raw ?? "").Trim().ToLowerInvariant();
        var chars = s.Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray();
        var slug = new string(chars).Trim('-');
        while (slug.Contains("--", StringComparison.Ordinal)) slug = slug.Replace("--", "-", StringComparison.Ordinal);
        return slug.Length > 48 ? slug[..48] : slug;
    }

    /// <summary>Website-only Atlanta TRAIN identities. Never includes inferred emails.</summary>
    public static IReadOnlyList<DiscoveredOrgSeed> AtlantaTrainOrgWebsites { get; } = new[]
    {
        new DiscoveredOrgSeed("Atlanta Track Club", "https://www.atlantatrackclub.org/", "run_club", "atl-track-club"),
        new DiscoveredOrgSeed("Fleet Feet Atlanta", "https://www.fleetfeet.com/s/atlanta", "run_club", "atl-fleet-feet"),
        new DiscoveredOrgSeed("F3 Atlanta", "https://f3atlanta.com/", "outdoor_club", "atl-f3"),
        new DiscoveredOrgSeed("Atlanta Pickleball Club", "https://atlantapickleballclub.com/", "pickleball", "atl-pickleball"),
        new DiscoveredOrgSeed("Elite Edge HYROX Atlanta", "https://eliteedgeatl.com/hyrox-training-club-atlanta/", "crossfit_hyrox", "atl-hyrox-crossfit"),
        new DiscoveredOrgSeed("Atlanta Triathlon Club", "https://atlantatriclub.com/", "rec_sports", "atl-tri-club"),
        new DiscoveredOrgSeed("Midtown Trainers", "https://midtowntrainers.com/", "personal_trainer", "atl-midtown-trainers"),
        new DiscoveredOrgSeed("JAM Sports Atlanta", "https://jamsports.com/discover/atlanta", "rec_sports", "atl-softball-rec"),
        new DiscoveredOrgSeed("Atlanta Outdoor Club", "https://www.atlantaoutdoorclub.com/", "hiking", "atl-outdoor-club"),
    };

    static MarketCampaignSeed Seed(
        string id, string country, string market, string display, string tz, string[] langs, string status) =>
        new(id, country, market, display, tz, langs, status, "TRAIN");
}

public sealed record MarketCampaignSeed(
    string CampaignId,
    string Country,
    string Market,
    string DisplayName,
    string Timezone,
    string[] Languages,
    string Status,
    string PrimaryMode);

public sealed record DiscoveredOrgSeed(
    string OrganizationName,
    string Website,
    string OrganizationType,
    string PartnerCode);
