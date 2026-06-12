using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Xunit;

namespace GetTrainMate.Api.Tests;

public class EventMatchRulesTests
{
    [Fact]
    public void ArePredictionsOpen_ReturnsFalse_WhenMatchIsLive()
    {
        var match = new EventMatch { Status = EventMatchStatus.Live };
        Assert.False(EventMatchRules.ArePredictionsOpen(match));
    }

    [Fact]
    public void ArePredictionsOpen_ReturnsFalse_WhenMatchIsFinal()
    {
        var match = new EventMatch { Status = EventMatchStatus.Completed };
        Assert.False(EventMatchRules.ArePredictionsOpen(match));
    }

    [Fact]
    public void ArePredictionsOpen_ReturnsFalse_WhenManuallyLocked()
    {
        var match = new EventMatch { Status = EventMatchStatus.Scheduled, PredictionsLocked = true };
        Assert.False(EventMatchRules.ArePredictionsOpen(match));
    }

    [Fact]
    public void ArePredictionsOpen_ReturnsFalse_AfterKickoff()
    {
        var past = DateTime.UtcNow.AddHours(-1);
        var match = new EventMatch
        {
            Status = EventMatchStatus.Scheduled,
            MatchDate = past.ToString("yyyy-MM-dd"),
            MatchTime = past.ToString("HH:mm"),
        };
        Assert.False(EventMatchRules.ArePredictionsOpen(match));
    }

    [Fact]
    public void ArePredictionsOpen_ReturnsTrue_BeforeKickoff()
    {
        var future = DateTime.UtcNow.AddDays(2);
        var match = new EventMatch
        {
            Status = EventMatchStatus.Scheduled,
            MatchDate = future.ToString("yyyy-MM-dd"),
            MatchTime = future.ToString("HH:mm"),
        };
        Assert.True(EventMatchRules.ArePredictionsOpen(match));
    }

    [Fact]
    public void IsDuplicateFixture_DetectsReversedPairing()
    {
        var existing = new List<EventMatch>
        {
            new() { MatchId = "m1", TeamAId = "mexico", TeamBId = "south-africa" },
        };
        Assert.True(EventMatchRules.IsDuplicateFixture(existing, "south-africa", "mexico"));
        Assert.False(EventMatchRules.IsDuplicateFixture(existing, "south-africa", "mexico", "m1"));
    }
}
