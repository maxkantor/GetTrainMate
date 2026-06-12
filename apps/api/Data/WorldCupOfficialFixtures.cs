namespace GetTrainMate.Api.Data;

/// <summary>
/// Single authoritative World Cup 2026 fixture catalog.
/// Admin CRM and public hub read/write through EventHubService — never hardcode matches in the UI.
/// </summary>
public static class WorldCupOfficialFixtures
{
    public const string EventId = "world-cup-2026";

    /// <summary>Opening-tournament groups for verified teams only — expand via Admin CRM as FIFA publishes groups.</summary>
    public static readonly IReadOnlyList<OfficialGroup> Groups =
    [
        new("group-a", "Group A", 0),
        new("group-b", "Group B", 1),
    ];

    public static readonly IReadOnlyList<OfficialTeam> Teams =
    [
        new("mexico", "Mexico", "Mexico", "🇲🇽", "group-a", 0),
        new("south-africa", "South Africa", "South Africa", "🇿🇦", "group-a", 1),
        new("south-korea", "South Korea", "South Korea", "🇰🇷", "group-b", 0),
        new("czechia", "Czechia", "Czechia", "🇨🇿", "group-b", 1),
    ];

    /// <summary>Verified opening fixtures — no invented dates, venues, or groups.</summary>
    public static readonly IReadOnlyList<OfficialMatch> OpeningMatches =
    [
        new("opening-mexico-vs-south-africa", "mexico", "south-africa", "Opening Match", 0),
        new("opening-south-korea-vs-czechia", "south-korea", "czechia", "Opening Match", 1),
    ];

    public static HashSet<string> OfficialTeamIds => Teams.Select(t => t.TeamId).ToHashSet(StringComparer.OrdinalIgnoreCase);

    public static HashSet<string> OfficialMatchIds => OpeningMatches.Select(m => m.MatchId).ToHashSet(StringComparer.OrdinalIgnoreCase);

    public static HashSet<string> OfficialGroupIds => Groups.Select(g => g.GroupId).ToHashSet(StringComparer.OrdinalIgnoreCase);
}

public sealed record OfficialGroup(string GroupId, string Label, int SortOrder);

public sealed record OfficialTeam(string TeamId, string Name, string Country, string FlagEmoji, string GroupId, int SortOrder);

public sealed record OfficialMatch(string MatchId, string TeamAId, string TeamBId, string Stage, int SortOrder);
