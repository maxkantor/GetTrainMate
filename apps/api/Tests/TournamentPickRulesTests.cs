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
            "mexico", "canada", "usa", "germany", "spain", "argentina",
        };

        var request = new UpsertTournamentPickRequest
        {
            SemifinalTeamIds = ["mexico", "canada", "usa", "germany"],
            ChampionTeamId = "usa",
            ThirdPlaceTeamId = "canada",
        };

        TournamentPickRules.Validate(request, eligible);
    }

    [Fact]
    public void Validate_rejects_germany_and_france_both_semifinalists()
    {
        var eligible = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "germany", "france", "spain", "argentina",
        };

        var request = new UpsertTournamentPickRequest
        {
            SemifinalTeamIds = ["germany", "france", "spain", "argentina"],
            ChampionTeamId = "germany",
            ThirdPlaceTeamId = "france",
        };

        var ex = Assert.Throws<InvalidOperationException>(() => TournamentPickRules.Validate(request, eligible));
        Assert.Contains("Germany", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("France", ex.Message, StringComparison.OrdinalIgnoreCase);
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
