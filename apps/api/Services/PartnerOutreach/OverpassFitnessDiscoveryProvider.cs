using System.Text.Json;

namespace GetTrainMate.Api.Services.PartnerOutreach;

/// <summary>Discovers gyms, clubs, and fitness organizations from OpenStreetMap (no API key; public data).</summary>
public sealed class OverpassFitnessDiscoveryProvider
{
    readonly HttpClient _http;
    readonly ILogger<OverpassFitnessDiscoveryProvider> _log;

    public OverpassFitnessDiscoveryProvider(HttpClient http, ILogger<OverpassFitnessDiscoveryProvider> log)
    {
        _http = http;
        _log = log;
    }

    public async Task<IReadOnlyList<DiscoveredOrganization>> DiscoverAsync(
        MarketCampaignSeed campaign,
        int maxResults = 40,
        CancellationToken ct = default)
    {
        if (!MarketBounds.TryGet(campaign.Market, out var box))
            return Array.Empty<DiscoveredOrganization>();

        var (south, west, north, east) = box;
        var query = $"""
            [out:json][timeout:25];
            (
              nwr["amenity"="gym"]({south},{west},{north},{east});
              nwr["leisure"="fitness_centre"]({south},{west},{north},{east});
              nwr["leisure"="sports_centre"]({south},{west},{north},{east});
              nwr["leisure"="pitch"]({south},{west},{north},{east});
              nwr["amenity"="community_centre"]({south},{west},{north},{east});
              nwr["tourism"="attraction"]["sport"~"."]({south},{west},{north},{east});
              nwr["sport"~"running|tennis|pickleball|cycling|crossfit|fitness|multi|soccer|volleyball|swimming"]({south},{west},{north},{east});
              nwr["club"="sport"]({south},{west},{north},{east});
            );
            out center {Math.Min(maxResults * 4, 250)};
            """;

        try
        {
            using var content = new FormUrlEncodedContent(new Dictionary<string, string> { ["data"] = query });
            using var res = await _http.PostAsync("https://overpass-api.de/api/interpreter", content, ct);
            if (!res.IsSuccessStatusCode)
            {
                _log.LogWarning("Overpass HTTP {Status} for {Market}", (int)res.StatusCode, campaign.Market);
                return Array.Empty<DiscoveredOrganization>();
            }
            await using var stream = await res.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            if (!doc.RootElement.TryGetProperty("elements", out var elements))
                return Array.Empty<DiscoveredOrganization>();

            var clubs = new List<DiscoveredOrganization>();
            var gyms = new List<DiscoveredOrganization>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var el in elements.EnumerateArray())
            {
                if (clubs.Count + gyms.Count >= maxResults * 2) break;
                var tags = el.TryGetProperty("tags", out var t) ? t : default;
                if (tags.ValueKind != JsonValueKind.Object) continue;
                var name = GetTag(tags, "name");
                if (string.IsNullOrWhiteSpace(name)) continue;
                var website = FirstNonEmpty(
                    GetTag(tags, "website"),
                    GetTag(tags, "contact:website"),
                    GetTag(tags, "url"));
                if (string.IsNullOrWhiteSpace(website)) continue;
                if (!TryNormalizeWebsite(website, out var siteUri)) continue;

                var orgType = ClassifyOrgType(tags);
                var key = siteUri.Host + "|" + name.Trim();
                if (!seen.Add(key)) continue;

                var org = new DiscoveredOrganization
                {
                    OrganizationName = name.Trim(),
                    OrganizationType = orgType,
                    Website = siteUri.ToString(),
                    Country = campaign.Country,
                    Market = campaign.Market,
                    CampaignId = campaign.CampaignId,
                    DisplayName = campaign.DisplayName,
                    Timezone = campaign.Timezone,
                    PrimaryLanguage = InferLanguage(campaign),
                    DiscoverySource = "overpass_osm",
                };
                if (IsGymType(orgType)) gyms.Add(org);
                else clubs.Add(org);
            }

            // Prefer non-gym: interleave clubs before gyms when filling maxResults
            return InterleavePreferClubs(clubs, gyms, maxResults);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Overpass discovery failed for {Market}", campaign.Market);
            return Array.Empty<DiscoveredOrganization>();
        }
    }

    static List<DiscoveredOrganization> InterleavePreferClubs(
        List<DiscoveredOrganization> clubs,
        List<DiscoveredOrganization> gyms,
        int maxResults)
    {
        var results = new List<DiscoveredOrganization>(maxResults);
        var ci = 0;
        var gi = 0;
        // Take two clubs for every one gym until full
        while (results.Count < maxResults && (ci < clubs.Count || gi < gyms.Count))
        {
            for (var n = 0; n < 2 && results.Count < maxResults && ci < clubs.Count; n++)
                results.Add(clubs[ci++]);
            if (results.Count < maxResults && gi < gyms.Count)
                results.Add(gyms[gi++]);
        }
        return results;
    }

    static bool IsGymType(string orgType) =>
        string.Equals(orgType, "gym", StringComparison.OrdinalIgnoreCase);

    static string InferLanguage(MarketCampaignSeed campaign) =>
        campaign.Languages?.FirstOrDefault() ?? "en";

    static string ClassifyOrgType(JsonElement tags)
    {
        var sport = GetTag(tags, "sport")?.ToLowerInvariant() ?? "";
        var leisure = GetTag(tags, "leisure")?.ToLowerInvariant() ?? "";
        var amenity = GetTag(tags, "amenity")?.ToLowerInvariant() ?? "";
        var tourism = GetTag(tags, "tourism")?.ToLowerInvariant() ?? "";
        if (sport.Contains("running")) return "run_club";
        if (sport.Contains("pickleball")) return "pickleball";
        if (sport.Contains("tennis")) return "tennis";
        if (sport.Contains("cycling")) return "cycling";
        if (sport.Contains("crossfit")) return "crossfit_hyrox";
        if (sport.Contains("soccer") || sport.Contains("football")) return "soccer";
        if (sport.Contains("volleyball")) return "volleyball";
        if (sport.Contains("swimming")) return "swimming";
        if (amenity == "community_centre") return "community";
        if (tourism == "attraction" && !string.IsNullOrWhiteSpace(sport)) return "rec_sports";
        if (leisure == "pitch") return "rec_sports";
        if (leisure == "sports_centre" || GetTag(tags, "club") == "sport") return "rec_sports";
        if (amenity == "gym" || leisure == "fitness_centre") return "gym";
        return "rec_sports";
    }

    static string? GetTag(JsonElement tags, string key)
    {
        if (tags.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String)
            return v.GetString()?.Trim();
        return null;
    }

    static string? FirstNonEmpty(params string?[] xs)
    {
        foreach (var x in xs)
            if (!string.IsNullOrWhiteSpace(x)) return x;
        return null;
    }

    static bool TryNormalizeWebsite(string raw, out Uri uri)
    {
        uri = null!;
        var s = raw.Trim();
        if (!s.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            s = "https://" + s;
        if (!Uri.TryCreate(s, UriKind.Absolute, out var u)) return false;
        if (u.Scheme != Uri.UriSchemeHttp && u.Scheme != Uri.UriSchemeHttps) return false;
        uri = u;
        return true;
    }
}

public sealed class DiscoveredOrganization
{
    public string OrganizationName { get; set; } = "";
    public string OrganizationType { get; set; } = "gym";
    public string Website { get; set; } = "";
    public string Country { get; set; } = "";
    public string Market { get; set; } = "";
    public string CampaignId { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string Timezone { get; set; } = "";
    public string PrimaryLanguage { get; set; } = "en";
    public string DiscoverySource { get; set; } = "";
    public string? PartnerCode { get; set; }
}
