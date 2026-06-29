using GetTrainMate.Api.Data;

namespace GetTrainMate.Api.Services;

/// <summary>
/// Validates tournament semi-final picks against the fixed FIFA 2026 knockout tree.
/// </summary>
public static class TournamentBracketPathRules
{
    private static readonly string[] QuarterFinalIds = ["qf-m01", "qf-m02", "qf-m03", "qf-m04"];

    private static readonly Dictionary<string, string> WinnerAdvancement =
        WorldCupKnockoutBracket.Advancements
            .Where(a => !string.Equals(a.ToMatchId, "third-place", StringComparison.OrdinalIgnoreCase))
            .GroupBy(a => a.FromMatchId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First().ToMatchId, StringComparer.OrdinalIgnoreCase);

    private sealed record KnockoutEntry(string R32MatchId, int GroupPlace);

    /// <summary>
    /// True when both teams could win their group and meet before the quarter-finals
    /// (e.g. Germany 1E vs France 1I in the round of 16).
    /// </summary>
    public static bool HasGroupWinnerPathCollision(string teamAId, string teamBId)
    {
        if (string.Equals(teamAId, teamBId, StringComparison.OrdinalIgnoreCase)) return true;

        var letterA = GetGroupLetter(teamAId);
        var letterB = GetGroupLetter(teamBId);
        if (letterA == '?' || letterB == '?') return false;

        var winnersA = GetPossibleEntries(letterA).Where(e => e.GroupPlace == 1);
        var winnersB = GetPossibleEntries(letterB).Where(e => e.GroupPlace == 1);

        foreach (var entryA in winnersA)
        {
            foreach (var entryB in winnersB)
            {
                if (PathsIntersectBeforeQuarterFinal(entryA, entryB))
                    return true;
            }
        }

        return false;
    }

    /// <summary>
    /// True when any valid group finish could put both teams on the same knockout path
    /// before the quarter-finals.
    /// </summary>
    public static bool HasEarlyBracketCollision(string teamAId, string teamBId)
    {
        if (string.Equals(teamAId, teamBId, StringComparison.OrdinalIgnoreCase)) return true;

        var letterA = GetGroupLetter(teamAId);
        var letterB = GetGroupLetter(teamBId);
        if (letterA == '?' || letterB == '?') return false;

        foreach (var entryA in GetPossibleEntries(letterA))
        {
            foreach (var entryB in GetPossibleEntries(letterB))
            {
                if (PathsIntersectBeforeQuarterFinal(entryA, entryB))
                    return true;
            }
        }

        return false;
    }

    /// <summary>
    /// All four picks must fit four distinct quarter-final paths on the official bracket.
    /// </summary>
    public static bool CanAllReachSemifinals(IReadOnlyList<string> teamIds)
    {
        if (teamIds.Count != TournamentBracketPick.SemifinalistCount) return false;

        for (var i = 0; i < teamIds.Count; i++)
        {
            for (var j = i + 1; j < teamIds.Count; j++)
            {
                if (HasGroupWinnerPathCollision(teamIds[i], teamIds[j]))
                    return false;
            }
        }

        return TryAssignDistinctQuarterFinals(teamIds, 0, new KnockoutEntry[teamIds.Count], new HashSet<string>(StringComparer.OrdinalIgnoreCase));
    }

    public static string? FindCollisionPairLabel(IReadOnlyList<string> teamIds, IReadOnlyDictionary<string, string> teamNames)
    {
        for (var i = 0; i < teamIds.Count; i++)
        {
            for (var j = i + 1; j < teamIds.Count; j++)
            {
                if (!HasGroupWinnerPathCollision(teamIds[i], teamIds[j])) continue;

                var nameA = teamNames.TryGetValue(teamIds[i], out var a) ? a : teamIds[i];
                var nameB = teamNames.TryGetValue(teamIds[j], out var b) ? b : teamIds[j];
                return $"{nameA} & {nameB}";
            }
        }

        if (!TryAssignDistinctQuarterFinals(teamIds, 0, new KnockoutEntry[teamIds.Count], new HashSet<string>(StringComparer.OrdinalIgnoreCase)))
        {
            return teamIds.Count > 0 ? teamIds[0] : null;
        }

        return null;
    }

    private static bool TryAssignDistinctQuarterFinals(
        IReadOnlyList<string> teamIds,
        int index,
        KnockoutEntry[] chosen,
        HashSet<string> usedQuarterFinals)
    {
        if (index >= teamIds.Count) return usedQuarterFinals.Count == QuarterFinalIds.Length;

        var letter = GetGroupLetter(teamIds[index]);
        if (letter == '?') return false;

        foreach (var entry in GetPossibleEntries(letter))
        {
            var qf = TraceQuarterFinal(entry);
            if (qf == null || usedQuarterFinals.Contains(qf)) continue;

            var conflicts = false;
            for (var i = 0; i < index; i++)
            {
                if (PathsIntersectBeforeQuarterFinal(chosen[i], entry))
                {
                    conflicts = true;
                    break;
                }
            }

            if (conflicts) continue;

            chosen[index] = entry;
            usedQuarterFinals.Add(qf);
            if (TryAssignDistinctQuarterFinals(teamIds, index + 1, chosen, usedQuarterFinals))
                return true;
            usedQuarterFinals.Remove(qf);
        }

        return false;
    }

    private static bool PathsIntersectBeforeQuarterFinal(KnockoutEntry entryA, KnockoutEntry entryB)
    {
        var pathA = TracePathMatchIds(entryA);
        var pathB = TracePathMatchIds(entryB);
        return pathA.Overlaps(pathB);
    }

    private static HashSet<string> TracePathMatchIds(KnockoutEntry entry)
    {
        var path = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { entry.R32MatchId };
        var current = entry.R32MatchId;

        while (WinnerAdvancement.TryGetValue(current, out var next))
        {
            if (next.StartsWith("qf-m", StringComparison.OrdinalIgnoreCase))
            {
                path.Add(next);
                break;
            }

            path.Add(next);
            current = next;
        }

        return path;
    }

    private static string? TraceQuarterFinal(KnockoutEntry entry)
    {
        var current = entry.R32MatchId;
        while (WinnerAdvancement.TryGetValue(current, out var next))
        {
            if (next.StartsWith("qf-m", StringComparison.OrdinalIgnoreCase))
                return next;
            current = next;
        }

        return null;
    }

    private static List<KnockoutEntry> GetPossibleEntries(char groupLetter)
    {
        var entries = new List<KnockoutEntry>();

        foreach (var r32 in WorldCupKnockoutBracket.RoundOf32)
        {
            if (SlotMatches(r32.TeamA, groupLetter, 1) || SlotMatches(r32.TeamA, groupLetter, 2))
                entries.Add(new KnockoutEntry(r32.MatchId, r32.TeamA.Place));

            if (SlotMatches(r32.TeamB, groupLetter, 1)
                || SlotMatches(r32.TeamB, groupLetter, 2)
                || SlotMatches(r32.TeamB, groupLetter, 3))
                entries.Add(new KnockoutEntry(r32.MatchId, r32.TeamB.Place));
        }

        return entries
            .GroupBy(e => $"{e.R32MatchId}|{e.GroupPlace}")
            .Select(g => g.First())
            .ToList();
    }

    private static bool SlotMatches(WorldCupKnockoutBracket.GroupSlot slot, char letter, int place) =>
        slot.Group == letter && slot.Place == place;

    private static char GetGroupLetter(string teamId)
    {
        var team = WorldCupOfficialFixtures.Teams
            .FirstOrDefault(t => string.Equals(t.TeamId, teamId, StringComparison.OrdinalIgnoreCase));
        return team == null ? '?' : WorldCupKnockoutBracket.GroupLetter(team.GroupId);
    }
}
