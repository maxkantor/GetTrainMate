using GetTrainMate.Api.Data;
using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public static class TournamentPickRules
{
    /// <summary>Locks when the first semi-final kicks off.</summary>
    public static bool ArePicksOpen(DateTime utcNow)
    {
        var kickoff = EventMatchRules.ParseKickoffUtc("2026-07-14", "19:00");
        return !kickoff.HasValue || utcNow < kickoff.Value;
    }

    public static HashSet<string> GetEliminatedTeamIds(IReadOnlyList<EventMatch> matches)
    {
        var eliminated = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var match in matches)
        {
            if (!string.IsNullOrWhiteSpace(match.GroupId)) continue;
            if (!string.Equals(match.Status, EventMatchStatus.Completed, StringComparison.OrdinalIgnoreCase))
                continue;
            var loser = WorldCupBracketResolver.GetMatchLoser(match);
            if (!string.IsNullOrWhiteSpace(loser)) eliminated.Add(loser);
        }
        return eliminated;
    }

    public static HashSet<string> GetEligibleTeamIds(IReadOnlyList<EventMatch> matches)
    {
        var eliminated = GetEliminatedTeamIds(matches);
        var eligible = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var match in matches)
        {
            if (!string.IsNullOrWhiteSpace(match.GroupId)) continue;
            foreach (var teamId in new[] { match.TeamAId, match.TeamBId })
            {
                if (WorldCupBracketResolver.IsKnownTeam(teamId) && !eliminated.Contains(teamId))
                    eligible.Add(teamId);
            }
        }

        if (eligible.Count == 0)
        {
            foreach (var team in WorldCupOfficialFixtures.Teams)
                eligible.Add(team.TeamId);
        }

        return eligible;
    }

    public static void Validate(
        UpsertTournamentPickRequest request,
        IReadOnlySet<string> eligibleTeamIds)
    {
        var semifinals = request.SemifinalTeamIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (semifinals.Count != TournamentBracketPick.SemifinalistCount)
            throw new InvalidOperationException($"Pick exactly {TournamentBracketPick.SemifinalistCount} semi-final teams.");

        foreach (var id in semifinals)
        {
            if (!eligibleTeamIds.Contains(id))
                throw new InvalidOperationException("One or more selected teams are no longer in the bracket.");
        }

        if (string.IsNullOrWhiteSpace(request.ChampionTeamId))
            throw new InvalidOperationException("Pick a champion.");
        if (string.IsNullOrWhiteSpace(request.ThirdPlaceTeamId))
            throw new InvalidOperationException("Pick a third-place team.");

        var champion = request.ChampionTeamId.Trim();
        var third = request.ThirdPlaceTeamId.Trim();

        if (!semifinals.Contains(champion, StringComparer.OrdinalIgnoreCase))
            throw new InvalidOperationException("Champion must be one of your semi-final picks.");
        if (!semifinals.Contains(third, StringComparer.OrdinalIgnoreCase))
            throw new InvalidOperationException("Third place must be one of your semi-final picks.");
        if (string.Equals(champion, third, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Champion and third place must be different teams.");
    }
}
