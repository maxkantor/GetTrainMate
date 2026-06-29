using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Xunit;

namespace GetTrainMate.Api.Tests;

public class TournamentPickRulesTests
{
    [Fact]
    public void Validate_accepts_four_semifinalists_champion_and_third()
    {
        var eligible = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "brazil", "france", "germany", "spain", "argentina", "england",
        };

        var request = new UpsertTournamentPickRequest
        {
            SemifinalTeamIds = ["brazil", "france", "germany", "spain"],
            ChampionTeamId = "brazil",
            ThirdPlaceTeamId = "france",
        };

        TournamentPickRules.Validate(request, eligible);
    }

    [Fact]
    public void Validate_rejects_champion_not_in_semifinals()
    {
        var eligible = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "brazil", "france", "germany", "spain", "argentina",
        };

        var request = new UpsertTournamentPickRequest
        {
            SemifinalTeamIds = ["brazil", "france", "germany", "spain"],
            ChampionTeamId = "argentina",
            ThirdPlaceTeamId = "france",
        };

        Assert.Throws<InvalidOperationException>(() => TournamentPickRules.Validate(request, eligible));
    }
}
