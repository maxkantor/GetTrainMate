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

    /// <summary>All 12 groups from the official FIFA World Cup 2026 draw.</summary>
    public static readonly IReadOnlyList<OfficialGroup> Groups =
    [
        new("group-a", "Group A", 0),
        new("group-b", "Group B", 1),
        new("group-c", "Group C", 2),
        new("group-d", "Group D", 3),
        new("group-e", "Group E", 4),
        new("group-f", "Group F", 5),
        new("group-g", "Group G", 6),
        new("group-h", "Group H", 7),
        new("group-i", "Group I", 8),
        new("group-j", "Group J", 9),
        new("group-k", "Group K", 10),
        new("group-l", "Group L", 11),
    ];

    /// <summary>All 48 qualified teams with official group assignments (FIFA.com standings, June 2026).</summary>
    public static readonly IReadOnlyList<OfficialTeam> Teams =
    [
        // Group A
        new("mexico", "Mexico", "Mexico", "🇲🇽", "group-a", 0),
        new("south-africa", "South Africa", "South Africa", "🇿🇦", "group-a", 1),
        new("south-korea", "South Korea", "South Korea", "🇰🇷", "group-a", 2),
        new("czechia", "Czechia", "Czechia", "🇨🇿", "group-a", 3),
        // Group B
        new("canada", "Canada", "Canada", "🇨🇦", "group-b", 0),
        new("bosnia-herzegovina", "Bosnia and Herzegovina", "Bosnia and Herzegovina", "🇧🇦", "group-b", 1),
        new("qatar", "Qatar", "Qatar", "🇶🇦", "group-b", 2),
        new("switzerland", "Switzerland", "Switzerland", "🇨🇭", "group-b", 3),
        // Group C
        new("brazil", "Brazil", "Brazil", "🇧🇷", "group-c", 0),
        new("morocco", "Morocco", "Morocco", "🇲🇦", "group-c", 1),
        new("haiti", "Haiti", "Haiti", "🇭🇹", "group-c", 2),
        new("scotland", "Scotland", "Scotland", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "group-c", 3),
        // Group D
        new("usa", "United States", "United States", "🇺🇸", "group-d", 0),
        new("paraguay", "Paraguay", "Paraguay", "🇵🇾", "group-d", 1),
        new("australia", "Australia", "Australia", "🇦🇺", "group-d", 2),
        new("turkiye", "Türkiye", "Türkiye", "🇹🇷", "group-d", 3),
        // Group E
        new("germany", "Germany", "Germany", "🇩🇪", "group-e", 0),
        new("curacao", "Curaçao", "Curaçao", "🇨🇼", "group-e", 1),
        new("ivory-coast", "Ivory Coast", "Ivory Coast", "🇨🇮", "group-e", 2),
        new("ecuador", "Ecuador", "Ecuador", "🇪🇨", "group-e", 3),
        // Group F
        new("netherlands", "Netherlands", "Netherlands", "🇳🇱", "group-f", 0),
        new("japan", "Japan", "Japan", "🇯🇵", "group-f", 1),
        new("sweden", "Sweden", "Sweden", "🇸🇪", "group-f", 2),
        new("tunisia", "Tunisia", "Tunisia", "🇹🇳", "group-f", 3),
        // Group G
        new("belgium", "Belgium", "Belgium", "🇧🇪", "group-g", 0),
        new("egypt", "Egypt", "Egypt", "🇪🇬", "group-g", 1),
        new("iran", "Iran", "Iran", "🇮🇷", "group-g", 2),
        new("new-zealand", "New Zealand", "New Zealand", "🇳🇿", "group-g", 3),
        // Group H
        new("spain", "Spain", "Spain", "🇪🇸", "group-h", 0),
        new("cape-verde", "Cape Verde", "Cape Verde", "🇨🇻", "group-h", 1),
        new("saudi-arabia", "Saudi Arabia", "Saudi Arabia", "🇸🇦", "group-h", 2),
        new("uruguay", "Uruguay", "Uruguay", "🇺🇾", "group-h", 3),
        // Group I
        new("france", "France", "France", "🇫🇷", "group-i", 0),
        new("senegal", "Senegal", "Senegal", "🇸🇳", "group-i", 1),
        new("norway", "Norway", "Norway", "🇳🇴", "group-i", 2),
        new("iraq", "Iraq", "Iraq", "🇮🇶", "group-i", 3),
        // Group J
        new("argentina", "Argentina", "Argentina", "🇦🇷", "group-j", 0),
        new("algeria", "Algeria", "Algeria", "🇩🇿", "group-j", 1),
        new("austria", "Austria", "Austria", "🇦🇹", "group-j", 2),
        new("jordan", "Jordan", "Jordan", "🇯🇴", "group-j", 3),
        // Group K
        new("portugal", "Portugal", "Portugal", "🇵🇹", "group-k", 0),
        new("colombia", "Colombia", "Colombia", "🇨🇴", "group-k", 1),
        new("dr-congo", "DR Congo", "DR Congo", "🇨🇩", "group-k", 2),
        new("uzbekistan", "Uzbekistan", "Uzbekistan", "🇺🇿", "group-k", 3),
        // Group L
        new("england", "England", "England", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "group-l", 0),
        new("croatia", "Croatia", "Croatia", "🇭🇷", "group-l", 1),
        new("ghana", "Ghana", "Ghana", "🇬🇭", "group-l", 2),
        new("panama", "Panama", "Panama", "🇵🇦", "group-l", 3),
    ];

    /// <summary>
    /// Named opening fixtures (both are Group A games). The remaining 70 group fixtures are
    /// auto-generated as a round-robin per group — kickoff dates/venues arrive via Admin CRM.
    /// </summary>
    public static readonly IReadOnlyList<OfficialMatch> OpeningMatches =
    [
        new("opening-mexico-vs-south-africa", "mexico", "south-africa", "Opening Match", "group-a", 0),
        new("opening-south-korea-vs-czechia", "south-korea", "czechia", "Opening Match", "group-a", 1),
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
