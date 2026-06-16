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

    /// <summary>Authoritative opening fixtures only — scores sync from live feeds on hub load.</summary>
    public static readonly IReadOnlyList<OfficialResult> OpeningResults = [];

    /// <summary>Deprecated — scores sync from ESPN + openfootball on every hub refresh.</summary>
    public static readonly IReadOnlyList<OfficialPairResult> ScoreOverrides = [];

    /// <summary>
    /// Official kickoff times for all 72 group-stage fixtures (FIFA schedule, stored in UTC —
    /// ET kickoffs are UTC-4 in June). Looked up by team pair, so generated fixture order doesn't matter.
    /// </summary>
    public static readonly IReadOnlyList<OfficialKickoff> GroupKickoffs =
    [
        // Matchday 1 (June 11-17)
        new("mexico", "south-africa", "2026-06-11", "19:00"),
        new("south-korea", "czechia", "2026-06-12", "02:00"),
        new("canada", "bosnia-herzegovina", "2026-06-12", "19:00"),
        new("usa", "paraguay", "2026-06-13", "01:00"),
        new("australia", "turkiye", "2026-06-14", "04:00"),
        new("qatar", "switzerland", "2026-06-13", "19:00"),
        new("brazil", "morocco", "2026-06-13", "22:00"),
        new("haiti", "scotland", "2026-06-14", "01:00"),
        new("germany", "curacao", "2026-06-14", "17:00"),
        new("netherlands", "japan", "2026-06-14", "20:00"),
        new("ivory-coast", "ecuador", "2026-06-14", "23:00"),
        new("sweden", "tunisia", "2026-06-15", "02:00"),
        new("spain", "cape-verde", "2026-06-15", "16:00"),
        new("belgium", "egypt", "2026-06-15", "19:00"),
        new("saudi-arabia", "uruguay", "2026-06-15", "22:00"),
        new("iran", "new-zealand", "2026-06-16", "01:00"),
        new("austria", "jordan", "2026-06-17", "04:00"),
        new("france", "senegal", "2026-06-16", "19:00"),
        new("iraq", "norway", "2026-06-16", "22:00"),
        new("argentina", "algeria", "2026-06-17", "01:00"),
        new("portugal", "dr-congo", "2026-06-17", "17:00"),
        new("england", "croatia", "2026-06-17", "20:00"),
        new("ghana", "panama", "2026-06-17", "23:00"),
        new("uzbekistan", "colombia", "2026-06-18", "02:00"),
        // Matchday 2 (June 18-23)
        new("czechia", "south-africa", "2026-06-18", "16:00"),
        new("switzerland", "bosnia-herzegovina", "2026-06-18", "19:00"),
        new("canada", "qatar", "2026-06-18", "22:00"),
        new("mexico", "south-korea", "2026-06-19", "01:00"),
        new("usa", "australia", "2026-06-19", "19:00"),
        new("scotland", "morocco", "2026-06-19", "22:00"),
        new("brazil", "haiti", "2026-06-20", "00:30"),
        new("turkiye", "paraguay", "2026-06-20", "03:00"),
        new("tunisia", "japan", "2026-06-20", "04:00"),
        new("netherlands", "sweden", "2026-06-20", "17:00"),
        new("germany", "ivory-coast", "2026-06-20", "20:00"),
        new("ecuador", "curacao", "2026-06-21", "00:00"),
        new("spain", "saudi-arabia", "2026-06-21", "16:00"),
        new("belgium", "iran", "2026-06-21", "19:00"),
        new("uruguay", "cape-verde", "2026-06-21", "22:00"),
        new("new-zealand", "egypt", "2026-06-22", "01:00"),
        new("argentina", "austria", "2026-06-22", "17:00"),
        new("france", "iraq", "2026-06-22", "21:00"),
        new("norway", "senegal", "2026-06-23", "00:00"),
        new("jordan", "algeria", "2026-06-23", "03:00"),
        new("portugal", "uzbekistan", "2026-06-23", "17:00"),
        new("england", "ghana", "2026-06-23", "20:00"),
        new("panama", "croatia", "2026-06-23", "23:00"),
        new("colombia", "dr-congo", "2026-06-24", "02:00"),
        // Matchday 3 (June 24-27, simultaneous kickoffs per group)
        new("switzerland", "canada", "2026-06-24", "19:00"),
        new("bosnia-herzegovina", "qatar", "2026-06-24", "19:00"),
        new("scotland", "brazil", "2026-06-24", "22:00"),
        new("morocco", "haiti", "2026-06-24", "22:00"),
        new("czechia", "mexico", "2026-06-25", "01:00"),
        new("south-africa", "south-korea", "2026-06-25", "01:00"),
        new("curacao", "ivory-coast", "2026-06-25", "20:00"),
        new("ecuador", "germany", "2026-06-25", "20:00"),
        new("japan", "sweden", "2026-06-25", "23:00"),
        new("tunisia", "netherlands", "2026-06-25", "23:00"),
        new("turkiye", "usa", "2026-06-26", "02:00"),
        new("paraguay", "australia", "2026-06-26", "02:00"),
        new("norway", "france", "2026-06-26", "19:00"),
        new("senegal", "iraq", "2026-06-26", "19:00"),
        new("cape-verde", "saudi-arabia", "2026-06-27", "00:00"),
        new("uruguay", "spain", "2026-06-27", "00:00"),
        new("egypt", "iran", "2026-06-27", "03:00"),
        new("new-zealand", "belgium", "2026-06-27", "03:00"),
        new("panama", "england", "2026-06-27", "21:00"),
        new("croatia", "ghana", "2026-06-27", "21:00"),
        new("colombia", "portugal", "2026-06-27", "23:30"),
        new("dr-congo", "uzbekistan", "2026-06-27", "23:30"),
        new("algeria", "austria", "2026-06-28", "02:00"),
        new("jordan", "argentina", "2026-06-28", "02:00"),
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

public sealed record OfficialResult(string MatchId, int ScoreA, int ScoreB);

public sealed record OfficialPairResult(string TeamAId, string TeamBId, int ScoreA, int ScoreB, string Status = "Completed");

public sealed record OfficialKickoff(string TeamAId, string TeamBId, string DateUtc, string TimeUtc);

public sealed record OfficialKnockoutRound(string Stage, string IdPrefix, int MatchCount, int SortOrder);

public sealed record OfficialKnockoutMatch(string MatchId, string Stage, int SortOrder);
