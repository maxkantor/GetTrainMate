namespace GetTrainMate.Api.Services.PartnerOutreach;

/// <summary>
/// Initial market portfolio only. Not an exclusive worldwide list.
/// TRAIN is campaign priority for partner outreach; VIBE and DATE remain app modes.
/// </summary>
public static class MarketCampaignCatalog
{
    /// <summary>Soft ceiling for ranking / discovery target selection (not a hard activate block).</summary>
    public const int MaxActiveMarkets = 50;

    public static readonly string[] ApprovedOutreachLanguages = { "en", "es", "ru" };
    public static readonly string[] PendingOutreachLanguages = Array.Empty<string>();

    public static IReadOnlyList<MarketCampaignSeed> Candidates { get; } = new[]
    {
        Seed("PARTNER-001", "us", "multi", "GetTrainMate Partner Acquisition", "America/New_York", new[] { "en", "es", "ru" }, "active", "CROSS_MODE"),
        Seed("us_atlanta_train_partners", "us", "atlanta", "Atlanta Fitness & Sports Communities", "America/New_York", new[] { "en" }, "active", "CROSS_MODE"),
        Seed("us_miami_train_partners", "us", "miami", "Miami Active Lifestyle", "America/New_York", new[] { "en", "es" }, "candidate", "VIBE"),
        Seed("us_tampa_train_partners", "us", "tampa", "Tampa Bay Fitness & Sports", "America/New_York", new[] { "en" }, "candidate", "CROSS_MODE"),
        Seed("us_new_york_train_partners", "us", "new-york", "NYC Social Sports", "America/New_York", new[] { "en", "es", "ru" }, "candidate", "CROSS_MODE"),
        Seed("us_dallas_train_partners", "us", "dallas", "Dallas Fitness Communities", "America/Chicago", new[] { "en" }, "candidate", "TRAIN"),
        Seed("us_chicago_train_partners", "us", "chicago", "Chicago Active Lifestyle", "America/Chicago", new[] { "en" }, "candidate", "CROSS_MODE"),
        Seed("us_austin_train_partners", "us", "austin", "Austin Fitness & Social", "America/Chicago", new[] { "en" }, "candidate", "CROSS_MODE"),
        Seed("us_denver_train_partners", "us", "denver", "Denver Outdoor & Fitness", "America/Denver", new[] { "en" }, "candidate", "TRAIN"),
        Seed("us_seattle_train_partners", "us", "seattle", "Seattle Active Communities", "America/Los_Angeles", new[] { "en" }, "candidate", "CROSS_MODE"),
        Seed("us_boston_train_partners", "us", "boston", "Boston Sports Communities", "America/New_York", new[] { "en" }, "candidate", "TRAIN"),
        Seed("us_los_angeles_train_partners", "us", "los-angeles", "Los Angeles Fitness & Social", "America/Los_Angeles", new[] { "en", "es" }, "candidate", "VIBE"),
        Seed("us_san_francisco_train_partners", "us", "san-francisco", "Bay Area Active Lifestyle", "America/Los_Angeles", new[] { "en" }, "candidate", "CROSS_MODE"),
        Seed("us_phoenix_train_partners", "us", "phoenix", "Phoenix Fitness Communities", "America/Phoenix", new[] { "en", "es" }, "candidate", "TRAIN"),
        Seed("us_houston_train_partners", "us", "houston", "Houston Sports & Fitness", "America/Chicago", new[] { "en", "es" }, "candidate", "CROSS_MODE"),
        Seed("gb_london_train_partners", "gb", "london", "London Training Communities", "Europe/London", new[] { "en" }, "candidate", "TRAIN"),
        Seed("ca_toronto_train_partners", "ca", "toronto", "Toronto Active Lifestyle", "America/Toronto", new[] { "en" }, "candidate", "CROSS_MODE"),
        Seed("ca_vancouver_train_partners", "ca", "vancouver", "Vancouver Outdoor & Fitness", "America/Vancouver", new[] { "en" }, "candidate", "TRAIN"),
        Seed("au_sydney_train_partners", "au", "sydney", "Sydney Fitness Communities", "Australia/Sydney", new[] { "en" }, "candidate", "CROSS_MODE"),
        Seed("au_melbourne_train_partners", "au", "melbourne", "Melbourne Active Lifestyle", "Australia/Melbourne", new[] { "en" }, "candidate", "VIBE"),
        Seed("de_berlin_train_partners", "de", "berlin", "Berlin Fitness Communities", "Europe/Berlin", new[] { "en" }, "candidate", "CROSS_MODE"),
        Seed("nl_amsterdam_train_partners", "nl", "amsterdam", "Amsterdam Active Lifestyle", "Europe/Amsterdam", new[] { "en" }, "candidate", "VIBE"),
        Seed("es_barcelona_train_partners", "es", "barcelona", "Barcelona Sports & Social", "Europe/Madrid", new[] { "en", "es" }, "candidate", "DATE"),
        Seed("fr_paris_train_partners", "fr", "paris", "Paris Fitness & Social", "Europe/Paris", new[] { "en" }, "candidate", "VIBE"),
        Seed("mx_mexico_city_train_partners", "mx", "mexico-city", "Mexico City Active Lifestyle", "America/Mexico_City", new[] { "en", "es" }, "candidate", "CROSS_MODE"),
        Seed("ae_dubai_train_partners", "ae", "dubai", "Dubai Fitness Communities", "Asia/Dubai", new[] { "en" }, "candidate", "TRAIN"),
        Seed("sg_singapore_train_partners", "sg", "singapore", "Singapore Active Lifestyle", "Asia/Singapore", new[] { "en" }, "candidate", "CROSS_MODE"),
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

    public static IReadOnlyList<DiscoveredOrgSeed> SeedCatalogForCampaign(string? campaignId)
    {
        if (string.IsNullOrWhiteSpace(campaignId)
            || string.Equals(campaignId.Trim(), "us_atlanta_train_partners", StringComparison.OrdinalIgnoreCase))
            return AtlantaTrainOrgWebsites;
        return Array.Empty<DiscoveredOrgSeed>();
    }

    static MarketCampaignSeed Seed(
        string id, string country, string market, string display, string tz, string[] langs, string status, string primaryMode) =>
        new(id, country, market, display, tz, langs, status, primaryMode);
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
