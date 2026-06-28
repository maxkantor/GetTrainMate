namespace GetTrainMate.Api.Data;

/// <summary>FIFA 2026 fixed bracket — match ids align with <see cref="WorldCupOfficialFixtures.KnockoutMatches"/>.</summary>
public static class WorldCupKnockoutBracket
{
    /// <summary>Group-stage slot label, e.g. 1A = group A winner, 2B = runner-up, 3E = third in group E.</summary>
    public sealed record GroupSlot(int Place, char Group);

    public sealed record BracketMatch(
        string MatchId,
        string Stage,
        GroupSlot TeamA,
        GroupSlot TeamB,
        string DateUtc,
        string TimeUtc);

    /// <summary>Round of 32 — FIFA match numbers 73–88 in kickoff order (r32-m01 … r32-m16).</summary>
    public static readonly IReadOnlyList<BracketMatch> RoundOf32 =
    [
        new("r32-m01", EventMatchStage.RoundOf32, new(2, 'A'), new(2, 'B'), "2026-06-28", "19:00"),
        new("r32-m02", EventMatchStage.RoundOf32, new(1, 'C'), new(2, 'F'), "2026-06-29", "17:00"),
        new("r32-m03", EventMatchStage.RoundOf32, new(1, 'E'), new(3, 'D'), "2026-06-29", "20:30"),
        new("r32-m04", EventMatchStage.RoundOf32, new(1, 'F'), new(2, 'C'), "2026-06-30", "01:00"),
        new("r32-m05", EventMatchStage.RoundOf32, new(2, 'E'), new(2, 'I'), "2026-06-30", "17:00"),
        new("r32-m06", EventMatchStage.RoundOf32, new(1, 'I'), new(3, 'F'), "2026-06-30", "21:00"),
        new("r32-m07", EventMatchStage.RoundOf32, new(1, 'A'), new(3, 'E'), "2026-07-01", "01:00"),
        new("r32-m08", EventMatchStage.RoundOf32, new(1, 'L'), new(3, 'K'), "2026-07-01", "16:00"),
        new("r32-m09", EventMatchStage.RoundOf32, new(1, 'G'), new(3, 'I'), "2026-07-01", "20:00"),
        new("r32-m10", EventMatchStage.RoundOf32, new(1, 'D'), new(3, 'B'), "2026-07-02", "00:00"),
        new("r32-m11", EventMatchStage.RoundOf32, new(1, 'H'), new(2, 'J'), "2026-07-02", "19:00"),
        new("r32-m12", EventMatchStage.RoundOf32, new(2, 'K'), new(2, 'L'), "2026-07-02", "23:00"),
        new("r32-m13", EventMatchStage.RoundOf32, new(1, 'B'), new(3, 'J'), "2026-07-03", "03:00"),
        new("r32-m14", EventMatchStage.RoundOf32, new(1, 'J'), new(2, 'H'), "2026-07-03", "22:00"),
        new("r32-m15", EventMatchStage.RoundOf32, new(2, 'D'), new(2, 'G'), "2026-07-03", "18:00"),
        new("r32-m16", EventMatchStage.RoundOf32, new(1, 'K'), new(3, 'L'), "2026-07-04", "01:30"),
    ];

    /// <summary>Winner feeds into the next round (side A or B of the downstream match).</summary>
    public sealed record Advancement(string FromMatchId, string ToMatchId, bool ToSideA);

    public static readonly IReadOnlyList<Advancement> Advancements =
    [
        // Round of 16
        new("r32-m01", "r16-m02", true),
        new("r32-m04", "r16-m02", false),
        new("r32-m03", "r16-m01", true),
        new("r32-m06", "r16-m01", false),
        new("r32-m02", "r16-m03", true),
        new("r32-m05", "r16-m03", false),
        new("r32-m07", "r16-m04", true),
        new("r32-m08", "r16-m04", false),
        new("r32-m12", "r16-m05", true),
        new("r32-m11", "r16-m05", false),
        new("r32-m10", "r16-m06", true),
        new("r32-m09", "r16-m06", false),
        new("r32-m14", "r16-m07", true),
        new("r32-m15", "r16-m07", false),
        new("r32-m13", "r16-m08", true),
        new("r32-m16", "r16-m08", false),
        // Quarter-finals
        new("r16-m01", "qf-m01", true),
        new("r16-m02", "qf-m01", false),
        new("r16-m05", "qf-m02", true),
        new("r16-m06", "qf-m02", false),
        new("r16-m07", "qf-m03", true),
        new("r16-m08", "qf-m03", false),
        new("r16-m03", "qf-m04", true),
        new("r16-m04", "qf-m04", false),
        // Semi-finals
        new("qf-m01", "sf-m01", true),
        new("qf-m02", "sf-m01", false),
        new("qf-m04", "sf-m02", true),
        new("qf-m03", "sf-m02", false),
        // Final + third place
        new("sf-m01", "final", true),
        new("sf-m02", "final", false),
        new("sf-m01", "third-place", true),
        new("sf-m02", "third-place", false),
    ];

    /// <summary>Knockout kickoffs for R16 → Final (UTC).</summary>
    public static readonly IReadOnlyDictionary<string, (string Date, string Time)> KnockoutKickoffs =
        new Dictionary<string, (string, string)>(StringComparer.OrdinalIgnoreCase)
        {
            ["r16-m01"] = ("2026-07-04", "21:00"),
            ["r16-m02"] = ("2026-07-04", "16:00"),
            ["r16-m03"] = ("2026-07-05", "20:00"),
            ["r16-m04"] = ("2026-07-06", "00:00"),
            ["r16-m05"] = ("2026-07-06", "19:00"),
            ["r16-m06"] = ("2026-07-07", "00:00"),
            ["r16-m07"] = ("2026-07-07", "16:00"),
            ["r16-m08"] = ("2026-07-07", "20:00"),
            ["qf-m01"] = ("2026-07-09", "20:00"),
            ["qf-m02"] = ("2026-07-10", "19:00"),
            ["qf-m03"] = ("2026-07-11", "20:00"),
            ["qf-m04"] = ("2026-07-11", "23:00"),
            ["sf-m01"] = ("2026-07-14", "19:00"),
            ["sf-m02"] = ("2026-07-15", "19:00"),
            ["third-place"] = ("2026-07-18", "19:00"),
            ["final"] = ("2026-07-19", "19:00"),
        };

    /// <summary>
    /// When these eight third-place groups qualify, FIFA combination 67 assigns third-place opponents
    /// for group winners (Annex C — 2026 tournament result).
    /// </summary>
    public static readonly IReadOnlyDictionary<char, char> ThirdPlaceOpponentByWinner =
        new Dictionary<char, char>
        {
            ['A'] = 'E',
            ['B'] = 'J',
            ['D'] = 'B',
            ['E'] = 'D',
            ['G'] = 'I',
            ['I'] = 'F',
            ['K'] = 'L',
            ['L'] = 'K',
        };

    public static char GroupLetter(string groupId)
    {
        if (string.IsNullOrWhiteSpace(groupId)) return '?';
        var id = groupId.Trim().ToLowerInvariant();
        if (id.StartsWith("group-") && id.Length >= 7) return char.ToUpperInvariant(id[^1]);
        return '?';
    }

    public static string GroupIdFromLetter(char letter) =>
        $"group-{char.ToLowerInvariant(letter)}";
}
