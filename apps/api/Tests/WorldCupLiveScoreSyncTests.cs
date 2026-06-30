using System.Text;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Xunit;

namespace GetTrainMate.Api.Tests;

public class WorldCupLiveScoreSyncTests
{
    [Fact]
    public void MapEspnStatus_CompletedWhenPostAndDone()
    {
        Assert.Equal(EventMatchStatus.Completed, WorldCupLiveScoreSync.MapEspnStatus("post", completed: true));
    }

    [Fact]
    public void MapEspnStatus_LiveWhenInProgress()
    {
        Assert.Equal(EventMatchStatus.Live, WorldCupLiveScoreSync.MapEspnStatus("in", completed: false));
    }

    [Theory]
    [InlineData("Qatar", "qatar")]
    [InlineData("Switzerland", "switzerland")]
    [InlineData("United States", "usa")]
    [InlineData("Czech Republic", "czechia")]
    [InlineData("Bosnia & Herzegovina", "bosnia-herzegovina")]
    public void ResolveTeamId_MapsCommonNames(string name, string expectedId)
    {
        Assert.Equal(expectedId, WorldCupLiveScoreSync.ResolveTeamId(name));
    }

    [Fact]
    public void MergeEspnScoreboard_ParsesFullTimeResult()
    {
        const string json = """
        {
          "events": [{
            "competitions": [{
              "status": { "type": { "state": "post", "completed": true } },
              "competitors": [
                { "homeAway": "home", "score": "1", "team": { "displayName": "Qatar" } },
                { "homeAway": "away", "score": "1", "team": { "displayName": "Switzerland" } }
              ]
            }]
          }]
        }
        """;

        var merged = new Dictionary<string, ExternalMatchScore>(StringComparer.OrdinalIgnoreCase);
        WorldCupLiveScoreSync.MergeEspnScoreboard(new MemoryStream(Encoding.UTF8.GetBytes(json)), merged);

        var key = EventMatchRules.NormalizePairKey("qatar", "switzerland");
        Assert.True(merged.ContainsKey(key));
        Assert.Equal(EventMatchStatus.Completed, merged[key].Status);
        Assert.Equal(1, merged[key].Score1);
        Assert.Equal(1, merged[key].Score2);
    }

    [Fact]
    public void MergeEspnScoreboard_ParsesPenaltyWinner()
    {
        const string json = """
        {
          "events": [{
            "competitions": [{
              "status": { "type": { "state": "post", "completed": true, "name": "STATUS_FINAL_PEN" } },
              "competitors": [
                { "homeAway": "home", "score": "1", "winner": false, "team": { "displayName": "Germany" } },
                { "homeAway": "away", "score": "1", "winner": true, "team": { "displayName": "Paraguay" } }
              ]
            }]
          }]
        }
        """;

        var merged = new Dictionary<string, ExternalMatchScore>(StringComparer.OrdinalIgnoreCase);
        WorldCupLiveScoreSync.MergeEspnScoreboard(new MemoryStream(Encoding.UTF8.GetBytes(json)), merged);

        var key = EventMatchRules.NormalizePairKey("germany", "paraguay");
        Assert.Equal("paraguay", merged[key].WinnerTeamId);
    }
}
