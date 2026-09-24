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
        };

    public static bool TryGet(string market, out (double South, double West, double North, double East) box) =>
        ByMarket.TryGetValue(MarketCampaignCatalog.Slug(market), out box);
}
