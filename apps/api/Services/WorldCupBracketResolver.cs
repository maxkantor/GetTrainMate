using GetTrainMate.Api.Data;
using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

/// <summary>
/// Resolves FIFA 2026 knockout slots from group standings and advances winners through the bracket.
/// </summary>
public static class WorldCupBracketResolver
{
    private const int GroupStageMatchesPerGroup = 6;

    public static bool IsGroupComplete(char groupLetter, IReadOnlyList<EventMatch> matches)
    {
        var groupId = WorldCupKnockoutBracket.GroupIdFromLetter(groupLetter);
        var groupMatches = matches
            .Where(m => string.Equals(m.GroupId, groupId, StringComparison.OrdinalIgnoreCase))
            .ToList();
        if (groupMatches.Count < GroupStageMatchesPerGroup) return false;
        return groupMatches.All(m =>
            string.Equals(m.Status, EventMatchStatus.Completed, StringComparison.OrdinalIgnoreCase)
            && m.ScoreA.HasValue && m.ScoreB.HasValue);
    }

    public static IReadOnlyList<EventTeam> RankGroup(
        char groupLetter,
        IReadOnlyList<EventTeam> teams,
        IReadOnlyList<EventMatch> matches)
    {
        var groupId = WorldCupKnockoutBracket.GroupIdFromLetter(groupLetter);
        var groupTeams = teams
            .Where(t => string.Equals(t.GroupId, groupId, StringComparison.OrdinalIgnoreCase))
            .ToList();
        return groupTeams
            .OrderByDescending(t => t.Points)
            .ThenByDescending(t => t.GoalDifference)
            .ThenByDescending(t => t.GoalsFor)
            .ThenBy(t => t.TeamId, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    /// <summary>Top eight third-place teams across the twelve groups (FIFA tie-breakers).</summary>
    public static IReadOnlyList<EventTeam> RankThirdPlaceTeams(
        IReadOnlyList<EventTeam> teams,
        IReadOnlyList<EventMatch> matches)
    {
        var thirdPlace = WorldCupOfficialFixtures.Groups
            .Select(g => WorldCupKnockoutBracket.GroupLetter(g.GroupId))
            .Select(letter =>
            {
                var ranked = RankGroup(letter, teams, matches);
                return ranked.Count >= 3 ? ranked[2] : null;
            })
            .Where(t => t != null)
            .Cast<EventTeam>()
            .OrderByDescending(t => t.Points)
            .ThenByDescending(t => t.GoalDifference)
            .ThenByDescending(t => t.GoalsFor)
            .ThenBy(t => t.TeamId, StringComparer.OrdinalIgnoreCase)
            .Take(8)
            .ToList();
        return thirdPlace;
    }

    public static HashSet<char> QualifyingThirdPlaceGroups(
        IReadOnlyList<EventTeam> teams,
        IReadOnlyList<EventMatch> matches)
    {
        return RankThirdPlaceTeams(teams, matches)
            .Select(t => WorldCupKnockoutBracket.GroupLetter(t.GroupId))
            .Where(c => c != '?')
            .ToHashSet();
    }

    public static bool AllGroupStageComplete(IReadOnlyList<EventMatch> matches) =>
        WorldCupOfficialFixtures.Groups.All(g =>
            IsGroupComplete(WorldCupKnockoutBracket.GroupLetter(g.GroupId), matches));

    public static string? ResolveGroupSlot(
        WorldCupKnockoutBracket.GroupSlot slot,
        IReadOnlyList<EventTeam> teams,
        IReadOnlyList<EventMatch> matches,
        HashSet<char>? qualifyingThirdGroups = null)
    {
        if (slot.Place is < 1 or > 3) return null;

        var ranked = RankGroup(slot.Group, teams, matches);
        if (ranked.Count < slot.Place) return null;

        if (slot.Place == 3)
        {
            if (!IsGroupComplete(slot.Group, matches)) return null;
            qualifyingThirdGroups ??= QualifyingThirdPlaceGroups(teams, matches);
            if (!qualifyingThirdGroups.Contains(slot.Group)) return null;
        }
        else
        {
            if (!IsGroupComplete(slot.Group, matches)) return null;
        }

        return ranked[slot.Place - 1].TeamId;
    }

    public static string? GetMatchWinner(EventMatch match) =>
        EventMatchRules.ResolveMatchWinner(match);

    public static string? GetMatchLoser(EventMatch match) =>
        EventMatchRules.ResolveMatchLoser(match);

    public static bool IsKnownTeam(string? teamId) =>
        !string.IsNullOrWhiteSpace(teamId)
        && !WorldCupOfficialFixtures.IsTbdTeamId(teamId);

    public static (string? TeamAId, string? TeamBId) ResolveRoundOf32Teams(
        WorldCupKnockoutBracket.BracketMatch def,
        IReadOnlyList<EventTeam> teams,
        IReadOnlyList<EventMatch> matches)
    {
        HashSet<char>? qualifyingThird = def.TeamA.Place == 3 || def.TeamB.Place == 3
            ? QualifyingThirdPlaceGroups(teams, matches)
            : null;

        return (
            ResolveGroupSlot(def.TeamA, teams, matches, qualifyingThird),
            ResolveGroupSlot(def.TeamB, teams, matches, qualifyingThird));
    }

    public static (string Date, string Time)? KnockoutKickoffFor(string matchId)
    {
        var r32 = WorldCupKnockoutBracket.RoundOf32
            .FirstOrDefault(m => string.Equals(m.MatchId, matchId, StringComparison.OrdinalIgnoreCase));
        if (r32 != null) return (r32.DateUtc, r32.TimeUtc);

        if (WorldCupKnockoutBracket.KnockoutKickoffs.TryGetValue(matchId, out var ko))
            return ko;

        return null;
    }

    /// <summary>Apply winner/loser feeds into downstream knockout slots.</summary>
    public static Dictionary<string, (string? TeamAId, string? TeamBId)> BuildAdvancementTeams(
        IReadOnlyDictionary<string, EventMatch> matchById)
    {
        var slots = new Dictionary<string, (string? TeamAId, string? TeamBId)>(StringComparer.OrdinalIgnoreCase);

        foreach (var adv in WorldCupKnockoutBracket.Advancements)
        {
            if (!matchById.TryGetValue(adv.FromMatchId, out var from)) continue;

            var isThirdPlace = string.Equals(adv.ToMatchId, "third-place", StringComparison.OrdinalIgnoreCase);
            var teamId = isThirdPlace ? GetMatchLoser(from) : GetMatchWinner(from);
            if (!IsKnownTeam(teamId)) continue;

            if (!slots.TryGetValue(adv.ToMatchId, out var slot))
                slot = (null, null);

            slot = adv.ToSideA ? (teamId, slot.TeamBId) : (slot.TeamAId, teamId);
            slots[adv.ToMatchId] = slot;
        }

        return slots;
    }
}
