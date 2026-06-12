namespace GetTrainMate.Api.Data;

/// <summary>Canonical stage labels — web maps these to localized headings.</summary>
public static class EventMatchStage
{
    public const string GroupStage = "Group Stage";
    public const string RoundOf32 = "Round of 32";
    public const string RoundOf16 = "Round of 16";
    public const string QuarterFinal = "Quarter-final";
    public const string SemiFinal = "Semi-final";
    public const string ThirdPlace = "Third-place Match";
    public const string Final = "Final";
}

/// <summary>
/// Single authoritative World Cup 2026 fixture catalog.
/// Admin CRM and public hub read/write through EventHubService — never hardcode matches in the UI.
/// </summary>
public static class WorldCupOfficialFixtures
{
    public const string EventId = "world-cup-2026";

    /// <summary>Prefix used for knockout placeholder team slots until the real teams qualify.</summary>
    public const string TbdTeamPrefix = "tbd-";

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
        new("opening-mexico-vs-south-africa", "mexico", "south-africa", "Opening Match", "group-a", 0),
        new("opening-south-korea-vs-czechia", "south-korea", "czechia", "Opening Match", "group-b", 1),
    ];

    /// <summary>
    /// 2026 knockout bracket scaffolding (48-team format). Matches are seeded as locked TBD placeholders;
    /// the Admin CRM assigns real teams (and unlocks predictions) as each round's qualifiers are confirmed.
    /// </summary>
    public static readonly IReadOnlyList<OfficialKnockoutRound> KnockoutRounds =
    [
        new(EventMatchStage.RoundOf32, "r32", 16, 10),
        new(EventMatchStage.RoundOf16, "r16", 8, 20),
        new(EventMatchStage.QuarterFinal, "qf", 4, 30),
        new(EventMatchStage.SemiFinal, "sf", 2, 40),
        new(EventMatchStage.ThirdPlace, "third-place", 1, 50),
        new(EventMatchStage.Final, "final", 1, 60),
    ];

    public static IEnumerable<OfficialKnockoutMatch> KnockoutMatches =>
        KnockoutRounds.SelectMany(round => Enumerable.Range(1, round.MatchCount)
            .Select(i => new OfficialKnockoutMatch(
                round.MatchCount == 1 ? round.IdPrefix : $"{round.IdPrefix}-m{i:00}",
                round.Stage,
                round.SortOrder + i)));

    public static HashSet<string> OfficialTeamIds => Teams.Select(t => t.TeamId).ToHashSet(StringComparer.OrdinalIgnoreCase);

    public static HashSet<string> OfficialMatchIds => OpeningMatches.Select(m => m.MatchId).ToHashSet(StringComparer.OrdinalIgnoreCase);

    public static HashSet<string> OfficialGroupIds => Groups.Select(g => g.GroupId).ToHashSet(StringComparer.OrdinalIgnoreCase);

    public static bool IsTbdTeamId(string? teamId) =>
        !string.IsNullOrEmpty(teamId) && teamId.StartsWith(TbdTeamPrefix, StringComparison.OrdinalIgnoreCase);
}

public sealed record OfficialGroup(string GroupId, string Label, int SortOrder);

public sealed record OfficialTeam(string TeamId, string Name, string Country, string FlagEmoji, string GroupId, int SortOrder);

public sealed record OfficialMatch(string MatchId, string TeamAId, string TeamBId, string Stage, string GroupId, int SortOrder);

public sealed record OfficialKnockoutRound(string Stage, string IdPrefix, int MatchCount, int SortOrder);

public sealed record OfficialKnockoutMatch(string MatchId, string Stage, int SortOrder);
