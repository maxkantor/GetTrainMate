using GetTrainMate.Api.Data;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Xunit;

namespace GetTrainMate.Api.Tests;

public class WorldCupBracketResolverTests
{
    private static EventTeam Team(string id, string groupId, int points, int gd, int gf) => new()
    {
        TeamId = id,
        GroupId = groupId,
        Points = points,
        GoalDifference = gd,
        GoalsFor = gf,
    };

    private static EventMatch CompletedGroupMatch(string groupId, string teamA, string teamB, int scoreA, int scoreB) => new()
    {
        GroupId = groupId,
        TeamAId = teamA,
        TeamBId = teamB,
        ScoreA = scoreA,
        ScoreB = scoreB,
        Status = EventMatchStatus.Completed,
    };

    [Fact]
    public void ResolveRoundOf32_2A_vs_2B_when_groups_complete()
    {
        var teams = new List<EventTeam>
        {
            Team("mexico", "group-a", 6, 2, 5),
            Team("south-africa", "group-a", 4, 0, 3),
            Team("south-korea", "group-a", 3, -1, 2),
            Team("czechia", "group-a", 1, -1, 1),
            Team("canada", "group-b", 4, 0, 3),
            Team("bosnia-herzegovina", "group-b", 7, 2, 6),
            Team("qatar", "group-b", 2, -1, 2),
            Team("switzerland", "group-b", 1, -1, 1),
        };

        var matches = BuildCompleteGroupMatches("group-a", ["mexico", "south-africa", "south-korea", "czechia"])
            .Concat(BuildCompleteGroupMatches("group-b", ["canada", "bosnia-herzegovina", "qatar", "switzerland"]))
            .ToList();

        var def = WorldCupKnockoutBracket.RoundOf32[0];
        var (teamA, teamB) = WorldCupBracketResolver.ResolveRoundOf32Teams(def, teams, matches);

        Assert.Equal("south-africa", teamA);
        Assert.Equal("canada", teamB);
    }

    [Fact]
    public void BuildAdvancementTeams_places_winner_in_downstream_slot()
    {
        var r32 = new EventMatch
        {
            MatchId = "r32-m01",
            TeamAId = "south-africa",
            TeamBId = "canada",
            ScoreA = 2,
            ScoreB = 1,
            Status = EventMatchStatus.Completed,
        };
        var matchById = new Dictionary<string, EventMatch>(StringComparer.OrdinalIgnoreCase)
        {
            ["r32-m01"] = r32,
        };

        var slots = WorldCupBracketResolver.BuildAdvancementTeams(matchById);

        Assert.True(slots.TryGetValue("r16-m02", out var slot));
        Assert.Equal("south-africa", slot.TeamAId);
        Assert.Null(slot.TeamBId);
    }

    [Fact]
    public void KnockoutKickoffFor_r32_returns_official_utc_time()
    {
        var kickoff = WorldCupBracketResolver.KnockoutKickoffFor("r32-m01");
        Assert.NotNull(kickoff);
        Assert.Equal("2026-06-28", kickoff.Value.Date);
        Assert.Equal("19:00", kickoff.Value.Time);
    }

    [Fact]
    public void KnockoutKickoffFor_july11_quarterfinals_match_fifa_et()
    {
        var norwayEngland = WorldCupBracketResolver.KnockoutKickoffFor("qf-m04");
        Assert.NotNull(norwayEngland);
        Assert.Equal("2026-07-11", norwayEngland.Value.Date);
        Assert.Equal("21:00", norwayEngland.Value.Time);

        var argSwitzerland = WorldCupBracketResolver.KnockoutKickoffFor("qf-m03");
        Assert.NotNull(argSwitzerland);
        Assert.Equal("2026-07-12", argSwitzerland.Value.Date);
        Assert.Equal("01:00", argSwitzerland.Value.Time);
    }

    private static IEnumerable<EventMatch> BuildCompleteGroupMatches(string groupId, string[] teamIds)
    {
        for (var i = 0; i < teamIds.Length; i++)
        {
            for (var j = i + 1; j < teamIds.Length; j++)
            {
                yield return CompletedGroupMatch(groupId, teamIds[i], teamIds[j], 1, 0);
            }
        }
    }
}
