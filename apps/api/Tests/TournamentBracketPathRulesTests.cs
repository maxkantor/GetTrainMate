using GetTrainMate.Api.Data;
using GetTrainMate.Api.Services;
using Xunit;

namespace GetTrainMate.Api.Tests;

public class TournamentBracketPathRulesTests
{
    [Fact]
    public void GermanyAndFrance_GroupWinnersMeetBeforeQuarterFinals()
    {
        Assert.True(TournamentBracketPathRules.HasGroupWinnerPathCollision("germany", "france"));
        Assert.True(TournamentBracketPathRules.HasEarlyBracketCollision("germany", "france"));
    }

    [Fact]
    public void SpainAndArgentina_GroupWinnersDoNotCollide()
    {
        Assert.False(TournamentBracketPathRules.HasGroupWinnerPathCollision("spain", "argentina"));
    }

    [Fact]
    public void FourFavoritesWithGermanyFrance_IsInvalid()
    {
        Assert.False(TournamentBracketPathRules.CanAllReachSemifinals(
            ["germany", "france", "spain", "argentina"]));
    }

    [Fact]
    public void Discover_valid_semifinal_quartet_exists()
    {
        var ids = WorldCupOfficialFixtures.Teams.Select(t => t.TeamId).ToList();
        string? found = null;
        for (var i = 0; i < ids.Count && found == null; i++)
        for (var j = i + 1; j < ids.Count && found == null; j++)
        for (var k = j + 1; k < ids.Count && found == null; k++)
        for (var l = k + 1; l < ids.Count && found == null; l++)
        {
            var quad = new[] { ids[i], ids[j], ids[k], ids[l] };
            if (TournamentBracketPathRules.CanAllReachSemifinals(quad))
                found = string.Join(", ", quad);
        }

        Assert.False(string.IsNullOrWhiteSpace(found), "No valid quartet found");
    }

    [Fact]
    public void MexicoCanadaUsaGermany_CanAllReachSemifinals()
    {
        Assert.True(TournamentBracketPathRules.CanAllReachSemifinals(
            ["mexico", "canada", "usa", "germany"]));
    }
}
