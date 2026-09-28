namespace GetTrainMate.Api.Services.PartnerOutreach;

/// <summary>Approximate metro bounding boxes for automated OSM discovery (south, west, north, east).</summary>
public static class MarketBounds
{
    public static readonly IReadOnlyDictionary<string, (double South, double West, double North, double East)> ByMarket =
        new Dictionary<string, (double, double, double, double)>(StringComparer.OrdinalIgnoreCase)
        {
            ["atlanta"] = (33.40, -84.80, 34.15, -84.00),
            ["miami"] = (25.50, -80.50, 26.50, -80.00),
            ["tampa"] = (27.70, -82.80, 28.20, -82.20),
            ["new-york"] = (40.50, -74.30, 40.92, -73.70),
            ["dallas"] = (32.60, -97.10, 33.05, -96.55),
            ["chicago"] = (41.70, -87.90, 42.05, -87.50),
            ["london"] = (51.30, -0.50, 51.70, 0.30),
            ["toronto"] = (43.50, -79.70, 43.90, -79.10),
            ["austin"] = (30.10, -97.95, 30.55, -97.55),
            ["denver"] = (39.55, -105.15, 39.95, -104.75),
            ["seattle"] = (47.45, -122.45, 47.75, -122.15),
            ["boston"] = (42.25, -71.25, 42.45, -70.90),
            ["los-angeles"] = (33.70, -118.55, 34.25, -118.05),
            ["san-francisco"] = (37.65, -122.55, 37.90, -122.30),
            ["phoenix"] = (33.30, -112.20, 33.70, -111.85),
            ["houston"] = (29.60, -95.70, 30.00, -95.15),
            ["vancouver"] = (49.15, -123.30, 49.40, -122.90),
            ["sydney"] = (-34.05, 150.90, -33.70, 151.35),
            ["melbourne"] = (-37.95, 144.80, -37.70, 145.10),
            ["berlin"] = (52.40, 13.20, 52.60, 13.55),
            ["amsterdam"] = (52.30, 4.75, 52.45, 5.00),
            ["barcelona"] = (41.30, 2.05, 41.50, 2.25),
            ["paris"] = (48.80, 2.20, 48.95, 2.45),
            ["mexico-city"] = (19.25, -99.30, 19.55, -99.00),
            ["dubai"] = (25.05, 55.10, 25.30, 55.40),
            ["singapore"] = (1.22, 103.70, 1.45, 104.05),
        };

    public static readonly IReadOnlyDictionary<string, string> CountryByMarket =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["atlanta"] = "us",
            ["miami"] = "us",
            ["tampa"] = "us",
            ["new-york"] = "us",
            ["dallas"] = "us",
            ["chicago"] = "us",
            ["austin"] = "us",
            ["denver"] = "us",
            ["seattle"] = "us",
            ["boston"] = "us",
            ["los-angeles"] = "us",
            ["san-francisco"] = "us",
            ["phoenix"] = "us",
            ["houston"] = "us",
            ["london"] = "gb",
            ["toronto"] = "ca",
            ["vancouver"] = "ca",
            ["sydney"] = "au",
            ["melbourne"] = "au",
            ["berlin"] = "de",
            ["amsterdam"] = "nl",
            ["barcelona"] = "es",
            ["paris"] = "fr",
            ["mexico-city"] = "mx",
            ["dubai"] = "ae",
            ["singapore"] = "sg",
        };

    public static bool TryGet(string market, out (double South, double West, double North, double East) box) =>
        ByMarket.TryGetValue(MarketCampaignCatalog.Slug(market), out box);

    public static string CountryFor(string market) =>
        CountryByMarket.TryGetValue(MarketCampaignCatalog.Slug(market), out var c) ? c : "us";
}
