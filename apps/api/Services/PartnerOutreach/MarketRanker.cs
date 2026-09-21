using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services.PartnerOutreach;

/// <summary>Ranks candidate markets from verified CRM evidence. Never guesses missing metrics.</summary>
public static class MarketRanker
{
    public sealed class MarketEvidenceRow
    {
        public string CampaignId { get; set; } = "";
        public string Country { get; set; } = "";
        public string Market { get; set; } = "";
        public string DisplayName { get; set; } = "";
        public int RegisteredUsers { get; set; }
        public int CompletedProfiles { get; set; }
        public int DiscoverUsers { get; set; }
        public int Connections { get; set; }
        public int Matches { get; set; }
        public int FirstMessages { get; set; }
        public int LandingSessions { get; set; }
        public int QualifiedOrganizations { get; set; }
        public bool LanguageSupported { get; set; } = true;
        public bool FounderAdvantage { get; set; }
    }

    public static int Score(MarketEvidenceRow r) =>
        r.CompletedProfiles * 8 +
        r.DiscoverUsers * 6 +
        r.Connections * 5 +
        r.Matches * 50 +
        r.FirstMessages * 20 +
        r.LandingSessions +
        r.RegisteredUsers +
        r.QualifiedOrganizations * 3 +
        (r.LanguageSupported ? 2 : 0) +
        (r.FounderAdvantage ? 5 : 0);

    public static List<MarketEvidenceRow> Rank(IEnumerable<MarketEvidenceRow> rows) =>
        rows.OrderByDescending(Score).ThenBy(r => r.DisplayName, StringComparer.OrdinalIgnoreCase).ToList();

    /// <summary>
    /// Select discovery targets: all active campaigns first, then ranked candidates
    /// up to <paramref name="maxTargets"/> (soft ranking ceiling, not an activate block).
    /// </summary>
    public static IEnumerable<MarketCampaignSeed> SelectDiscoveryTargets(
        IReadOnlyList<MarketCampaignSeed> catalog,
        IReadOnlyList<PartnerCampaign> stored,
        IReadOnlyList<MarketEvidenceRow> evidence,
        int maxTargets = 50)
    {
        if (maxTargets <= 0) maxTargets = 50;
        var ranked = Rank(evidence);
        var rankById = ranked.Select((r, i) => (r.CampaignId, i)).ToDictionary(x => x.CampaignId, x => x.i, StringComparer.OrdinalIgnoreCase);
        var statusById = stored.ToDictionary(c => c.CampaignId, c => c.Status, StringComparer.OrdinalIgnoreCase);

        var active = catalog
            .Where(c => statusById.TryGetValue(c.CampaignId, out var st) && st == "active")
            .OrderBy(c => rankById.GetValueOrDefault(c.CampaignId, 999))
            .ToList();

        // Prefer every active market; fill remaining slots with ranked candidates
        if (active.Count >= maxTargets)
            return active.Take(maxTargets);

        var need = maxTargets - active.Count;
        var candidates = catalog
            .Where(c => !active.Any(a => a.CampaignId == c.CampaignId))
            .Where(c => !statusById.TryGetValue(c.CampaignId, out var st) || st is "candidate" or "paused" or "draft")
            .OrderBy(c => rankById.GetValueOrDefault(c.CampaignId, 999))
            .Take(need);
        return active.Concat(candidates);
    }
}
