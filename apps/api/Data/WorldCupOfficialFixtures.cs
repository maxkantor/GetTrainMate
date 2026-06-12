namespace GetTrainMate.Api.Data;

/// <summary>
/// Single authoritative World Cup 2026 fixture catalog.
/// Admin CRM and public hub read/write through EventHubService — never hardcode matches in the UI.
/// </summary>
public static class WorldCupOfficialFixtures
{
    public const string EventId = "world-cup-2026";

    public static readonly IReadOnlyList<OfficialTeam> Teams =
    [
        new("mexico", "Mexico", "Mexico", "🇲🇽", 0),
        new("south-africa", "South Africa", "South Africa", "🇿🇦", 1),
        new("south-korea", "South Korea", "South Korea", "🇰🇷", 2),
        new("czechia", "Czechia", "Czechia", "🇨🇿", 3),
    ];

    /// <summary>Verified opening fixtures — no invented dates, venues, or groups.</summary>
    public static readonly IReadOnlyList<OfficialMatch> OpeningMatches =
    [
        new("opening-mexico-vs-south-africa", "mexico", "south-africa", "Opening Match", 0),
        new("opening-south-korea-vs-czechia", "south-korea", "czechia", "Opening Match", 1),
    ];

    public static HashSet<string> OfficialTeamIds => Teams.Select(t => t.TeamId).ToHashSet(StringComparer.OrdinalIgnoreCase);

    public static HashSet<string> OfficialMatchIds => OpeningMatches.Select(m => m.MatchId).ToHashSet(StringComparer.OrdinalIgnoreCase);
}

public sealed record OfficialTeam(string TeamId, string Name, string Country, string FlagEmoji, int SortOrder);

public sealed record OfficialMatch(string MatchId, string TeamAId, string TeamBId, string Stage, int SortOrder);
